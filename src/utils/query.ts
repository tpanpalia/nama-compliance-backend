/** Safely extract a scalar string from an Express req.query value */
export function qs(val: unknown): string | undefined {
  if (typeof val === 'string') return val
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') return val[0] as string
  return undefined
}

/** Extract a scalar string with a fallback default */
export function qsDefault(val: unknown, fallback: string): string {
  return qs(val) ?? fallback
}
