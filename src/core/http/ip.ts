import { isIP, isIPv4, isIPv6 } from 'node:net';

/** True when `value` is a valid IPv4 or IPv6 address (no zone id, no port). */
export function isValidIp(value: string): boolean {
  return !value.includes('%') && isIP(value) !== 0;
}

/**
 * Binary form of an IP address (4 bytes for IPv4, 16 for IPv6), like PHP `inet_pton()`.
 * IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`, what a dual-stack Node socket reports for
 * IPv4 clients) are converted to plain IPv4. Returns null for invalid input.
 */
export function ipToBytes(ip: string): Uint8Array | null {
  if (!isValidIp(ip)) return null;

  if (isIPv4(ip)) {
    return Uint8Array.from(ip.split('.').map((part) => Number.parseInt(part, 10)));
  }

  if (!isIPv6(ip)) return null;

  // Embedded IPv4 tail (::ffff:1.2.3.4) -> two hextets
  let text = ip.toLowerCase();
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = ipToBytes(tail);
    if (v4 === null) return null;
    const hi = (((v4[0] ?? 0) << 8) | (v4[1] ?? 0)).toString(16);
    const lo = (((v4[2] ?? 0) << 8) | (v4[3] ?? 0)).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const [headText = '', tailText] = text.split('::');
  const head = headText === '' ? [] : headText.split(':');
  const rest = tailText === undefined || tailText === '' ? [] : tailText.split(':');
  const missing = 8 - head.length - rest.length;
  const hextets = tailText === undefined ? head : [...head, ...Array<string>(Math.max(missing, 0)).fill('0'), ...rest];
  if (hextets.length !== 8) return null;

  const bytes = new Uint8Array(16);
  hextets.forEach((hextet, index) => {
    const value = Number.parseInt(hextet, 16);
    bytes[index * 2] = (value >> 8) & 0xff;
    bytes[index * 2 + 1] = value & 0xff;
  });

  // IPv4-mapped: ::ffff:0:0/96
  const mapped = bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  return mapped ? bytes.slice(12) : bytes;
}

/** Whether the first `mask` bits of both addresses are identical. */
export function ipMatchesNetwork(ip: Uint8Array, network: Uint8Array, mask: number): boolean {
  if (mask === 0) return true;

  const bytes = Math.floor(mask / 8);
  const bits = mask % 8;

  for (let i = 0; i < bytes; i++) {
    if (ip[i] !== network[i]) return false;
  }

  if (bits === 0) return true;

  const maskByte = ~((1 << (8 - bits)) - 1) & 0xff;
  return ((ip[bytes] ?? 0) & maskByte) === ((network[bytes] ?? 0) & maskByte);
}

/**
 * Whether `ip` belongs to one of the networks. Networks are single addresses or CIDR blocks
 * (`192.168.0.0/16`, `fd00::/8`). Invalid entries are ignored.
 */
export function isIpInNetworks(ip: string, networks: readonly string[]): boolean {
  const ipBinary = ipToBytes(ip);
  if (ipBinary === null) return false;

  for (const network of networks) {
    if (network === '') continue;

    const slash = network.indexOf('/');
    const networkAddress = slash === -1 ? network : network.slice(0, slash);
    const maskText = slash === -1 ? '' : network.slice(slash + 1);

    const networkBinary = ipToBytes(networkAddress);
    if (networkBinary === null || networkBinary.length !== ipBinary.length) continue;

    const maxMask = networkBinary.length * 8;
    const parsed = Number.parseInt(maskText, 10);
    const mask = maskText === '' ? maxMask : Math.max(0, Math.min(Number.isNaN(parsed) ? 0 : parsed, maxMask));

    if (ipMatchesNetwork(ipBinary, networkBinary, mask)) return true;
  }

  return false;
}
