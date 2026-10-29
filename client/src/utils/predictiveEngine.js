/**
 * NeuraGrid Predictive Analytics Engine
 * Multi-factor AI-simulated 24-hour energy forecast
 *
 * Model factors:
 *   45% – Time-of-day load curve (academic schedule shape)
 *   30% – Real-time occupancy influence
 *   15% – Historical day-of-week pattern
 *   10% – Outdoor temperature / HVAC demand
 *
 * All predictions are deterministic (seeded on hour + building id)
 * so the UI stays stable across live telemetry refreshes.
 */

// ─── Constants ────────────────────────────────────────────────────────────────
export const RATE   = 8.5   // ₹/kWh (South Indian HT commercial tariff)
export const CARBON = 0.82  // kg CO₂/kWh (India CEA grid average)

// 24-hour load shape — academic campus, weekday reference
const HOUR_FACTORS = [
  0.18, 0.16, 0.15, 0.15, 0.17, 0.22, // 00-05  deep night / security only
  0.38, 0.62, 0.85, 0.95, 0.98, 1.00, // 06-11  morning ramp → lecture peak
  0.97, 0.96, 0.94, 0.92, 0.88, 0.82, // 12-17  sustained afternoon load
  0.75, 0.65, 0.52, 0.40, 0.30, 0.22, // 18-23  evening wind-down
]

// Day-of-week multiplier (Monday highest; Sunday skeleton)
const DAY_FACTORS = [0.70, 1.08, 1.05, 1.03, 1.00, 0.88, 0.65]

// Simulated outdoor temperature curve °F (coolest 05:00, hottest 15:00)
const TEMP_CURVE = [
  62, 60, 59, 58, 58, 59, 62, 65, 68, 72, 76, 79,
  82, 84, 85, 85, 84, 82, 79, 76, 73, 70, 67, 64,
]

// Solar irradiance (normalised, 0 at night, peaks ~13:00)
const SOLAR_CURVE = [
  0,    0,    0,    0,    0,    0.01,
  0.04, 0.14, 0.36, 0.58, 0.78, 0.92,
  0.99, 1.00, 0.96, 0.86, 0.68, 0.44,
  0.18, 0.04, 0,    0,    0,    0,
]

const SOLAR_PEAK_KW = 720   // campus total PV nameplate capacity

// ─── Risk Classification ──────────────────────────────────────────────────────
export const RISK_META = {
  critical: { color: '#DB2777', label: 'Critical Risk', bg: 'rgba(219,39,119,0.06)', border: 'rgba(219,39,119,0.2)' },
  high:     { color: '#EA580C', label: 'High Risk',     bg: 'rgba(234,88,12,0.05)',  border: 'rgba(234,88,12,0.18)' },
  medium:   { color: '#D97706', label: 'Medium Risk',   bg: 'rgba(217,119,6,0.04)',  border: 'rgba(217,119,6,0.15)' },
  low:      { color: '#059669', label: 'Normal',        bg: 'rgba(5,150,105,0.03)',  border: 'rgba(5,150,105,0.12)' },
}

function getRiskLevel(pct) {
  if (pct >= 90) return 'critical'
  if (pct >= 75) return 'high'
  if (pct >= 60) return 'medium'
  return 'low'
}

function getTempFactor(hour) {
  const t = TEMP_CURVE[hour]
  if (t > 80) return 1 + (t - 80) * 0.018
  if (t < 55) return 1 + (55 - t) * 0.010
  return 1
}

// Lightweight pseudo-random seeded on two ints — same inputs → same output
function seededVariance(seed1, seed2, amplitude = 0.03) {
  return 1 + Math.sin(seed1 * 1.7 + seed2 * 0.43) * amplitude
}

// ─── Campus 24-Hour Forecast ──────────────────────────────────────────────────
export function generate24hForecast(buildings) {
  const now          = new Date()
  const currentHour  = now.getHours()
  const dayFactor    = DAY_FACTORS[now.getDay()] ?? 1

  const totalCapacity    = buildings.reduce((s, b) => s + (b.capacity ?? 500), 0)
  const currentTotalLoad = buildings.reduce((s, b) => s + (b.currentLoad ?? 200), 0)
  const avgOccupancy     = buildings.reduce((s, b) => s + (b.occupancy ?? 60), 0) / Math.max(1, buildings.length)

  // Calibrate model so hour=now reproduces real telemetry exactly
  const nowHF      = HOUR_FACTORS[currentHour]
  const calRatio   = nowHF > 0
    ? currentTotalLoad / (totalCapacity * 0.35 * nowHF * dayFactor)
    : 1

  return Array.from({ length: 24 }, (_, hour) => {
    const hf         = HOUR_FACTORS[hour]
    const tf         = getTempFactor(hour)
    const isPast     = hour < currentHour
    const isCurrent  = hour === currentHour

    // ── Three-component model ──────────────────────────────────────────────
    // 1. Time-of-day × calibration
    const timeBase = totalCapacity * 0.35 * hf * calRatio

    // 2. Occupancy boost during active hours (08:00–18:00)
    const occBoost = (hour >= 8 && hour <= 18)
      ? 1 + (avgOccupancy / 100) * 0.14
      : 1

    // 3. Historical pattern noise (deterministic, ±3%)
    const histMult = seededVariance(hour, 99, 0.03)

    const predicted = Math.min(totalCapacity, Math.max(150,
      Math.round(timeBase * occBoost * histMult * tf * dayFactor)
    ))

    // ── Confidence interval ────────────────────────────────────────────────
    const hourDist    = Math.abs(hour - currentHour)
    const uncertainty = isPast ? 0.015 : Math.min(0.22, 0.02 + hourDist * 0.009)
    const lower       = Math.round(predicted * (1 - uncertainty))
    const upper       = Math.round(predicted * (1 + uncertainty))

    // ── Historical reference (yesterday, slight offset) ────────────────────
    const histBase   = totalCapacity * 0.35 * HOUR_FACTORS[hour] * dayFactor * calRatio
    const historical = Math.round(histBase * seededVariance(hour, 7, 0.04) * 0.94)

    // ── Solar generation ───────────────────────────────────────────────────
    const solar = Math.round(SOLAR_CURVE[hour] * SOLAR_PEAK_KW)

    // ── Net demand (after solar offset) ───────────────────────────────────
    const netPredicted = Math.max(120, predicted - solar)
    const netLower     = Math.max(100, lower    - Math.round(solar * 0.92))
    const netUpper     = Math.max(140, upper    - Math.round(solar * 0.85))

    // ── Risk ───────────────────────────────────────────────────────────────
    const riskPct  = (netPredicted / totalCapacity) * 100
    const risk     = getRiskLevel(riskPct)

    // ── Confidence score ───────────────────────────────────────────────────
    const confidence = Math.max(62, Math.round(97 - hourDist * 1.5))

    return {
      hour,
      label:          `${String(hour).padStart(2, '0')}:00`,
      predicted,
      lower,
      upper,
      netPredicted,
      netLower,
      netUpper,
      historical,
      solar,
      risk,
      riskPct:        Math.round(riskPct),
      isPast,
      isCurrent,
      confidence,
      temp:           TEMP_CURVE[hour],
      predictedCost:  +((netPredicted * RATE) / 1000).toFixed(1),  // ₹/h (scaled)
      predictedCarbon: Math.round(netPredicted * CARBON),           // kg/h
    }
  })
}

// ─── Per-Building 24-Hour Sparkline Data ─────────────────────────────────────
export function buildingForecasts(buildings) {
  const now        = new Date().getHours()
  const dayFactor  = DAY_FACTORS[new Date().getDay()] ?? 1

  return buildings.map(b => {
    const cap      = b.capacity ?? 500
    const nowHF    = HOUR_FACTORS[now]
    const calRatio = nowHF > 0
      ? (b.currentLoad ?? 200) / (cap * 0.35 * nowHF * dayFactor)
      : 1

    // Seed based on building id first char to spread variance across buildings
    const bSeed = (b.id?.charCodeAt(1) ?? 1)

    const points = Array.from({ length: 24 }, (_, hour) => {
      const hf   = HOUR_FACTORS[hour]
      const tf   = getTempFactor(hour)
      const pred = Math.min(cap, Math.max(20,
        Math.round(cap * 0.35 * hf * tf * dayFactor * calRatio * seededVariance(hour, bSeed, 0.05))
      ))
      const solar = Math.round(SOLAR_CURVE[hour] * cap * 0.12)
      const net   = Math.max(10, pred - solar)
      return {
        hour,
        label:     `${String(hour).padStart(2, '0')}:00`,
        predicted: pred,
        net,
        solar,
        risk:      getRiskLevel((net / cap) * 100),
      }
    })

    const peakPt = points.reduce((mx, p) => p.net > mx.net ? p : mx, points[0])
    const minPt  = points.reduce((mn, p) => p.net < mn.net ? p : mn, points[0])
    const avgNet = Math.round(points.reduce((s, p) => s + p.net, 0) / 24)
    const trend  = points[23].net > points[0].net ? 'up' : 'down'

    return {
      id:          b.id,
      name:        b.name,
      shortName:   b.shortName,
      color:       b.color ?? '#0284C7',
      capacity:    cap,
      currentLoad: b.currentLoad,
      points,
      peakPt,
      minPt,
      avgNet,
      trend,
    }
  })
}

// ─── Peak Risk Windows (consecutive risky hours) ──────────────────────────────
export function detectPeakWindows(forecast) {
  const windows = []
  let cur = null

  forecast.forEach(pt => {
    const risky = pt.risk !== 'low'
    if (risky) {
      // Start new window or extend current if same risk tier
      if (!cur || cur.risk !== pt.risk) {
        if (cur) windows.push(cur)
        cur = {
          startHour:   pt.hour,
          endHour:     pt.hour,
          risk:        pt.risk,
          peakNet:     pt.netPredicted,
          peakRiskPct: pt.riskPct,
          avgTemp:     pt.temp,
          confidence:  pt.confidence,
        }
      } else {
        cur.endHour     = pt.hour
        cur.peakNet     = Math.max(cur.peakNet, pt.netPredicted)
        cur.peakRiskPct = Math.max(cur.peakRiskPct, pt.riskPct)
        cur.avgTemp     = Math.round((cur.avgTemp + pt.temp) / 2)
        cur.confidence  = Math.round((cur.confidence + pt.confidence) / 2)
      }
    } else {
      if (cur) { windows.push(cur); cur = null }
    }
  })
  if (cur) windows.push(cur)

  return windows.map(w => {
    const meta = RISK_META[w.risk]
    const reasons = []
    if (w.peakRiskPct >= 90) reasons.push('Grid overload risk')
    else if (w.peakRiskPct >= 75) reasons.push('High demand period')
    else reasons.push('Elevated load')
    if (w.avgTemp > 80) reasons.push('Heat-driven HVAC surge')
    if (w.startHour >= 8 && w.endHour <= 18) reasons.push('Peak academic hours')
    if (w.startHour >= 17 && w.startHour <= 20) reasons.push('Evening transition spike')

    return {
      ...w,
      ...meta,
      startLabel: `${String(w.startHour).padStart(2, '0')}:00`,
      endLabel:   `${String(Math.min(23, w.endHour + 1)).padStart(2, '0')}:00`,
      duration:   w.endHour - w.startHour + 1,
      reasons,
    }
  })
}

// ─── Best Deferral Windows ────────────────────────────────────────────────────
export function getBestDeferralWindows(forecast) {
  const now = new Date().getHours()
  return forecast
    .filter(p => p.risk === 'low' && p.hour > now)
    .sort((a, b) => a.riskPct - b.riskPct)
    .slice(0, 4)
    .map(p => ({
      hour:     p.hour,
      label:    p.label,
      loadPct:  p.riskPct,
      solar:    p.solar,
      net:      p.netPredicted,
      // Off-peak rate discount when solar is high
      adjRate:  +(RATE * (p.solar > 250 ? 0.82 : p.hour < 6 || p.hour > 22 ? 0.88 : 1)).toFixed(3),
      savings:  Math.round((1 - (p.solar > 250 ? 0.82 : 0.88)) * 100),
    }))
}

// ─── Model Factor Breakdown ───────────────────────────────────────────────────
export function getModelFactors(buildings, hour = new Date().getHours()) {
  const avgOcc = buildings.reduce((s, b) => s + (b.occupancy ?? 60), 0) / Math.max(1, buildings.length)
  const hf     = HOUR_FACTORS[hour]
  const temp   = TEMP_CURVE[hour]
  const dow    = new Date().getDay()
  const days   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return [
    {
      name:        'Time of Day',
      weight:      45,
      value:       Math.round(hf * 100),
      unit:        '% shape',
      description: hf >= 0.90
        ? 'Peak academic window — maximum equipment load'
        : hf < 0.30
        ? 'Night skeleton mode — HVAC & security only'
        : 'Moderate activity window',
      color:       '#0284C7',
      icon:        'clock',
    },
    {
      name:        'Occupancy',
      weight:      30,
      value:       Math.round(avgOcc),
      unit:        '% avg',
      description: `Campus at ${Math.round(avgOcc)}% — ${avgOcc > 80 ? 'high equipment & HVAC load' : avgOcc > 55 ? 'standard mixed load' : 'low equipment draw'}`,
      color:       '#7C3AED',
      icon:        'users',
    },
    {
      name:        'Historical Pattern',
      weight:      15,
      value:       Math.round((DAY_FACTORS[dow] ?? 1) * 100),
      unit:        '% baseline',
      description: `${days[dow]} profile — ${DAY_FACTORS[dow] >= 1.05 ? 'high-attendance day' : DAY_FACTORS[dow] >= 0.85 ? 'normal academic day' : 'low-attendance / weekend'}`,
      color:       '#EA580C',
      icon:        'history',
    },
    {
      name:        'Temperature',
      weight:      10,
      value:       temp,
      unit:        '°F outdoor',
      description: temp > 82
        ? 'High heat — HVAC demand elevated ↑18%'
        : temp < 55
        ? 'Cold snap — heating demand elevated ↑12%'
        : 'Comfortable range — HVAC nominal',
      color:       '#059669',
      icon:        'thermometer',
    },
  ]
}

// ─── Forecast Summary Stats ────────────────────────────────────────────────────
export function getForecastSummary(forecast) {
  const now    = new Date().getHours()
  const future = forecast.filter(p => p.hour >= now)

  const peakPoint  = future.reduce((mx, p) => p.netPredicted > mx.netPredicted ? p : mx, future[0] ?? forecast[12])
  const totalKwh   = Math.round(future.reduce((s, p) => s + p.netPredicted, 0))
  const riskHours  = future.filter(p => p.risk === 'critical' || p.risk === 'high').length
  const solar24    = Math.round(forecast.reduce((s, p) => s + p.solar, 0))
  const totalCost  = +future.reduce((s, p) => s + p.predictedCost, 0).toFixed(2)
  const avgConfidence = Math.round(future.reduce((s, p) => s + p.confidence, 0) / Math.max(1, future.length))

  return { peakPoint, totalKwh, riskHours, solar24, totalCost, avgConfidence }
}
