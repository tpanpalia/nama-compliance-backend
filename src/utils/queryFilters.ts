export function toStringArray(input: unknown): string[] {
  if (input == null || input === '') return [];
  if (Array.isArray(input)) {
    return input
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return String(input)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function toNumberArray(input: unknown): number[] {
  return toStringArray(input)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));
}

// Backward-compatible aliases.
export const normalizeToArray = toStringArray;
export const normalizeNumberArray = toNumberArray;
