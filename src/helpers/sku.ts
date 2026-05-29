// ─────────────────────────────────────────────────────────────────────────
// SKU computation.
//
// The admin never types a SKU. The server derives it deterministically from
// the product slug + the variant's option values, in the order the product
// declares its `optionTypes`. This guarantees:
//
//   - SKUs stay consistent across the catalogue.
//   - Renaming an option value (Size "M" → "Medium") changes the SKU
//     uniformly without any admin action.
//   - Variant uniqueness check piggybacks on SKU uniqueness — duplicate
//     option combinations produce duplicate SKUs.
//
// Examples
//   slug=pack-of-5-pants, optionTypes=["Size"], options={Size: "M"}
//     → PACK-OF-5-PANTS-M
//   slug=single-pant, optionTypes=["Size","Color"], options={Size:"S",Color:"Black"}
//     → SINGLE-PANT-S-BLACK
//   slug=my-cycoo, optionTypes=[], options={}
//     → MY-CYCOO
// ─────────────────────────────────────────────────────────────────────────

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
