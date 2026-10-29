/**
 * NeuraGrid — Heatmap Utilities
 *
 * Pure functions with no React or DOM dependencies.
 * Designed for reuse across multiple overlay types (temperature, CO₂, energy).
 *
 * Exports
 * ───────
 *   tempColorRgb(tempC)                          → { r, g, b }
 *   tempOverlayStyle(tempC, visible)             → inline style object
 *   tempBadgeInfo(tempC)                         → { label, color }
 *   projectTemp(currentTempF, setpointC, bldId)  → { projF, projC }
 *   BUILDING_TEMP_OFFSETS                        → per-building °F bias (mirrors EnergyContext)
 *   TEMP_GRADIENT_CSS                            → CSS gradient string for legend bar
 *   valueToRgb(value, min, max, stops)           → { r, g, b }  — generic reuse hook
 */

// ─── Math helpers ─────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ─── Temperature colour ramp ──────────────────────────────────────────────────
// 7-stop gradient covering the realistic indoor temperature range (14–34 °C).
// Colours are intentionally de-saturated for a professional look:
//   cool blue → teal → comfortable green → yellow-green → orange → red
const TEMP_STOPS = [
  { at: 14, r:  67, g: 147, b: 230 },   // soft blue      (very cool)
  { at: 19, r: 100, g: 180, b: 230 },   // sky blue       (cool)
  { at: 22, r:  52, g: 211, b: 170 },   // teal           (slightly cool)
  { at: 24, r:  52, g: 199, b: 110 },   // green          (optimal / comfortable)
  { at: 27, r: 180, g: 210, b:  60 },   // yellow-green   (warm)
  { at: 30, r: 240, g: 130, b:  35 },   // soft orange    (hot)
  { at: 34, r: 228, g:  72, b:  72 },   // muted red      (danger)
]

/**
 * Map a Celsius temperature to an { r, g, b } colour using a smooth 7-stop ramp.
 * Values outside 14–34 °C are clamped to the endpoints.
 */
export function tempColorRgb(tempC) {
  const stops = TEMP_STOPS
  if (tempC <= stops[0].at)              return { ...stops[0] }
  if (tempC >= stops[stops.length - 1].at) return { ...stops[stops.length - 1] }

  for (let i = 0; i < stops.length - 1; i++) {
    if (tempC >= stops[i].at && tempC < stops[i + 1].at) {
      const t = (tempC - stops[i].at) / (stops[i + 1].at - stops[i].at)
      return {
        r: Math.round(lerp(stops[i].r, stops[i + 1].r, t)),
        g: Math.round(lerp(stops[i].g, stops[i + 1].g, t)),
        b: Math.round(lerp(stops[i].b, stops[i + 1].b, t)),
      }
    }
  }
  return { r: 128, g: 128, b: 128 }
}

/**
 * Inline style object for a semi-transparent radial-gradient heatmap overlay.
 * The gradient is intentionally soft (max ~20% opacity) so underlying UI shows.
 *
 * @param {number}  tempC    Building temperature in Celsius
 * @param {boolean} visible  false → returns an empty (transparent) style
 */
export function tempOverlayStyle(tempC, visible = true) {
  const base = { transition: 'background 1.2s ease' }
  if (!visible) return base

  const { r, g, b } = tempColorRgb(tempC)
  return {
    ...base,
    background: [
      'radial-gradient(ellipse at 50% 32%,',
      `rgba(${r},${g},${b},0.26) 0%,`,
      `rgba(${r},${g},${b},0.12) 45%,`,
      `rgba(${r},${g},${b},0.04) 70%,`,
      'transparent 90%)',
    ].join(' '),
  }
}

/**
 * Temperature zone badge info.
 * Zones match the spec:  < 20°C cool  |  20–26°C comfortable  |  > 26°C hot
 */
export function tempBadgeInfo(tempC) {
  if (tempC < 18)  return { label: 'COLD',    color: '#60a5fa' }  // blue
  if (tempC < 20)  return { label: 'COOL',    color: '#34d399' }  // teal
  if (tempC < 24)  return { label: 'OPTIMAL', color: '#4ade80' }  // green
  if (tempC < 27)  return { label: 'WARM',    color: '#a3e635' }  // yellow-green
  if (tempC < 30)  return { label: 'HOT',     color: '#fb923c' }  // orange
  return                   { label: 'DANGER', color: '#f87171' }  // muted red
}

// ─── Building thermal offsets (mirrors EnergyContext TEMP_OFFSETS) ────────────
// Kept here so sim projections don't need to import EnergyContext internals.
export const BUILDING_TEMP_OFFSETS = {
  mechlabs:  6,   // heavy machinery — hottest building
  ablock:    2,   // dense server racks
  cblock:    1,
  bblock:    1,
  stevejobs: 0,
  green:     -2,  // best insulation — coolest building (b.id = 'green', not 'greenbldg')
}

/**
 * Project what a building's temperature will be ~5 ticks (≈25 s) after a new
 * setpoint is applied. Uses the same 12%-per-tick lerp as EnergyContext's live
 * tick so the preview is mathematically consistent with reality.
 *
 * @param {number} currentTempF  Current building temperature in °F
 * @param {number} setpointC     New setpoint in °C (from slider)
 * @param {string} buildingId    Building ID (for per-building offset)
 * @param {number} ticksAhead    How many ticks to project (default 5)
 * @returns {{ projF: number, projC: number }}
 */
export function projectTemp(currentTempF, setpointC, buildingId, ticksAhead = 5) {
  const offset  = BUILDING_TEMP_OFFSETS[buildingId] ?? 0
  const targetF = setpointC * (9 / 5) + 32 + offset
  // Remaining fraction after N ticks of 12%-lerp:  (1 - 0.12)^N
  const moved   = 1 - Math.pow(0.88, ticksAhead)          // ~47% in 5 ticks
  const projF   = +(currentTempF + (targetF - currentTempF) * moved).toFixed(1)
  const projC   = +((projF - 32) * (5 / 9)).toFixed(1)
  return { projF, projC }
}

// ─── Legend gradient CSS ──────────────────────────────────────────────────────
// Matches the TEMP_STOPS palette; used for the colour scale bar in TempHeatmap.
export const TEMP_GRADIENT_CSS = [
  'linear-gradient(90deg,',
  'rgba(67,147,230,1)   0%,',    //  14°C  cool blue
  'rgba(52,211,170,1)  28%,',    //  22°C  teal
  'rgba(52,199,110,1)  42%,',    //  24°C  green (optimal)
  'rgba(180,210,60,1)  58%,',    //  27°C  yellow-green
  'rgba(240,130,35,1)  78%,',    //  30°C  orange
  'rgba(228,72,72,1)   100%)',   //  34°C  red
].join(' ')

// ─── Generic value → colour (reusable for CO₂, energy, etc.) ─────────────────
/**
 * Map any numeric value onto a colour by interpolating through an ordered
 * stop array. Stops: [{ r, g, b }, ...]  (evenly spaced across [min, max]).
 *
 * Example — CO₂ overlay:
 *   valueToRgb(co2ppm, 400, 1200, [
 *     { r:52, g:199, b:110 },   // good
 *     { r:251,g:191, b:36  },   // elevated
 *     { r:255,g:45,  b:120 },   // critical
 *   ])
 */
export function valueToRgb(value, min, max, stops) {
  if (!stops?.length) return { r: 128, g: 128, b: 128 }
  const t      = clamp((value - min) / (max - min), 0, 1)
  const segLen = 1 / (stops.length - 1)
  const idx    = Math.min(Math.floor(t / segLen), stops.length - 2)
  const tSeg   = clamp((t - idx * segLen) / segLen, 0, 1)
  const a      = stops[idx]
  const b      = stops[idx + 1]
  return {
    r: Math.round(lerp(a.r, b.r, tSeg)),
    g: Math.round(lerp(a.g, b.g, tSeg)),
    b: Math.round(lerp(a.b, b.b, tSeg)),
  }
}
