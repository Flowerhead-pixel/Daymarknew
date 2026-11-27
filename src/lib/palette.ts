// Card colours. A goal takes the colour of its category, so the same kind of work always looks the same.
export interface Swatch {
  bg: string
  dark: boolean // true = use light text
}

const SWATCHES: Swatch[] = [
  { bg: '#D9583B', dark: true }, // terracotta
  { bg: '#A4A8E0', dark: false }, // periwinkle
  { bg: '#8B4A50', dark: true }, // plum
  { bg: '#3C93A8', dark: true }, // teal
  { bg: '#A9CD90', dark: false }, // sage
  { bg: '#D8D23F', dark: false }, // mustard
  { bg: '#38383A', dark: true }, // charcoal
]

const BY_NAME: Record<string, number> = {
  language: 0,
  creative: 1,
  work: 2,
  study: 3,
  health: 4,
  reading: 5,
  personal: 6,
}

export function swatchFor(categoryName: string, categoryId?: number): Swatch {
  const known = BY_NAME[categoryName.trim().toLowerCase()]
  if (known !== undefined) return SWATCHES[known]
  return SWATCHES[Math.abs(categoryId ?? categoryName.length) % SWATCHES.length]
}
