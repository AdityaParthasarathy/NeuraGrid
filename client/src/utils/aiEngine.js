/**
 * NeuraGrid AI Engine – Mock intelligent simulation layer
 * Provides predictions, anomaly scoring, and optimization recommendations
 */

// ─── Load Prediction ──────────────────────────────────────────────────────────
export function predictLoad(building, hour = new Date().getHours(), params = {}) {
  const { occupancy = building.occupancy, tempF = 72, solarPct = 60 } = params

  // Base load curve (academic schedule-aware)
  const hourFactor = getHourFactor(hour)
  const occupancyFactor = occupancy / 100
  const tempFactor = tempF > 80 ? 1 + (tempF - 80) * 0.015
    : tempF < 40 ? 1 + (40 - tempF) * 0.012
    : 1

  const solarOffset = (solarPct / 100) * building.capacity * 0.08

  const predictedLoad = Math.min(
    building.capacity,
    Math.round(
      building.capacity * 0.35 * hourFactor * occupancyFactor * tempFactor - solarOffset
    )
  )

  const confidence = Math.round(85 + Math.random() * 12)
  const variance = Math.round(predictedLoad * 0.08)

  return {
    predicted: predictedLoad,
    low: predictedLoad - variance,
    high: predictedLoad + variance,
    confidence,
    factors: { hourFactor, occupancyFactor, tempFactor, solarOffset },
  }
}

// 24-hour load schedule factor
function getHourFactor(hour) {
  const schedule = [
    0.10, 0.08, 0.08, 0.08, 0.10, 0.15, // 0-5
    0.22, 0.38, 0.68, 0.88, 0.96, 1.00, // 6-11
    0.98, 0.92, 0.88, 0.85, 0.78, 0.52, // 12-17
    0.32, 0.22, 0.16, 0.13, 0.11, 0.10, // 18-23
  ]
  return schedule[Math.min(hour, 23)]
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────
export function detectAnomalies(building) {
  const loadRatio = building.currentLoad / building.capacity
  const anomalies = []

  if (loadRatio > 0.9) {
    anomalies.push({
      type: 'load',
      severity: 'critical',
      message: `Load at ${Math.round(loadRatio * 100)}% of capacity`,
      score: loadRatio,
    })
  } else if (loadRatio > 0.75) {
    anomalies.push({
      type: 'load',
      severity: 'warning',
      message: `Elevated load: ${Math.round(loadRatio * 100)}% of capacity`,
      score: loadRatio,
    })
  }

  if (building.co2 > 1000) {
    anomalies.push({ type: 'co2', severity: 'critical', message: `CO₂ critical: ${building.co2} ppm`, score: building.co2 / 1000 })
  } else if (building.co2 > 800) {
    anomalies.push({ type: 'co2', severity: 'warning', message: `CO₂ elevated: ${building.co2} ppm`, score: building.co2 / 800 })
  }

  if (building.temperature > 75) {
    anomalies.push({ type: 'temp', severity: 'warning', message: `Temperature high: ${building.temperature}°F`, score: building.temperature / 75 })
  }

  return anomalies
}

// ─── Optimization Engine ──────────────────────────────────────────────────────
export function getOptimizations(building) {
  const recs = []

  // Lighting optimization
  if (building.lighting > 80 && building.occupancy < 70) {
    const saving = Math.round(building.lightingLoad * 0.25)
    recs.push({
      category: 'lighting',
      title: 'Smart Dimming',
      description: `Reduce lighting to ${Math.round(building.lighting * 0.75)}%. Occupancy is only ${building.occupancy}%.`,
      savingKw: saving,
      savingINR: Math.round(saving * 8.5 * 8),  // ₹/kWh × hours
      confidence: 94,
      effort: 'auto',
    })
  }

  // HVAC optimization
  const hour = new Date().getHours()
  if (building.hvacLoad > building.capacity * 0.3 && (hour < 7 || hour > 20)) {
    const saving = Math.round(building.hvacLoad * 0.35)
    recs.push({
      category: 'hvac',
      title: 'HVAC Night Setback',
      description: 'Building is outside peak hours. Reduce HVAC to setback mode.',
      savingKw: saving,
      savingINR: Math.round(saving * 8.5 * 6),
      confidence: 91,
      effort: 'auto',
    })
  }

  // Load shifting
  if (building.currentLoad > building.capacity * 0.7) {
    recs.push({
      category: 'shift',
      title: 'Non-Critical Load Shift',
      description: 'Defer water heating and EV charging to off-peak window (23:00–05:00).',
      savingKw: Math.round(building.equipmentLoad * 0.18),
      savingINR: Math.round(building.equipmentLoad * 0.18 * 8.5 * 6),
      confidence: 87,
      effort: 'scheduled',
    })
  }

  return recs
}

// ─── Simulation Engine ────────────────────────────────────────────────────────
export function runSimulation(params) {
  const {
    occupancy = 75,
    outdoorTemp = 72,
    solarPct = 60,
    hvacAdjust = 0,
    lightingAdjust = 0,
    buildings,
  } = params

  const results = buildings.map(building => {
    const tempFactor = outdoorTemp > 80
      ? 1 + (outdoorTemp - 80) * 0.018
      : outdoorTemp < 40
      ? 1 + (40 - outdoorTemp) * 0.014
      : 1

    const occFactor = occupancy / building.occupancy
    const hvacLoad = Math.round(building.hvacLoad * tempFactor * (1 + hvacAdjust / 100))
    const lightLoad = Math.round(building.lightingLoad * (1 + lightingAdjust / 100))
    const solarSave = Math.round((solarPct / 100) * building.capacity * 0.1)
    const simLoad = Math.max(
      50,
      Math.round((hvacLoad + lightLoad + building.equipmentLoad * occFactor) - solarSave)
    )

    return {
      id: building.id,
      name: building.name,
      shortName: building.shortName,
      baseline: building.currentLoad,
      simulated: simLoad,
      delta: simLoad - building.currentLoad,
      deltaPct: Math.round(((simLoad - building.currentLoad) / building.currentLoad) * 100),
      status: simLoad > building.capacity * 0.9 ? 'critical'
        : simLoad > building.capacity * 0.75 ? 'warning' : 'normal',
    }
  })

  const totalBaseline = results.reduce((s, r) => s + r.baseline, 0)
  const totalSimulated = results.reduce((s, r) => s + r.simulated, 0)
  const solarGeneration = Math.round((solarPct / 100) * 650)

  return {
    buildings: results,
    summary: {
      totalBaseline,
      totalSimulated,
      totalDelta: totalSimulated - totalBaseline,
      totalDeltaPct: Math.round(((totalSimulated - totalBaseline) / totalBaseline) * 100),
      solarGeneration,
      gridDraw: Math.max(0, totalSimulated - solarGeneration),
      carbonKg: Math.round((totalSimulated - solarGeneration) * 0.000709 * 1000),
      costPerHour: ((totalSimulated * 8.5) / 1000).toFixed(1), // ₹/h (scaled)
    },
  }
}

// ─── Next N-Hour Predictions ─────────────────────────────────────────────────
export function predictNextHours(building, hoursAhead = 6) {
  const now = new Date().getHours()
  return Array.from({ length: hoursAhead }, (_, i) => {
    const hour = (now + i + 1) % 24
    const pred = predictLoad(building, hour)
    const label = `${String(hour).padStart(2, '0')}:00`
    return { hour, label, ...pred, i }
  })
}

// ─── Rule-Based Recommendations ───────────────────────────────────────────────
export function generateRecommendations(buildings) {
  const recs = []
  const hour  = new Date().getHours()

  buildings.forEach(b => {
    const loadPct = b.currentLoad / b.capacity

    // High-load HVAC reduction
    if (loadPct > 0.85 && b.hvacLoad > 80) {
      const save = Math.round(b.hvacLoad * 0.1)
      recs.push({
        id:         `rec-hvac-${b.id}`,
        building:   b.name,
        shortName:  b.shortName ?? b.id,
        category:   'hvac',
        severity:   'critical',
        title:      `Reduce AC in ${b.shortName ?? b.name} by 10%`,
        detail:     `${b.name} is at ${Math.round(loadPct * 100)}% capacity. Dialing back HVAC setpoint by 2°F saves ~${save} kW (≈₹${Math.round(save * 8.5 * 8).toLocaleString('en-IN')}/day) with minimal comfort impact.`,
        savingKw:   save,
        savingPct:  Math.round((save / b.currentLoad) * 100),
        confidence: 93,
        effort:     'auto',
        icon:       'thermometer',
      })
    }

    // Lighting over-provision
    if ((b.lighting ?? 0) > 80 && b.occupancy < 65) {
      const save = Math.round((b.lightingLoad ?? 60) * 0.3)
      recs.push({
        id:         `rec-light-${b.id}`,
        building:   b.name,
        shortName:  b.shortName ?? b.id,
        category:   'lighting',
        severity:   'warning',
        title:      `Smart dimming in ${b.shortName ?? b.name} — 30% savings`,
        detail:     `Lighting at ${b.lighting}% while occupancy is only ${b.occupancy}%. Auto-dimming to 55% frees ${save} kW immediately. Sensors confirm adequate lux levels remain.`,
        savingKw:   save,
        savingPct:  Math.round((save / b.currentLoad) * 100),
        confidence: 97,
        effort:     'auto',
        icon:       'sun',
      })
    }

    // Lab / off-peak shift — covers academic, lab, and auditorium types
    if (b.type === 'academic' || b.type === 'lab' || b.type === 'research') {
      if (loadPct > 0.7 && hour >= 9 && hour <= 17) {
        recs.push({
          id:         `rec-shift-${b.id}`,
          building:   b.name,
          shortName:  b.shortName ?? b.id,
          category:   'shift',
          severity:   'info',
          title:      `Shift lab activity in ${b.shortName ?? b.name} to off-peak hours`,
          detail:     `Non-critical batch jobs and equipment sterilization cycles can move to 22:00–06:00 when grid rate drops 42%. Estimated saving: ${Math.round(b.currentLoad * 0.12)} kW · ₹${Math.round(b.currentLoad * 0.12 * 8.5 * 6).toLocaleString('en-IN')}/day.`,
          savingKw:   Math.round(b.currentLoad * 0.12),
          savingPct:  12,
          confidence: 88,
          effort:     'scheduled',
          icon:       'clock',
        })
      }
    }

    // EV / water-heater deferral at night
    if (loadPct > 0.6 && (hour < 6 || hour > 22)) {
      recs.push({
        id:         `rec-ev-${b.id}`,
        building:   b.name,
        shortName:  b.shortName ?? b.id,
        category:   'deferral',
        severity:   'info',
        title:      `Defer EV charging & water heating in ${b.shortName ?? b.name}`,
        detail:     `Overnight load still at ${Math.round(loadPct * 100)}%. Deferring EV chargers and boiler cycles to 02:00–04:00 (grid nadir) cuts costs by 18% without any user disruption.`,
        savingKw:   Math.round(b.currentLoad * 0.08),
        savingPct:  8,
        confidence: 91,
        effort:     'scheduled',
        icon:       'battery',
      })
    }
  })

  // De-duplicate by category+building, cap at 12
  const seen = new Set()
  return recs.filter(r => {
    const key = `${r.category}-${r.building}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}

// ─── Spike Detection ─────────────────────────────────────────────────────────
export function detectSpikes(buildings) {
  const spikes = []
  buildings.forEach(b => {
    const loadPct = b.currentLoad / b.capacity
    // Sudden above-threshold load
    if (loadPct > 0.9) {
      spikes.push({
        id:       `spike-load-${b.id}`,
        building: b.name,
        shortName: b.shortName ?? b.id,
        type:     'load',
        severity: 'critical',
        value:    `${Math.round(loadPct * 100)}% capacity`,
        delta:    `+${Math.round((loadPct - 0.75) * b.capacity)} kW above normal`,
        ts:       'just now',
      })
    }
    if ((b.co2 ?? 0) > 950) {
      spikes.push({
        id:       `spike-co2-${b.id}`,
        building: b.name,
        shortName: b.shortName ?? b.id,
        type:     'co2',
        severity: 'critical',
        value:    `${b.co2} ppm CO₂`,
        delta:    `${b.co2 - 700} ppm above safe threshold`,
        ts:       '1 min ago',
      })
    }
    if ((b.temperature ?? 0) > 77) {
      spikes.push({
        id:       `spike-temp-${b.id}`,
        building: b.name,
        shortName: b.shortName ?? b.id,
        type:     'temp',
        severity: 'warning',
        value:    `${b.temperature}°F`,
        delta:    `+${(b.temperature - 72).toFixed(1)}°F above setpoint`,
        ts:       '2 min ago',
      })
    }
  })
  return spikes
}

// ─── Carbon Calculator ────────────────────────────────────────────────────────
export function calcCarbon(kwh, source = 'grid') {
  // India CEA grid average: 0.82 kg CO₂/kWh
  const factors = { grid: 0.82, solar: 0, wind: 0, natural_gas: 0.499 }
  return +(kwh * (factors[source] ?? 0.82)).toFixed(2)
}

// ─── Energy Score ─────────────────────────────────────────────────────────────
export function calcEnergyScore(building) {
  const loadScore = 100 - (building.currentLoad / building.capacity) * 100
  const co2Score = Math.max(0, 100 - (building.co2 / 10))
  const tempScore = Math.max(0, 100 - Math.abs(building.temperature - 70) * 5)
  const savingsScore = Math.min(100, Math.max(0, building.savings + 50))
  return Math.round((loadScore * 0.4 + co2Score * 0.25 + tempScore * 0.15 + savingsScore * 0.2))
}
