/**
 * NeuraGrid — Energy Optimization Recommendation Engine
 * Rule-based engine: load redistribution · optimal timing · renewable utilisation
 *
 * Building types in use (from data/buildings.js):
 *   'academic'   — Green Building
 *   'lab'        — A-Block, B-Block, Mech & Civil Labs
 *   'auditorium' — C-Block, Steve Jobs Auditorium
 */

const RATE    = 8.5    // ₹/kWh (South Indian commercial tariff — Tamil Nadu/Telangana HT tariff)
const CARBON  = 0.82   // kg CO₂/kWh (India CEA grid average)
const PEAK_H  = { start: 9,  end: 18 }   // on-peak window
const SOLAR_H = { start: 10, end: 15 }   // solar peak window (South India gets strong afternoon sun)
const OFF_H   = { start: 22, end: 6  }   // off-peak window

// ─── Priority ordering ────────────────────────────────────────────────────────
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

// ─── Hour factor curve (South Indian college schedule: active 8:30–18:30) ─────
const HOUR_PROFILE = [
  0.10,0.08,0.08,0.08,0.10,0.15, // 00-05
  0.22,0.38,0.68,0.88,0.96,1.00, // 06-11 (opens 8:30, full swing by 10)
  0.98,0.92,0.88,0.85,0.78,0.52, // 12-17 (slight dip at 13, strong afternoon)
  0.32,0.22,0.16,0.13,0.11,0.10, // 18-23 (closes ~18:30, drops sharply)
]
const OPT_PROFILE = [
  0.07,0.06,0.06,0.06,0.08,0.12,
  0.18,0.30,0.55,0.74,0.84,0.88,
  0.85,0.80,0.75,0.72,0.65,0.38,
  0.22,0.15,0.11,0.09,0.08,0.07,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPeak()      { const h = new Date().getHours(); return h >= PEAK_H.start  && h <= PEAK_H.end  }
function isSolarPeak() { const h = new Date().getHours(); return h >= SOLAR_H.start && h <= SOLAR_H.end }
function isOffPeak()   { const h = new Date().getHours(); return h >= OFF_H.start   || h <= OFF_H.end   }
function rateMultiplier() { return isPeak() ? 1.42 : isOffPeak() ? 0.72 : 1.15 }

// Stable deterministic IDs so React doesn't unmount cards on every live tick
function mkId(category, a, b = '') {
  return `opt-${category}-${String(a).replace(/\s+/g,'')}-${String(b).replace(/\s+/g,'')}`
}

// ─── Checks if a building type is lab/research-intensive ─────────────────────
function isLabIntensive(b) {
  return b.type === 'lab' || b.type === 'academic'
}

// ─── Main engine ──────────────────────────────────────────────────────────────
export function generateOptimizations(buildings) {
  if (!buildings || buildings.length === 0) return []

  const recs  = []
  const hour  = new Date().getHours()
  const total = buildings.reduce((s, b) => s + b.currentLoad, 0)

  // ── 1. LOAD REDISTRIBUTION ─────────────────────────────────────────────────
  const overloaded  = buildings.filter(b => b.currentLoad / b.capacity > 0.74)
  const underloaded = buildings.filter(b => b.currentLoad / b.capacity < 0.50)

  overloaded.forEach(over => {
    const pct     = over.currentLoad / over.capacity
    const targets = [...underloaded]
      .filter(u => u.id !== over.id)
      .sort((a, b) => (a.currentLoad / a.capacity) - (b.currentLoad / b.capacity))

    if (!targets.length) return
    const target   = targets[0]
    const headroom = Math.round(target.capacity * 0.65 - target.currentLoad)
    if (headroom < 20) return

    const shiftKw  = Math.min(headroom, Math.round((over.currentLoad - over.capacity * 0.68) * 0.45))
    if (shiftKw < 10) return

    const savePct  = Math.round((shiftKw / over.currentLoad) * 100)
    const saveDay  = Math.round(shiftKw * RATE * rateMultiplier() * 10)
    const saveCo2  = Math.round(shiftKw * CARBON * 10)

    recs.push({
      id: mkId('load_redistribution', over.id, target.id), category: 'load_redistribution',
      priority: pct > 0.88 ? 'critical' : 'high',
      title: `Redistribute load: ${over.shortName} → ${target.shortName}`,
      summary: `${over.name} is at ${Math.round(pct * 100)}% — shift ${shiftKw} kW of non-critical equipment to ${target.name} (${Math.round(target.currentLoad / target.capacity * 100)}% used).`,
      savingKw: shiftKw, savingPct: savePct, savingDay: saveDay, savingCo2: saveCo2,
      effort: 'auto', confidence: 88,
      fromBuilding: over, toBuilding: target,
      actions: [
        `Defer ${Math.round(shiftKw * 0.45)} kW of HVAC pre-cooling to ${target.shortName}`,
        `Migrate batch compute jobs from ${over.shortName} to ${target.shortName}`,
        `Reschedule ${Math.round(shiftKw * 0.30)} kW equipment charging cycles`,
        `Enable demand-response load balancer for automatic failover`,
      ],
    })
  })

  // ── 2. OPTIMAL TIMING ──────────────────────────────────────────────────────
  buildings.forEach(b => {
    const pct = b.currentLoad / b.capacity

    // 2a. EV + water-heat shift to off-peak
    if (isPeak() && pct > 0.60) {
      const shiftKw = Math.round(b.currentLoad * 0.09)
      const saveDay = Math.round(shiftKw * RATE * (rateMultiplier() - 0.72) * 8)
      recs.push({
        id: mkId('optimal_timing_ev', b.id), category: 'optimal_timing',
        priority: pct > 0.80 ? 'high' : 'medium',
        title: `Shift EV & water heating to off-peak — ${b.shortName}`,
        summary: `Grid rate is ${(rateMultiplier() * 100).toFixed(0)}% of baseline. Deferring EV chargers and boiler cycles to 22:00–05:00 saves ₹${saveDay.toLocaleString('en-IN')}/day at 40% lower tariff.`,
        savingKw: shiftKw, savingPct: Math.round((shiftKw / b.currentLoad) * 100),
        savingDay: saveDay, savingCo2: Math.round(shiftKw * CARBON * 8),
        effort: 'scheduled', confidence: 92,
        optimalWindow: '22:00 – 05:00',
        fromBuilding: b,
        actions: [
          `Schedule EV chargers for 23:00 – 04:00 auto-start`,
          `Defer water heater cycles to 02:00 – 04:00`,
          `Shift non-critical server batch jobs to 01:00 – 05:00`,
          `Enable demand-charge avoidance mode in BMS`,
        ],
      })
    }

    // 2b. Lab/academic — align energy-intensive work to solar peak
    if (isLabIntensive(b) && !isSolarPeak() && pct > 0.55) {
      const shiftKw = Math.round(b.currentLoad * 0.12)
      const saveDay = Math.round(shiftKw * RATE * 4)
      recs.push({
        id: mkId('optimal_timing_lab', b.id), category: 'optimal_timing',
        priority: 'medium',
        title: `Align lab operations to solar peak — ${b.shortName}`,
        summary: `Running energy-intensive experiments during solar peak (10:00–14:00) uses free renewable generation. ₹${saveDay.toLocaleString('en-IN')}/day saving potential.`,
        savingKw: shiftKw, savingPct: Math.round((shiftKw / b.currentLoad) * 100),
        savingDay: saveDay, savingCo2: Math.round(shiftKw * CARBON * 4),
        effort: 'scheduled', confidence: 84,
        optimalWindow: '10:00 – 14:00',
        fromBuilding: b,
        actions: [
          `Schedule energy-intensive experiments for 10:00–14:00`,
          `Pre-run sterilisation and autoclave cycles at 10:30`,
          `Align centrifuge/CNC batches with solar generation forecast`,
          `Send advance calendar notifications to lab managers`,
        ],
      })
    }

    // 2c. Night anomaly — suggest schedule review
    if (isOffPeak() && pct > 0.55) {
      const wasteKw = Math.round(b.currentLoad * (pct - 0.30))
      const saveDay = Math.round(wasteKw * RATE * 8)
      recs.push({
        id: mkId('optimal_timing_night', b.id), category: 'optimal_timing',
        priority: 'high',
        title: `Review after-hours usage — ${b.shortName}`,
        summary: `${b.name} running at ${Math.round(pct * 100)}% after-hours. Off-hours baseline should be ≤30%. ${wasteKw} kW appears unscheduled — equipment may have been left on.`,
        savingKw: wasteKw, savingPct: Math.round((wasteKw / b.currentLoad) * 100),
        savingDay: saveDay, savingCo2: Math.round(wasteKw * CARBON * 8),
        effort: 'manual', confidence: 79,
        optimalWindow: 'Schedule review required',
        fromBuilding: b,
        actions: [
          `Audit equipment left on in ${b.shortName} after 22:00`,
          `Install occupancy-triggered auto-shutoff for non-critical systems`,
          `Review lab access logs for unscheduled sessions`,
          `Set BMS alarm threshold at >35% off-hours load`,
        ],
      })
    }
  })

  // ── 3. RENEWABLE ENERGY UTILISATION ────────────────────────────────────────
  const solarAvail  = isSolarPeak() ? 220 : (hour >= 7 && hour <= 17 ? Math.round(Math.sin((hour - 6) / 11 * Math.PI) * 200) : 0)
  const windAvail   = 18
  const renewAvail  = solarAvail + windAvail
  const renewUsed   = Math.round(total * 0.13)
  const renewGap    = Math.max(0, renewAvail - renewUsed)

  if (renewGap > 80) {
    const capturableKw = Math.round(renewGap * 0.72)
    const saveDay      = Math.round(capturableKw * RATE * 8)
    recs.push({
      id: mkId('renewable_capture', 'gap'), category: 'renewable',
      priority: renewGap > 350 ? 'high' : 'medium',
      title: `Capture ${capturableKw} kW unused renewable capacity`,
      summary: `${Math.round(renewGap)} kW of solar+wind is available but uncaptured. Routing controllable loads to renewable circuits saves ₹${saveDay.toLocaleString('en-IN')}/day and cuts carbon by ${Math.round(capturableKw * CARBON * 8)} kg.`,
      savingKw: capturableKw,
      savingPct: Math.round((capturableKw / total) * 100),
      savingDay: saveDay,
      savingCo2: Math.round(capturableKw * CARBON * 8),
      effort: 'auto', confidence: 91,
      renewDetails: { solarAvail, windAvail, renewUsed, renewGap },
      actions: [
        `Route ${Math.round(capturableKw * 0.45)} kW of HVAC loads to solar circuits`,
        `Enable solar-direct EV charging at Steve Jobs Auditorium`,
        `Activate campus battery bank charging during solar surplus`,
        `Pre-cool buildings using solar before peak demand window`,
      ],
    })
  }

  // Solar pre-cool window
  if (!isSolarPeak() && hour >= 6 && hour < 10) {
    recs.push({
      id: mkId('renewable_precool', 'campus'), category: 'renewable',
      priority: 'medium',
      title: `Pre-cool campus before solar peak (${SOLAR_H.start}:00–${SOLAR_H.end}:00)`,
      summary: `Solar generation will peak at ~220 kW from 10:00–15:00. Pre-cooling buildings now to 69 °F allows HVAC setback during peak, slashing demand charges.`,
      savingKw: 210, savingPct: 6, savingDay: Math.round(210 * RATE * 4), savingCo2: Math.round(210 * CARBON * 4),
      effort: 'scheduled', confidence: 88,
      optimalWindow: 'Execute now → benefit 10:00–14:00',
      actions: [
        `Set HVAC to 69 °F campus-wide for next 90 minutes`,
        `Pre-charge campus thermal storage banks`,
        `Activate demand-response pre-cooling protocol in BMS`,
        `Notify facilities team of pre-cooling window`,
      ],
    })
  }

  // ── 4. HVAC OPTIMISATION ───────────────────────────────────────────────────
  buildings.forEach(b => {
    const hvacLoad = b.hvacLoad ?? Math.round(b.currentLoad * 0.38)
    if (hvacLoad > b.capacity * 0.27 && b.occupancy < 68) {
      const saveKw  = Math.round(hvacLoad * 0.16)
      const saveDay = Math.round(saveKw * RATE * 10)
      recs.push({
        id: mkId('hvac', b.id), category: 'hvac',
        priority: b.occupancy < 45 ? 'high' : 'medium',
        title: `HVAC setback — ${b.shortName} (${b.occupancy}% occupied)`,
        summary: `HVAC using ${hvacLoad} kW while occupancy is ${b.occupancy}%. A 2 °F setback with zone isolation saves ${saveKw} kW (${Math.round((saveKw / b.currentLoad) * 100)}%) with zero comfort impact.`,
        savingKw: saveKw, savingPct: Math.round((saveKw / b.currentLoad) * 100),
        savingDay: saveDay, savingCo2: Math.round(saveKw * CARBON * 10),
        effort: 'auto', confidence: 96,
        fromBuilding: b,
        actions: [
          `Set HVAC setpoint +2 °F in low-occupancy zones`,
          `Isolate VAV boxes in unoccupied floors`,
          `Reduce fresh air intake by 25% in empty zones`,
          `Enable occupancy-based AHU scheduling`,
        ],
      })
    }
  })

  // ── 5. LIGHTING OPTIMISATION ───────────────────────────────────────────────
  buildings.forEach(b => {
    const lighting = b.lighting ?? 80
    if (lighting > 72 && (b.occupancy ?? 70) < 62) {
      const saveKw  = Math.round((b.lightingLoad ?? Math.round(b.currentLoad * 0.20)) * 0.32)
      const saveDay = Math.round(saveKw * RATE * 12)
      recs.push({
        id: mkId('lighting', b.id), category: 'lighting',
        priority: 'low',
        title: `Smart dimming — ${b.shortName} (lighting ${lighting}%, occ. ${b.occupancy}%)`,
        summary: `Lighting at ${lighting}% while occupancy is only ${b.occupancy}%. Auto-dimming to ${Math.round(lighting * 0.62)}% saves ${saveKw} kW. Daylight sensors confirm adequate lux.`,
        savingKw: saveKw, savingPct: Math.round((saveKw / b.currentLoad) * 100),
        savingDay: saveDay, savingCo2: Math.round(saveKw * CARBON * 12),
        effort: 'auto', confidence: 97,
        fromBuilding: b,
        actions: [
          `Apply occupancy-triggered dimming in corridors and common areas`,
          `Set daylight harvesting threshold at 450 lux`,
          `Schedule perimeter lights to 40% during 10:00–15:00`,
          `Enable motion-sensor auto-shutoff in storage rooms`,
        ],
      })
    }
  })

  // ── Deduplicate & sort ─────────────────────────────────────────────────────
  const seen = new Set()
  return recs
    .filter(r => { const k = r.title.slice(0, 32); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))
}

// ─── 24-hour optimal schedule ─────────────────────────────────────────────────
// Updated totalCapacity to match new 6-building campus: 2310 kW
export function getOptimalSchedule(totalCapacity = 2310) {
  return Array.from({ length: 24 }, (_, h) => {
    const solar = h >= 6 && h <= 18
      ? Math.round(Math.max(0, Math.sin((h - 6) / 12 * Math.PI)) * 220)
      : 0
    const wind  = 18
    return {
      hour:      h,
      label:     `${String(h).padStart(2, '0')}:00`,
      current:   Math.round(HOUR_PROFILE[h] * totalCapacity * 0.72),
      optimal:   Math.round(OPT_PROFILE[h]  * totalCapacity * 0.64),
      solar,
      wind,
      renewable: solar + wind,
      rate:      h >= 9 && h <= 17 ? 'peak' : h >= 18 && h <= 21 ? 'mid' : 'off',
      rateMult:  h >= 9 && h <= 17 ? 1.42   : h >= 18 && h <= 21 ? 1.18  : 0.72,
    }
  })
}

// ─── Aggregate savings summary ────────────────────────────────────────────────
export function calcTotalSavings(recs) {
  return {
    totalKw:    recs.reduce((s, r) => s + r.savingKw,  0),
    totalDay:   recs.reduce((s, r) => s + r.savingDay,  0),
    totalCo2:   recs.reduce((s, r) => s + r.savingCo2,  0),
    byCategory: ['load_redistribution','optimal_timing','renewable','hvac','lighting'].map(cat => ({
      cat,
      kw:  recs.filter(r => r.category === cat).reduce((s, r) => s + r.savingKw,  0),
      day: recs.filter(r => r.category === cat).reduce((s, r) => s + r.savingDay, 0),
    })),
  }
}
