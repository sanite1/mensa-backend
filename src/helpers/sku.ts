// SKU computation — the server derives SKUs from the product slug plus option values in optionTypes order, e.g. single-pant with Size S and Color Black gives SINGLE-PANT-S-BLACK.
// Variant uniqueness piggybacks on SKU uniqueness, duplicate option combos produce duplicate SKUs.

/** Strips non-alphanumerics and collapses to dashes. */
export function skuToken(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function computeSku(
  productSlug: string,
  options: Record<string, string>,
  optionTypes: string[],
): string {
  const slugPart = skuToken(productSlug)
  if (optionTypes.length === 0) return slugPart

  const valueParts = optionTypes
    .map((type) => options[type])
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v) => skuToken(v))

  if (valueParts.length === 0) return slugPart
  return `${slugPart}-${valueParts.join('-')}`
}
