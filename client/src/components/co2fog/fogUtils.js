/**
 * NeuraGrid — CO₂ Fog Utilities
 *
 * Pure functions with no React or DOM dependencies.
 * Designed for reuse across CO₂ / air-quality overlays.
 *
 * Exports
 * ───────
 *   fogIntensity(co2ppm, ventilation)               → 0–1  (canvas fog alpha driver)
 *   co2FogBadge(co2ppm)                             → { label, color, tier }
 *   projectCo2(co2ppm, simVentilation, ticksAhead)  → projected ppm
 *   CO2_THRESHOLDS                                  → { CLEAR, HAZE, DENSE }
 *   CO2_FOG_GRADIENT_CSS                            → CSS gradient for legend bar
 */

// ─── Math helpers ─────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ─── CO₂ threshold constants (ppm) ───────────────────────────────────────────
/**
 * Thresholds calibrated to the live data range (EnergyContext caps CO₂ at
 * 1200 ppm, so DENSE is set at 980 to match real critical readings).
 *
 * Spec intent (MASTER PROMPT 4):
 *   < 800  ppm → Clear   (no fog)
 *   800–1200   → Light haze
 *   > 1200     → Dense fog
 */
export const CO2_THRESHOLDS = {
  CLEAR: 800,   // badge threshold — below this shows "CLEAR" badge
  HAZE:  800,   // alias (kept for backward compat — same as CLEAR)
  DENSE: 980,   // badge threshold — above this shows "DENSE FOG"
                // (matches AirflowVisualization CRITICAL @ >980 ppm)
}

// ─── Fog intensity ────────────────────────────────────────────────────────────
/**
 * Normalised fog intensity (0–1) accounting for ventilation credit.
 *
 *   Raw severity: (co2ppm − 500) / 700   → 0 at 500 ppm, 1.0 at 1200 ppm
 *   Ventilation reduces apparent severity by up to 60 %
 *   → high airflow visually clears the fog before the CO₂ reading drops
 *
 * Calibrated against the real data range (EnergyContext: 380–1200 ppm):
 *   mechlabs 920 ppm @ 60 % vent  → intensity ≈ 0.24  (visible light haze) ✓
 *   ablock   845 ppm @ 60 % vent  → intensity ≈ 0.13  (faint haze)         ✓
 *   green    510 ppm @ 60 % vent  → intensity ≈ 0      (clear air)          ✓
 *
 * @param {number} co2ppm      CO₂ in ppm
 * @param {number} ventilation 0–100
 * @returns {number}           0 = clear air, 1 = maximum fog
 */
export function fogIntensity(co2ppm, ventilation) {
  const rawFog     = clamp((co2ppm - 500) / 700, 0, 1)
  const ventCredit = (ventilation / 100) * 0.60
  return clamp(rawFog - ventCredit, 0, 1)
}

// ─── Badge ────────────────────────────────────────────────────────────────────
/**
 * Returns a display badge for the CO₂ level.
 *   tier 0   = clear air
 *   tier 0.5 = light haze (600–800 ppm — fog barely visible)
 *   tier 1   = haze      (800–980 ppm — fog visible)
 *   tier 2   = dense fog (> 980 ppm  — heavy fog)
 */
export function co2FogBadge(co2ppm) {
  if (co2ppm >= CO2_THRESHOLDS.DENSE) return { label: 'DENSE FOG',  color: '#DB2777', tier: 2   }
  if (co2ppm >= CO2_THRESHOLDS.CLEAR) return { label: 'HAZE',       color: '#EA580C', tier: 1   }
  if (co2ppm >= 600)                  return { label: 'LIGHT HAZE', color: '#f97316', tier: 0.5 }
  return                                     { label: 'CLEAR',      color: '#059669', tier: 0   }
}

// ─── CO₂ projection ───────────────────────────────────────────────────────────
/**
 * Project what a building's CO₂ will be ~5 ticks (≈25 s) after a new
 * ventilation level is applied.  Uses a per-tick convergence toward the
 * outdoor ambient baseline (400 ppm).
 *
 *   rate = 0.012 + (ventilation / 100) × 0.058  per 5-second tick
 *
 * Examples:
 *   vent = 100 → rate ≈ 0.070 → (0.930)^5 ≈ 0.70 → ~30 % drop toward ambient
 *   vent =  50 → rate ≈ 0.041 → (0.959)^5 ≈ 0.81 → ~19 % drop toward ambient
 *
 * @param {number} co2ppm          Current CO₂ in ppm
 * @param {number} simVentilation  New ventilation level (0–100)
 * @param {number} [ticksAhead=5]  How many ticks to project
 * @returns {number}               Projected CO₂ in ppm (integer)
 */
export function projectCo2(co2ppm, simVentilation, ticksAhead = 5) {
  const ambient  = 400
  const rate     = 0.012 + (simVentilation / 100) * 0.058
  const factor   = Math.pow(1 - rate, ticksAhead)
  return Math.round(ambient + (co2ppm - ambient) * factor)
}

// ─── Legend gradient CSS ──────────────────────────────────────────────────────
// Matches co2FogBadge colour stops across the real data range 400–1200 ppm.
// Scale: pct = (ppm − 400) / (1200 − 400) × 100
//   400 ppm → 0 %  |  600 ppm → 25 %  |  800 ppm → 50 %
//   980 ppm → 72 % |  1200 ppm → 100 %
export const CO2_FOG_GRADIENT_CSS = [
  'linear-gradient(90deg,',
  'rgba(5,150,105,1)    0%,',     //  400 ppm  ambient
  'rgba(5,150,105,1)   25%,',     //  600 ppm  LIGHT HAZE starts
  'rgba(249,115,22,1)  50%,',     //  800 ppm  HAZE threshold
  'rgba(234,88,12,1)  62%,',     //  900 ppm  rising
  'rgba(219,39,119,1)  72%,',     //  980 ppm  DENSE threshold
  'rgba(219,39,119,1) 100%)',     // 1200 ppm  max
].join(' ')
