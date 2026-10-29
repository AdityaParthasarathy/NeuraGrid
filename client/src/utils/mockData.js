import { subHours, subDays, format } from 'date-fns'
import { BUILDINGS as _BUILDINGS } from '../data/buildings'

// ─── Single source of truth re-export ────────────────────────────────────────
// All other modules should import BUILDINGS from this file (or from data/buildings.js
// directly).  EnergyContext, Dashboard, Analytics, Optimization and every other
// consumer already use this path, so this re-export keeps backward compatibility.
export const BUILDINGS = _BUILDINGS

// ─── Time-series helpers ──────────────────────────────────────────────────────
function sinWave(hour, base, amp, phase = 0) {
  return base + amp * Math.sin(((hour + phase) * Math.PI) / 12)
}

function jitter(value, pct = 0.06) {
  return value * (1 + (Math.random() - 0.5) * pct)
}

// 24-hour load profile factors (normalized to peak)
const LOAD_PROFILE = [
  0.18, 0.15, 0.14, 0.14, 0.16, 0.24,  // 00:00 - 05:00
  0.42, 0.68, 0.88, 0.96, 0.99, 1.00,  // 06:00 - 11:00
  0.97, 0.96, 0.94, 0.91, 0.87, 0.80,  // 12:00 - 17:00
  0.72, 0.60, 0.48, 0.38, 0.28, 0.20,  // 18:00 - 23:00
]

// Generate 24 h energy data (campus aggregate)
export function generateDailyData() {
  const nowHour = new Date().getHours()

  return Array.from({ length: 24 }, (_, hour) => {
    const factor = LOAD_PROFILE[hour]
    const base   = 1394 // Baseline peak load
    
    // Predicted is the smooth curve
    const predicted = Math.round(base * factor)
    
    // Peak threshold (18% above prediction)
    const peak = Math.round(predicted * 1.18)
    
    // Actual: for past hours, it's jittered predicted. For future, it's undefined.
    // For current hour, EnergyContext will overwrite this with the live total hourly.
    const actual = hour <= nowHour ? Math.round(jitter(predicted, 0.08)) : undefined

    return {
      time: `${String(hour).padStart(2, '0')}:00`,
      hour,
      actual,
      predicted,
      peak,
    }
  })
}

// Generate 7-day data
export function generateWeeklyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return days.map(day => ({
    day,
    consumption: Math.round(day === 'Sun' ? 2000 + Math.random() * 1000 : day === 'Sat' ? 5000 + Math.random() * 2000 : 9000 + Math.random() * 3500),
    predicted:   Math.round(day === 'Sun' ? 2200 + Math.random() * 800  : day === 'Sat' ? 5500 + Math.random() * 1500 : 9500 + Math.random() * 3000),
    cost:        Math.round((day === 'Sun' ? 2500 : day === 'Sat' ? 6000 : 10500) * 8.5 / 10 + Math.random() * 3000),  // ₹ at ₹8.5/kWh
    carbon:      Math.round(day === 'Sun' ? 1640 : day === 'Sat' ? 4100 : 7380 + Math.random() * 2870),  // 0.82 kg/kWh
  }))
}

// Generate 30-day data
export function generateMonthlyData() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i)
    const isWeekend = [0, 6].includes(d.getDay())
    const consumption = Math.round(isWeekend ? 4000 + Math.random() * 3000 : 10000 + Math.random() * 4000)
    return {
      date:        format(d, 'MMM d'),
      consumption,
      baseline:    12000,
      savings:     Math.round(500 + Math.random() * 1500),
      carbon:      Math.round(consumption * 0.82),
      cost:        Math.round(consumption * 8.5),
    }
  })
}

// Building comparison data (used by Analytics)
export function getBuildingComparison() {
  return BUILDINGS.map(b => ({
    name:        b.shortName,
    fullName:    b.name,
    consumption: b.todayKwh,
    efficiency:  Math.round(100 - (b.currentLoad / b.capacity) * 100),
    carbon:      b.carbonKg,
    occupancy:   b.occupancy,
  }))
}

// ─── System Insights ──────────────────────────────────────────────────────────
export const SYSTEM_INSIGHTS = [
  {
    id:          'ai1',
    type:        'prediction',
    severity:    'info',
    building:    'A-Block',
    buildingId:  'ablock',
    title:       'Peak Load Forecast: 18:00–20:00',
    description:
      'System predicts a 94 % probability of peak energy demand between 6–8 PM due to evening lab sessions, server and GPU compute loads in A-Block. Pre-cooling recommended by 16:30.',
    confidence:  94,
    impact:      '+62 kWh avoided',
    action:      'Schedule pre-cooling',
    timestamp:   '2 min ago',
    icon:        'zap',
  },
  {
    id:          'ai2',
    type:        'anomaly',
    severity:    'critical',
    building:    'A-Block',
    buildingId:  'ablock',
    title:       'Anomaly Detected: Server Room Thermal Spike',
    description:
      'Server room temperature in A-Block at 78°F — rising at 0.8 °F/hr beyond normal gradient. Possible cooling system degradation in Rack Bay 3. Maintenance ticket auto-generated.',
    confidence:  89,
    impact:      'Equipment risk: HIGH',
    action:      'Dispatch maintenance',
    timestamp:   '8 min ago',
    icon:        'alert-triangle',
  },
  {
    id:          'ai3',
    type:        'optimization',
    severity:    'success',
    building:    'Green Building',
    buildingId:  'green',
    title:       'Solar Surplus Available — 38 kW Uncaptured',
    description:
      'Green Building daylight sensors confirm 22 % renewable surplus available. Routing controllable loads to solar circuits saves 38 kWh today with zero occupant impact.',
    confidence:  97,
    impact:      '38 kWh · ₹3,230 saved',
    action:      'Apply solar routing',
    timestamp:   '15 min ago',
    icon:        'sun',
  },
  {
    id:          'ai4',
    type:        'prediction',
    severity:    'warning',
    building:    'B-Block',
    buildingId:  'bblock',
    title:       'HVAC Compressor Degradation Detected',
    description:
      'B-Block HVAC compressor efficiency dropped 14 % over the past 3 weeks. System model gives 68 % probability of failure within 12 days. Proactive replacement saves ₹2,14,200.',
    confidence:  68,
    impact:      '₹2,14,200 maintenance savings',
    action:      'Schedule inspection',
    timestamp:   '31 min ago',
    icon:        'activity',
  },
  {
    id:          'ai5',
    type:        'optimization',
    severity:    'info',
    building:    'Steve Jobs Auditorium',
    buildingId:  'stevejobs',
    title:       'Load Shifting Opportunity — AV Systems',
    description:
      'Stage AV and ambient lighting loads in Steve Jobs Auditorium can shift from 22:00 to 02:00–04:00 (off-peak) using smart scheduling. Saves 18 % on daily energy cost with no service disruption.',
    confidence:  91,
    impact:      '₹8,500/month savings',
    action:      'Enable load shift',
    timestamp:   '47 min ago',
    icon:        'trending-down',
  },
  {
    id:          'ai6',
    type:        'anomaly',
    severity:    'warning',
    building:    'B-Block',
    buildingId:  'bblock',
    title:       'Unusual After-Hours Consumption',
    description:
      'B-Block energy draw 38 % above expected baseline at 02:30 last night. Pattern matched to centrifuges left running in Chemistry Lab B-204. Access logs confirm no scheduled overnight work.',
    confidence:  85,
    impact:      '32 kWh wasted',
    action:      'Review lab equipment policy',
    timestamp:   '2 hrs ago',
    icon:        'eye',
  },
]

// ─── Simulation scenarios ──────────────────────────────────────────────────────
export const SIMULATION_PRESETS = [
  { id: 's1', name: 'Summer Heat Wave',   occupancy: 95,  temp: 98, solar: 100, hvacBoost:  40, description: 'Simulate extreme summer conditions' },
  { id: 's2', name: 'Winter Storm',       occupancy: 60,  temp: 18, solar:  10, hvacBoost:  35, description: 'Cold weather low-solar scenario' },
  { id: 's3', name: 'Full Capacity Day',  occupancy: 100, temp: 72, solar:  70, hvacBoost:  20, description: 'All buildings at maximum occupancy' },
  { id: 's4', name: 'Solar Optimized',    occupancy: 75,  temp: 75, solar:  95, hvacBoost:   0, description: 'Maximum renewable energy scenario' },
  { id: 's5', name: 'Night Mode',         occupancy: 10,  temp: 65, solar:   0, hvacBoost: -20, description: 'Skeleton crew overnight scenario' },
]

// ─── Campus KPI Metrics (aligned with 6-building totals) ──────────────────────
// Derived from BUILDINGS base values:
//   capacity total  : 220+380+320+480+350+560 = 2310 kW
//   baseLoad total  : 128+248+195+290+215+318 = 1394 kW  (60 % utilisation)
//   todayKwh total  : 1088+2108+1658+2465+1828+2703 = 11850 kWh
//   alerts total    : 0+2+0+2+0+1 = 5 (0 critical at start)
export const CAMPUS_METRICS = {
  totalConsumption:  1394,   // kW current
  totalCapacity:     2310,   // kW peak
  activeBuildings:   6,
  totalBuildings:    6,
  solarGeneration:   110,    // kW — Green Building solar array
  windGeneration:     18,    // kW
  gridDraw:          1266,   // kW
  todayKwh:         11850,
  carbonTonnes:       1.14,
  efficiency:          60,   // %
  savingsToday:    '₹9,240',
  alertCount:          5,
  criticalAlerts:      0,
  uptime:            99.7,
}
