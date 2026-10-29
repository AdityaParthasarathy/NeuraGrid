/**
 * Server-side AI Simulation Utility
 * Generates realistic mock data when MongoDB is unavailable
 */

const MOCK_BUILDINGS = [
  { buildingId: 'b1', name: 'Science & Tech Hall',    shortName: 'SCI', type: 'academic', floors: 5, area: 42000, capacity: 500, currentLoad: 342 },
  { buildingId: 'b2', name: 'Engineering Building',   shortName: 'ENG', type: 'academic', floors: 6, area: 55000, capacity: 650, currentLoad: 589 },
  { buildingId: 'b3', name: 'Library & Media Center', shortName: 'LIB', type: 'library',  floors: 3, area: 38000, capacity: 320, currentLoad: 187 },
  { buildingId: 'b4', name: 'Student Union',          shortName: 'SU',  type: 'social',   floors: 2, area: 28000, capacity: 280, currentLoad: 241 },
  { buildingId: 'b5', name: 'Research Complex',       shortName: 'RES', type: 'research', floors: 8, area: 70000, capacity: 900, currentLoad: 812 },
  { buildingId: 'b6', name: 'Athletics Center',       shortName: 'ATH', type: 'sports',   floors: 2, area: 48000, capacity: 420, currentLoad: 156 },
  { buildingId: 'b7', name: 'Administration Tower',   shortName: 'ADM', type: 'admin',    floors:10, area: 62000, capacity: 560, currentLoad: 298 },
  { buildingId: 'b8', name: 'Medical Sciences Bldg',  shortName: 'MED', type: 'medical',  floors: 7, area: 58000, capacity: 750, currentLoad: 534 },
]

function getMockBuildings() {
  return MOCK_BUILDINGS.map(b => ({
    ...b,
    telemetry: {
      currentLoad: Math.round(b.currentLoad * (0.92 + Math.random() * 0.16)),
      occupancy:   Math.round(50 + Math.random() * 45),
      status:      'normal',
      temperature: Math.round(69 + Math.random() * 8),
      humidity:    Math.round(40 + Math.random() * 20),
      co2:         Math.round(400 + Math.random() * 600),
      lighting:    Math.round(60 + Math.random() * 40),
      updatedAt:   new Date(),
    },
    isActive: true,
  }))
}

function getMockBuilding(id) {
  const b = MOCK_BUILDINGS.find(b => b.buildingId === id)
  if (!b) return null
  return { ...b, telemetry: { currentLoad: b.currentLoad, status: 'normal', updatedAt: new Date() } }
}

function generateMockReadings(buildingId, hours = 24) {
  const building = MOCK_BUILDINGS.find(b => b.buildingId === buildingId) ?? MOCK_BUILDINGS[0]
  const now  = Date.now()
  const step = (hours * 3600 * 1000) / 96 // ~96 data points

  return Array.from({ length: 96 }, (_, i) => {
    const ts   = new Date(now - (95 - i) * step)
    const hour = ts.getHours()
    const base = building.currentLoad
    const daytime = (hour >= 7 && hour <= 20) ? 1 : 0.35
    const consumption = Math.round(base * daytime * (0.9 + Math.random() * 0.2))
    return {
      buildingId,
      timestamp:   ts,
      consumption,
      hvacLoad:    Math.round(consumption * 0.42),
      lightingLoad:Math.round(consumption * 0.22),
      equipLoad:   Math.round(consumption * 0.36),
      solar:       hour >= 6 && hour <= 18 ? Math.round(Math.random() * 80) : 0,
      gridDraw:    consumption,
      temperature: Math.round(70 + Math.random() * 8),
      humidity:    Math.round(40 + Math.random() * 20),
      co2:         Math.round(400 + Math.random() * 500),
      occupancy:   Math.round(daytime * 70 + Math.random() * 20),
      predicted:   Math.round(base * daytime * (0.88 + Math.random() * 0.18)),
      anomaly:     Math.random() < 0.03,
      anomalyScore:Math.random() < 0.03 ? Math.random() * 0.4 + 0.6 : 0,
    }
  })
}

function generateMockSummary() {
  const buildings = getMockBuildings()
  const totalLoad = buildings.reduce((s, b) => s + b.telemetry.currentLoad, 0)
  const solar     = 284

  return {
    totalConsumption: totalLoad,
    totalCapacity:    4380,
    solarGeneration:  solar,
    gridDraw:         Math.max(0, totalLoad - solar),
    activeBuildings:  buildings.length,
    efficiency:       Math.round((1 - totalLoad / 4380) * 100 + 30),
    carbonKgToday:    Math.round(totalLoad * 0.000386 * 24 * 1000),
    savingsToday:     Math.round(Math.random() * 800 + 800),
    timestamp:        new Date(),
  }
}

function generateInsights() {
  return [
    {
      _id: 'mock-ai1',
      buildingId:  'b5',
      type:        'prediction',
      severity:    'warning',
      title:       'Peak Load Forecast: 18:00–20:00',
      description: 'AI models predict 94% probability of peak demand this evening. Pre-cooling recommended by 16:30.',
      confidence:  94,
      impact:      '+142 kWh avoided',
      action:      'Schedule pre-cooling',
      resolved:    false,
      createdAt:   new Date(Date.now() - 120000),
    },
    {
      _id: 'mock-ai2',
      buildingId:  'b5',
      type:        'anomaly',
      severity:    'critical',
      title:       'Anomaly Detected: Server Room Thermal Spike',
      description: 'Server room temperature rising at 0.8°F/hr. Maintenance ticket auto-generated.',
      confidence:  89,
      impact:      'Equipment risk: HIGH',
      action:      'Dispatch maintenance',
      resolved:    false,
      createdAt:   new Date(Date.now() - 480000),
    },
    {
      _id: 'mock-ai3',
      buildingId:  'b3',
      type:        'optimization',
      severity:    'info',
      title:       'Smart Dimming Opportunity',
      description: 'Daylight coverage 78%. Automated dimming to 40% saves 31 kWh with zero occupant impact.',
      confidence:  97,
      impact:      '31 kWh · $4.80 saved',
      action:      'Apply dimming schedule',
      resolved:    false,
      createdAt:   new Date(Date.now() - 900000),
    },
  ]
}

function predictLoad(buildingId, hour, params) {
  const building = MOCK_BUILDINGS.find(b => b.buildingId === buildingId) ?? MOCK_BUILDINGS[0]
  const { occupancy = 75, tempF = 72, solarPct = 60 } = params ?? {}

  const hourFactors = [0.18,0.16,0.15,0.15,0.17,0.22,0.38,0.62,0.85,0.95,0.98,1,0.97,0.96,0.94,0.92,0.88,0.82,0.75,0.65,0.52,0.40,0.30,0.22]
  const hf  = hourFactors[Math.min(hour, 23)]
  const tf  = tempF > 80 ? 1 + (tempF - 80) * 0.015 : tempF < 40 ? 1 + (40 - tempF) * 0.012 : 1
  const of  = occupancy / 100
  const sol = (solarPct / 100) * building.capacity * 0.08
  const pred = Math.min(building.capacity, Math.round(building.capacity * 0.35 * hf * of * tf - sol))

  return { predicted: pred, low: Math.round(pred * 0.92), high: Math.round(pred * 1.08), confidence: Math.round(85 + Math.random() * 12) }
}

function runSimulation({ occupancy = 75, outdoorTemp = 72, solarPct = 60, hvacAdjust = 0, lightingAdjust = 0 }) {
  const buildings = getMockBuildings()
  const results = buildings.map(b => {
    const tf      = outdoorTemp > 80 ? 1 + (outdoorTemp - 80) * 0.018 : outdoorTemp < 40 ? 1 + (40 - outdoorTemp) * 0.014 : 1
    const occ     = occupancy / 100
    const hvac    = Math.round(b.currentLoad * 0.42 * tf * (1 + hvacAdjust / 100))
    const light   = Math.round(b.currentLoad * 0.22 * (1 + lightingAdjust / 100))
    const equip   = Math.round(b.currentLoad * 0.36 * occ)
    const solar   = Math.round((solarPct / 100) * b.capacity * 0.1)
    const simLoad = Math.max(50, hvac + light + equip - solar)
    return {
      id: b.buildingId, name: b.name, shortName: b.shortName,
      baseline: b.currentLoad, simulated: simLoad,
      delta: simLoad - b.currentLoad,
      deltaPct: Math.round(((simLoad - b.currentLoad) / b.currentLoad) * 100),
      status: simLoad > b.capacity * 0.9 ? 'critical' : simLoad > b.capacity * 0.75 ? 'warning' : 'normal',
    }
  })
  const totalBaseline  = results.reduce((s, r) => s + r.baseline, 0)
  const totalSimulated = results.reduce((s, r) => s + r.simulated, 0)
  const solarGen       = Math.round((solarPct / 100) * 650)
  return {
    buildings: results,
    summary: {
      totalBaseline, totalSimulated,
      totalDelta:    totalSimulated - totalBaseline,
      totalDeltaPct: Math.round(((totalSimulated - totalBaseline) / totalBaseline) * 100),
      solarGeneration: solarGen,
      gridDraw: Math.max(0, totalSimulated - solarGen),
      carbonKg: Math.round((totalSimulated - solarGen) * 0.000709 * 1000),
      costPerHour: ((totalSimulated * 0.15) / 1000).toFixed(2),
    },
  }
}

module.exports = { getMockBuildings, getMockBuilding, generateMockReadings, generateMockSummary, generateInsights, predictLoad, runSimulation }
