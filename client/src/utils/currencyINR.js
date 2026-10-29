/**
 * NeuraGrid — Currency Utility
 *
 * Default display currency: INR (₹)
 * Tariff: South Indian HT commercial (Tamil Nadu/Telangana) — ₹8.5/kWh
 *
 * Indian number formatting examples:
 *   ₹1,000      (one thousand)
 *   ₹10,000     (ten thousand)
 *   ₹1,00,000   (one lakh)
 *   ₹10,00,000  (ten lakhs)
 *   ₹1,00,00,000 (one crore)
 */

export const USD_TO_INR = 83

/** Campus electricity tariff in ₹/kWh — South Indian HT commercial tariff */
export const RATE_INR = 8.5  // ₹/kWh South Indian HT commercial tariff

// ─── Core formatters ─────────────────────────────────────────────────────────

/**
 * Format a value already in INR using the Indian number system.
 * e.g. formatCurrencyINR(102920) → "₹1,02,920"
 */
export function formatCurrencyINR(inrValue) {
  return (
    '₹' +
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
      Math.round(inrValue)
    )
  )
}

/**
 * Format a USD value as INR (multiplies by USD_TO_INR internally).
 * e.g. formatUSDAsINR(1240) → "₹1,02,920"
 */
export function formatUSDAsINR(usdValue) {
  return formatCurrencyINR(usdValue * USD_TO_INR)
}

/**
 * Format a USD value as USD.
 * e.g. formatCurrencyUSD(1240) → "$1,240"
 */
export function formatCurrencyUSD(usdValue) {
  return (
    '$' +
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      Math.round(usdValue)
    )
  )
}

/**
 * Convert a USD value → INR and return the raw number (for computations).
 */
export function toINR(usdValue) {
  return usdValue * USD_TO_INR
}

/**
 * Convert an INR value → USD (for toggle display).
 */
export function toUSD(inrValue) {
  return inrValue / USD_TO_INR
}

/**
 * Format a short INR amount for compact display (e.g. axis labels).
 * < 1 lakh  → "₹50K"
 * ≥ 1 lakh  → "₹1.2L"
 * ≥ 1 crore → "₹1.5Cr"
 */
export function formatCurrencyINRShort(inrValue) {
  const v = Math.round(inrValue)
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(1)}L`
  if (v >= 1_000)       return `₹${(v / 1_000).toFixed(0)}K`
  return `₹${v}`
}
