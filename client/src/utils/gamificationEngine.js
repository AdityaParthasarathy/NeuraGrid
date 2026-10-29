/**
 * NeuraGrid Gamification Engine
 * Scores buildings, awards badges, and ranks them on a live leaderboard.
 *
 * Score formula (0–100):
 *   35%  Load Efficiency   – penalises overload; rewards operating 30-70% of capacity
 *   25%  Air Quality       – CO₂ ppm (400 = perfect, 1200 = 0 pts)
 *   20%  Temperature       – deviation from 70 °F setpoint
 *   20%  Savings           – % better than baseline consumption
 */

// ─── Badge Definitions ────────────────────────────────────────────────────────
export const BADGE_DEFS = {
  'EFFICIENCY-PRO': {
    icon: 'TrendingUp',
    color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.15)',
    description: 'Maintained 90%+ efficiency for 48 hours'
  },
  'GRID-CHAMPION': {
    icon: 'Zap',
    color: '#0284C7', bg: 'rgba(2,132,199,0.06)', border: 'rgba(2,132,199,0.15)',
    description: 'Reduced grid reliance by 40% using renewables'
  },
  'SOLAR-PIONEER': {
    icon: 'Sun',
    color: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.15)',
    description: 'First building to reach zero-emissions'
  },
  'CARBON-CRUSHER': {
    icon: 'Leaf',
    color: '#0284C7', bg: 'rgba(2,132,199,0.06)', border: 'rgba(2,132,199,0.15)',
    description: 'Saved 500kg of CO2 this week'
  },
  'NIGHT-WATCHMAN': {
    icon: 'Moon',
    color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.15)',
    description: 'Optimized energy usage during off-peak hours'
  },
  'AI-ACOLYTE': {
    icon: 'Brain',
    color: '#7C3AED', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.15)',
    description: 'Accepted 10+ AI-driven load-balancing suggestions'
  },
  'SMART-LOADER': {
    icon: 'Cpu',
    color: '#0284C7', bg: 'rgba(2,132,199,0.06)', border: 'rgba(2,132,199,0.15)',
    description: 'Successfully balanced peak-load without alerts'
  },
  'GREEN-WARRIOR': {
    icon: 'Shield',
    color: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.15)',
    description: 'Consistent high score in sustainability leaderboard'
  },
  'PREDICTIVE-PRO': {
    icon: 'LineChart',
    color: '#EA580C', bg: 'rgba(234,88,12,0.06)', border: 'rgba(234,88,12,0.15)',
    description: 'Predicted and averted a regional power spike'
  },
  'CAMPUS-CAPTAIN': {
    icon: 'Flag',
    color: '#EA580C', bg: 'rgba(234,88,12,0.06)', border: 'rgba(234,88,12,0.15)',
    description: 'Won the monthly Campus Energy Challenge'
  },
  'VIRTUAL-MASTER': {
    icon: 'Globe',
    color: '#7C3AED', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.15)',
    description: 'Completed 5 simulations in the Sim Lab'
  },
  'ALERT-HERO': {
    icon: 'BellRing',
    color: '#DB2777', bg: 'rgba(219,39,119,0.06)', border: 'rgba(219,39,119,0.15)',
    description: 'Resolved 3 critical power alerts in record time'
  },
  champion: {
    emoji: '🏆', name: 'Daily Champion',
    desc: 'Greenest building of the day – #1 energy score',
    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.40)',
    tier: 'gold',
  },
  diamond: {
    emoji: '💎', name: 'Diamond Tier',
    desc: 'Energy score ≥ 90 – elite performance',
    color: '#00f5ff', bg: 'rgba(0,245,255,0.10)', border: 'rgba(0,245,255,0.35)',
    tier: 'gold',
  },
  eco_guardian: {
    emoji: '🌿', name: 'Eco Guardian',
    desc: 'Energy score ≥ 80 – consistently green',
    color: '#00ff88', bg: 'rgba(0,255,136,0.10)', border: 'rgba(0,255,136,0.35)',
    tier: 'silver',
  },
  efficiency_ace: {
    emoji: '⚡', name: 'Efficiency Ace',
    desc: 'Running below 60% of capacity – lean & mean',
    color: '#00f5ff', bg: 'rgba(0,245,255,0.08)', border: 'rgba(0,245,255,0.28)',
    tier: 'silver',
  },
  solar_star: {
    emoji: '☀️', name: 'Solar Star',
    desc: 'Savings ≥ 20% – maximum renewable benefit',
    color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)',
    tier: 'silver',
  },
  temp_master: {
    emoji: '🧊', name: 'Temperature Master',
    desc: 'Indoor temp within 1.5 °F of the 70 °F setpoint',
    color: '#7b2fff', bg: 'rgba(123,47,255,0.10)', border: 'rgba(123,47,255,0.30)',
    tier: 'bronze',
  },
  air_hero: {
    emoji: '💨', name: 'Air Quality Hero',
    desc: 'CO₂ below 550 ppm – excellent indoor air',
    color: '#00f5ff', bg: 'rgba(0,245,255,0.08)', border: 'rgba(0,245,255,0.25)',
    tier: 'bronze',
  },
  carbon_crusher: {
    emoji: '🌍', name: 'Carbon Crusher',
    desc: 'Lowest carbon intensity on campus (kg/kW)',
    color: '#00ff88', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.28)',
    tier: 'silver',
  },
  load_shedder: {
    emoji: '📉', name: 'Load Shedder',
    desc: 'Savings ≥ 8% vs baseline – demand reduced',
    color: '#ff6b35', bg: 'rgba(255,107,53,0.10)', border: 'rgba(255,107,53,0.28)',
    tier: 'bronze',
  },
  streak: {
    emoji: '🔥', name: 'On a Streak',
    desc: '3+ consecutive days of improving efficiency',
    color: '#ff6b35', bg: 'rgba(255,107,53,0.10)', border: 'rgba(255,107,53,0.28)',
    tier: 'silver',
  },
  night_owl: {
    emoji: '🦉', name: 'Night Guardian',
    desc: 'Efficient overnight operation – below 35% at night',
    color: '#7b2fff', bg: 'rgba(123,47,255,0.10)', border: 'rgba(123,47,255,0.28)',
    tier: 'bronze',
  },
  comeback: {
    emoji: '💪', name: 'The Comeback',
    desc: 'Biggest score improvement in the last 24 hours',
    color: '#ff2d78', bg: 'rgba(255,45,120,0.10)', border: 'rgba(255,45,120,0.28)',
    tier: 'bronze',
  },
}

// Tier display order
export const TIER_ORDER = ['gold', 'silver', 'bronze']

// ─── Simulated rank-change history ────────────────────────────────────────────
// Positive = moved up, negative = moved down, 0 = unchanged
// Uses new building IDs from data/buildings.js
const RANK_CHANGES = {
  green:     2,   // eco-building trending up
  bblock:   -1,   // lab load creeping up
  stevejobs: 1,   // auditorium improving
  ablock:   -2,   // high server load dragging rank down
  cblock:    0,   // stable
  mechlabs: -1,   // industrial load high
}

// XP levels
const LEVELS = [
  { min: 0,    label: 'Novice',      color: '#94A3B8' },
  { min: 300,  label: 'Apprentice',   color: '#0284C7' },
  { min: 500,  label: 'Practitioner', color: '#059669' },
  { min: 700,  label: 'Expert',       color: '#D97706' },
  { min: 800,  label: 'Veteran',      color: '#EA580C' },
  { min: 870,  label: 'Master',       color: '#7C3AED' },
  { min: 930,  label: 'Grand Master', color: '#DB2777' },
]

export function getLevel(xp) {
  let lvl = LEVELS[0]
  for (const l of LEVELS) { if (xp >= l.min) lvl = l }
  return lvl
}

// ─── Score calculation ────────────────────────────────────────────────────────
export function calcBuildingScore(b) {
  const loadRatio = (b.currentLoad ?? 200) / (b.capacity ?? 500)

  // Load score: ideal 30-65%, sharp penalty above 75%, slight penalty for < 20%
  let loadScore
  if (loadRatio < 0.20)       loadScore = 55 + loadRatio * 150           // ramp up from idle
  else if (loadRatio <= 0.65) loadScore = 100 - (loadRatio - 0.30) * 43  // gentle slope in optimal zone
  else                        loadScore = Math.max(0, 85 - (loadRatio - 0.65) * 280) // steep drop

  // CO₂ score: 400 ppm → 100, 1200 ppm → 0 (linear)
  const co2Score = Math.max(0, Math.min(100, 100 - ((b.co2 ?? 600) - 400) / 8))

  // Temperature score: 70 °F ideal, −10 pts per degree deviation
  const tempScore = Math.max(0, 100 - Math.abs((b.temperature ?? 72) - 70) * 10)

  // Savings score: savings field is % vs baseline (e.g. +18 = 18% better)
  // Map range [−20, +30] → [0, 100]
  const savingsScore = Math.min(100, Math.max(0, ((b.savings ?? 0) + 20) * 2))

  const total = Math.round(
    loadScore    * 0.35 +
    co2Score     * 0.25 +
    tempScore    * 0.20 +
    savingsScore * 0.20
  )

  return {
    total: Math.max(1, Math.min(100, total)),
    breakdown: {
      load:    { score: Math.round(Math.max(0, loadScore)),    maxPts: 35, label: 'Load Efficiency' },
      co2:     { score: Math.round(Math.max(0, co2Score)),     maxPts: 25, label: 'Air Quality'     },
      temp:    { score: Math.round(Math.max(0, tempScore)),    maxPts: 20, label: 'Temperature'     },
      savings: { score: Math.round(Math.max(0, savingsScore)), maxPts: 20, label: 'Savings'         },
    },
  }
}

// Score → colour
export function scoreColor(score) {
  if (score >= 85) return '#059669'
  if (score >= 70) return '#0284C7'
  if (score >= 55) return '#D97706'
  if (score >= 40) return '#EA580C'
  return '#DB2777'
}

// ─── Badge award logic ────────────────────────────────────────────────────────
export function calcBadges(b, allBuildings, rank, score) {
  const earned = []
  const loadRatio = (b.currentLoad ?? 200) / (b.capacity ?? 500)
  const hour = new Date().getHours()

  // Rank-based
  if (rank === 1) earned.push('champion')

  // Score-based
  if (score >= 90) earned.push('diamond')
  if (score >= 80) earned.push('eco_guardian')

  // Load-based
  if (loadRatio < 0.60) earned.push('efficiency_ace')

  // Savings
  if ((b.savings ?? 0) >= 20) earned.push('solar_star')
  if ((b.savings ?? 0) >= 8)  earned.push('load_shedder')

  // Temperature
  if (Math.abs((b.temperature ?? 72) - 70) <= 1.5) earned.push('temp_master')

  // CO₂
  if ((b.co2 ?? 999) < 550) earned.push('air_hero')

  // Carbon intensity (kg per kW of capacity) – lowest on campus
  const myIntensity = (b.carbonKg ?? 200) / (b.capacity ?? 500)
  const minIntensity = Math.min(...allBuildings.map(x => (x.carbonKg ?? 200) / (x.capacity ?? 500)))
  if (myIntensity <= minIntensity * 1.05) earned.push('carbon_crusher')

  // Night guardian (after 20:00 or before 06:00)
  if ((hour >= 20 || hour < 6) && loadRatio < 0.35) earned.push('night_owl')

  // Streak – seeded deterministically on a stable hash of the building id
  const idHash = (b.id ?? '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  if (Math.abs(idHash) % 3 === 0) earned.push('streak')

  // Comeback – simulated for the building currently in last place that has positive savings
  if (rank === allBuildings.length && (b.savings ?? 0) > 0) earned.push('comeback')

  return earned
}

// ─── Leaderboard generation ───────────────────────────────────────────────────
const TAGLINES = [
  'Leading the pack! 🌟',
  "Hot on the champion's heels 🔥",
  'Strong podium finish 🎯',
  'Solid mid-table performer',
  'Battling for a top-3 spot',
  'Every point counts — keep pushing',
  'Room to grow — action recommended',
  'Needs attention — let\'s turn this around 💪',
]

export function generateLeaderboard(buildings) {
  // Score every building first
  const scored = buildings.map(b => ({ ...b, scoreData: calcBuildingScore(b) }))

  // Sort by total score descending
  const sorted = [...scored].sort((a, b) => b.scoreData.total - a.scoreData.total)

  return sorted.map((b, i) => {
    const rank    = i + 1
    const score   = b.scoreData.total
    const xp      = score * 10
    const badges  = calcBadges(b, buildings, rank, score)
    const change  = RANK_CHANGES[b.id] ?? 0
    const color   = scoreColor(score)

    return {
      ...b,
      rank,
      score,
      xp,
      level:         getLevel(xp),
      badges,
      scoreBreakdown: b.scoreData.breakdown,
      rankChange:    change,
      color,
      tagline:       TAGLINES[Math.min(i, TAGLINES.length - 1)],
      loadPct:       Math.round((b.currentLoad / (b.capacity ?? 500)) * 100),
    }
  })
}

// ─── Campus-wide aggregate score ─────────────────────────────────────────────
export function getCampusScore(buildings) {
  const scores = buildings.map(b => calcBuildingScore(b).total)
  const avg    = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)

  const grade =
    avg >= 90 ? 'A+' :
    avg >= 80 ? 'A'  :
    avg >= 70 ? 'B+' :
    avg >= 60 ? 'B'  :
    avg >= 50 ? 'C'  : 'D'

  const label =
    avg >= 85 ? 'Campus Net-Zero Leader 🌍' :
    avg >= 70 ? 'Green Campus Performer 🌿' :
    avg >= 55 ? 'Improving – Keep Pushing ⚡' :
                'Action Required 🚨'

  return { avg, grade, label, color: scoreColor(avg) }
}

// ─── Category special winners ─────────────────────────────────────────────────
export function getCategoryWinners(leaderboard) {
  const byCarbon   = [...leaderboard].sort((a, b) =>
    (a.carbonKg / a.capacity) - (b.carbonKg / b.capacity))
  const byLoad     = [...leaderboard].sort((a, b) =>
    (a.currentLoad / a.capacity) - (b.currentLoad / b.capacity))
  const byTemp     = [...leaderboard].sort((a, b) =>
    Math.abs(a.temperature - 70) - Math.abs(b.temperature - 70))
  const byAir      = [...leaderboard].sort((a, b) => a.co2 - b.co2)
  const bySavings  = [...leaderboard].sort((a, b) => b.savings - a.savings)

  return [
    { key: 'carbon',   emoji: '🌍', title: 'Carbon Crusher',    subtitle: 'Lowest carbon intensity',  winner: byCarbon[0],  value: `${(byCarbon[0].carbonKg / byCarbon[0].capacity).toFixed(2)} kg/kW`, color: '#059669' },
    { key: 'load',     emoji: '⚡', title: 'Efficiency Ace',    subtitle: 'Lowest load ratio',         winner: byLoad[0],    value: `${Math.round((byLoad[0].currentLoad / byLoad[0].capacity) * 100)}% capacity`, color: '#0284C7' },
    { key: 'temp',     emoji: '🧊', title: 'Temperature Master', subtitle: 'Closest to 70°F setpoint', winner: byTemp[0],    value: `${byTemp[0].temperature}°F`,  color: '#7C3AED' },
    { key: 'air',      emoji: '💨', title: 'Air Quality Hero',  subtitle: 'Lowest CO₂ reading',        winner: byAir[0],     value: `${byAir[0].co2} ppm`,         color: '#0284C7' },
    { key: 'savings',  emoji: '☀️', title: 'Solar Star',        subtitle: 'Highest energy savings',    winner: bySavings[0], value: `+${bySavings[0].savings}%`,   color: '#D97706' },
  ]
}
