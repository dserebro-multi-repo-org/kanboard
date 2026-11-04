/** PHP `(int)` cast. */
export function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** PHP `(float)` cast. */
export function toFloat(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** PHP `empty()`. */
export function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || value === 0 || value === '0' || value === false || (Array.isArray(value) && value.length === 0);
}

/** `ModelHelper::removeEmptyFields()`: drop the listed fields when they exist and are empty. */
export function removeEmptyFields(values: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(values, field) && isEmpty(values[field])) {
      delete values[field];
    }
  }
}
