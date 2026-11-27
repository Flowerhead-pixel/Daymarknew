export function formatNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return rounded.toLocaleString('en-IN')
}

/** 12000,'₹' -> "₹12,000"; 72,'hours' -> "72 hours". */
export function formatValue(n: number, unit?: string): string {
  if (unit === '₹') return `₹${formatNumber(n)}`
  return unit ? `${formatNumber(n)} ${unit}` : formatNumber(n)
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
