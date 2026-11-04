import { randomBytes } from 'node:crypto';

/** Random token of `length` bytes as hexadecimal string, like `Token::getToken()` (default: 60 characters). */
export function getToken(length = 30): string {
  return randomBytes(length).toString('hex');
}
