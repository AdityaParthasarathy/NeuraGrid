/**
 * NeuraGrid — Real-Time Alert System + Interactive Decision Engine
 * Detects: energy spikes · night anomalies · overloaded buildings · CO₂ · temp
 * Decision Engine: simulate → preview impact → apply fix | ignore
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useEnergy } from './EnergyContext'

const AlertContext = createContext(null)

// ─── Per-type recommended actions ─────────────────────────────────────────────
export const RECOMMENDATIONS = {
  energy_spike: [
    {
      id: 'es-r1', label: 'Enable Power Saving Mode', urgency: 'high',
      impact: { loadReduction: 0.12, description: 'Throttle non-critical devices — reduces load by ~12%' },
    },
    {
      id: 'es-r2', label: 'Disable Non-Essential Lighting', urgency: 'medium',
      impact: { loadReduction: 0.06, description: 'Switch off corridor & decorative lighting circuits' },
    },
    {
      id: 'es-r3', label: 'Defer HVAC Boost Cycle', urgency: 'medium',
      impact: { loadReduction: 0.08, description: 'Delay scheduled HVAC boost by 2 hours' },
    },
  ],
  night_usage: [
    {
      id: 'nu-r1', label: 'Activate Auto Shutoff Protocol', urgency: 'high',
      impact: { loadReduction: 0.35, description: 'Automatically shut off all non-critical systems' },
    },
    {
      id: 'nu-r2', label: 'Switch to Minimal Lighting Mode', urgency: 'medium',
      impact: { loadReduction: 0.15, description: 'Reduce lighting to security-only level' },
    },
  ],
  overloaded: [
    {
      id: 'ol-r1', label: 'Shed Non-Critical Load Circuits', urgency: 'high',
      impact: { loadReduction: 0.18, description: 'Drop ~18% load by shedding non-critical circuits' },
    },
    {
      id: 'ol-r2', label: 'Redistribute Load to C-Block', urgency: 'medium',
      impact: { loadReduction: 0.10, description: 'Transfer flexible loads to underutilised C-Block' },
    },
    {
      id: 'ol-r3', label: 'Raise HVAC Setpoint by 2°F', urgency: 'low',
      impact: { loadReduction: 0.05, description: 'Slightly relax cooling target to reduce HVAC draw' },
    },
  ],
  co2_critical: [
    {
      id: 'co2-r1', label: 'Enable Emergency Ventilation', urgency: 'high',
      impact: { co2Reduction: 230, description: 'Activate full fresh-air exchange cycle immediately' },
    },
    {
      id: 'co2-r2', label: 'Open Windows + Increase AHU Speed', urgency: 'medium',
      impact: { co2Reduction: 150, description: 'Open windows and ramp AHU to 140% for 20 min' },
    },
    {
      id: 'co2-r3', label: 'Reduce Occupancy — Vacate Lab', urgency: 'medium',
      impact: { co2Reduction: 180, description: 'Request partial evacuation to cut CO₂ production' },
    },
  ],
  temp_spike: [
    {
      id: 'ts-r1', label: 'Activate Cooling Boost Mode', urgency: 'high',
      impact: { tempReduction: 4.0, description: 'Run HVAC at 120% capacity for a 30-minute burst' },
    },
    {
      id: 'ts-r2', label: 'Lower AC Setpoint by 3°F', urgency: 'high',
      impact: { tempReduction: 2.5, description: 'Drop cooling setpoint to bring temperature down fast' },
    },
    {
      id: 'ts-r3', label: 'Close South-Facing Blinds', urgency: 'low',
      impact: { tempReduction: 1.0, description: 'Cut solar heat gain through south-facing windows' },
    },
  ],
  info_tip: [
    {
      id: 'it-r1', label: 'Schedule Load Shift', urgency: 'low',
      impact: { description: 'Move heavy loads to solar-peak window (11:00–15:00) for savings' },
    },
    {
      id: 'it-r2', label: 'Acknowledge & Monitor', urgency: 'low',
      impact: { description: 'Mark reviewed and continue live monitoring' },
    },
  ],
}

// ─── Detection rules ──────────────────────────────────────────────────────────
function detectAlerts(buildings, prevLoads) {
  const hour  = new Date().getHours()
  const found = []

  buildings.forEach(b => {
    const loadPct  = b.currentLoad / (b.capacity || 1)
    const prevLoad = prevLoads[b.id] ?? b.currentLoad
    const deltaPct = ((b.currentLoad - prevLoad) / Math.max(1, prevLoad)) * 100

    // 1 — Sudden energy spike (>8% jump in one tick)
    if (deltaPct > 8) {
      found.push({
        type: 'energy_spike', buildingId: b.id, building: b.name,
        severity: loadPct > 0.88 ? 'critical' : 'warning',
        title: `Energy spike — ${b.shortName ?? b.name}`,
        message: `Load surged +${Math.round(deltaPct)}% to ${b.currentLoad} kW (${Math.round(loadPct * 100)}% capacity).`,
        icon: 'zap',
      })
    }

    // 2 — Abnormal night usage (22:00–06:00, load > 55%)
    if ((hour >= 22 || hour < 6) && loadPct > 0.55) {
      found.push({
        type: 'night_usage', buildingId: b.id, building: b.name,
        severity: loadPct > 0.75 ? 'warning' : 'info',
        title: `Abnormal night usage — ${b.shortName ?? b.name}`,
        message: `${Math.round(loadPct * 100)}% load at ${String(hour).padStart(2, '0')}:00. Off-hours baseline should be <30%.`,
        icon: 'moon',
      })
    }

    // 3 — Overloaded building (>90% capacity)
    if (loadPct > 0.90) {
      found.push({
        type: 'overloaded', buildingId: b.id, building: b.name,
        severity: 'critical',
        title: `Overloaded — ${b.name}`,
        message: `${b.currentLoad} kW / ${b.capacity} kW (${Math.round(loadPct * 100)}%). Risk of breaker trip.`,
        icon: 'alert-triangle',
      })
    }

    // 4 — CO₂ critical (>980 ppm)
    if ((b.co2 ?? 0) > 980) {
      found.push({
        type: 'co2_critical', buildingId: b.id, building: b.name,
        severity: 'critical',
        title: `CO₂ critical — ${b.shortName ?? b.name}`,
        message: `${b.co2} ppm detected. Occupant safety threshold: 1000 ppm. Enable emergency ventilation.`,
        icon: 'wind',
      })
    }

    // 5 — High temperature (>77°F)
    if ((b.temperature ?? 0) > 77) {
      found.push({
        type: 'temp_spike', buildingId: b.id, building: b.name,
        severity: 'warning',
        title: `High temperature — ${b.shortName ?? b.name}`,
        message: `${b.temperature}°F — ${(b.temperature - 72).toFixed(1)}°F above setpoint. Check HVAC status.`,
        icon: 'thermometer',
      })
    }
  })

  return found
}

// ─── Info tip pool ────────────────────────────────────────────────────────────
const INFO_TIPS = [
  { title: 'Solar peak forecast',             message: 'Solar generation expected to peak at 110 kW between 11:00–15:00. Shift heavy loads to this window.', building: 'Campus Grid' },
  { title: 'Demand response opportunity',     message: 'Grid operator requesting 80 kW load reduction. Accept for ₹8,840 demand response credit.', building: 'Campus Grid' },
  { title: 'Maintenance window tonight',      message: 'HVAC units in B-Block scheduled for inspection at 23:00. Expect 8 kW load reduction during window.', building: 'B-Block' },
  { title: 'Efficiency record — Green Bldg',  message: 'Green Building achieved a 94/100 AI score this week — best on campus! Solar contribution: 22%.', building: 'Green Building' },
  { title: 'EV charging congestion',          message: '6 EV sessions active simultaneously near C-Block. Consider staggering to off-peak (23:00–05:00) for 18% savings.', building: 'C-Block' },
  { title: 'Pre-cooling recommendation',      message: 'Forecast shows 104°F tomorrow (South India summer). Pre-cool campus buildings to 72°F by 07:00 to reduce peak demand.', building: 'Campus Grid' },
  { title: 'Lab schedule alignment',          message: 'Mech & Civil Labs and A-Block can shift heavy-equipment runs to 10:00–15:00 solar peak window for 12% savings.', building: 'A-Block' },
]

// ─── Seed alerts (pre-populated on first load) ────────────────────────────────
function buildSeedAlerts() {
  const now = Date.now()
  const seeds = [
    {
      id: 'seed-1', type: 'overloaded', buildingId: 'ablock',
      building: 'A-Block', severity: 'warning',
      title: 'A-Block near capacity',
      message: '248 kW / 380 kW (65%). Server racks and workstations running at peak. Consider load redistribution.',
      icon: 'alert-triangle', ts: new Date(now - 2 * 60000), seen: false,
    },
    {
      id: 'seed-2', type: 'energy_spike', buildingId: 'mechlabs',
      building: 'Mech & Civil Labs', severity: 'warning',
      title: 'Energy spike — MECH',
      message: 'Load surged +10% to 318 kW (57% capacity). CNC machines and hydraulic presses running simultaneously.',
      icon: 'zap', ts: new Date(now - 8 * 60000), seen: false,
    },
    {
      id: 'seed-3', type: 'co2_critical', buildingId: 'bblock',
      building: 'B-Block', severity: 'warning',
      title: 'CO₂ elevated — B-BLK',
      message: '780 ppm detected in Chemistry Lab B-204. Approaching occupant comfort threshold. Increase ventilation.',
      icon: 'wind', ts: new Date(now - 12 * 60000), seen: false,
    },
    {
      id: 'seed-4', type: 'temp_spike', buildingId: 'ablock',
      building: 'A-Block', severity: 'warning',
      title: 'High temperature — A-BLK',
      message: '78°F — 6.0°F above comfort zone. Server room cooling under strain. Check HVAC Unit A-3.',
      icon: 'thermometer', ts: new Date(now - 18 * 60000), seen: true,
    },
    {
      id: 'seed-5', type: 'info_tip', buildingId: 'campus',
      building: 'Campus Grid', severity: 'info',
      title: 'Solar peak forecast',
      message: 'Solar generation expected to peak at 110 kW between 11:00–15:00. Shift heavy loads to this window.',
      icon: 'info', ts: new Date(now - 31 * 60000), seen: true,
    },
  ]
  // Attach recommendations and status to every seed alert
  return seeds.map(a => ({
    ...a,
    status: 'active',
    recommendations: RECOMMENDATIONS[a.type] ?? [],
  }))
}

let _uid = 100

// ─── Provider ─────────────────────────────────────────────────────────────────
// ─── Alert-rec → slider control mapping ──────────────────────────────────────
// When a user clicks "Simulate" on an alert rec, the corresponding control
// slider is pre-set in global simulation mode for a full-panel preview.
const REC_TO_CONTROLS = {
  'co2-r1': { ventilation: 95 },   // Emergency Ventilation
  'co2-r2': { ventilation: 85 },   // Open Windows + AHU
  'co2-r3': { ventilation: 82 },   // Reduce Occupancy
  'ts-r1':  { temperature: 18 },   // Cooling Boost Mode
  'ts-r2':  { temperature: 20 },   // Lower AC Setpoint
  'ts-r3':  { temperature: 23 },   // Close Blinds
  'es-r1':  { energyLoad: 65 },    // Power Saving Mode
  'es-r2':  { energyLoad: 70 },    // Disable Lighting
  'es-r3':  { energyLoad: 68 },    // Defer HVAC
  'ol-r1':  { energyLoad: 60 },    // Shed Non-Critical Load
  'ol-r2':  { energyLoad: 65 },    // Redistribute to C-Block
  'ol-r3':  { energyLoad: 72 },    // Raise HVAC Setpoint
  'nu-r1':  { energyLoad: 40 },    // Auto Shutoff
  'nu-r2':  { energyLoad: 65 },    // Minimal Lighting
}

export function AlertProvider({ children }) {
  const { buildings, updateBuilding, enableSimulation } = useEnergy()

  // Stable ref so the simulate callback ([] deps) always calls the latest fn
  const enableSimulationRef = useRef(enableSimulation)
  useEffect(() => { enableSimulationRef.current = enableSimulation }, [enableSimulation])
  const [alerts,            setAlerts]            = useState(buildSeedAlerts)
  const [toasts,            setToasts]            = useState([])
  const [simulationResults, setSimulationResults] = useState({}) // key: `${alertId}-${recId}`

  const buildingsRef = useRef(buildings)
  const alertsRef    = useRef(alerts)
  const prevLoadsRef = useRef({})
  const dedupeRef    = useRef({})
  const lastTipRef   = useRef(-1)

  // Keep refs current without re-mounting effects
  useEffect(() => { buildingsRef.current = buildings }, [buildings])
  useEffect(() => { alertsRef.current    = alerts    }, [alerts])

  // ── Auto-resolve: sliders bring conditions back to normal ──────────────────
  // Runs every time buildings update (5s tick). Marks active alerts resolved
  // when the building's live reading is back within safe range.
  useEffect(() => {
    const activeAlerts = alertsRef.current.filter(a => a.status === 'active')
    const toResolve = activeAlerts.filter(alert => {
      const b = buildings.find(b2 => b2.id === alert.buildingId)
      if (!b) return false
      if (alert.type === 'co2_critical' && (b.co2 ?? 999) < 950)           return true
      if (alert.type === 'temp_spike'   && (b.temperature ?? 80) < 76.5)   return true
      if (alert.type === 'overloaded'   && b.currentLoad / b.capacity < 0.85) return true
      return false
    })
    if (toResolve.length === 0) return

    const ids = new Set(toResolve.map(a => a.id))
    setAlerts(prev => prev.map(a =>
      ids.has(a.id) ? { ...a, status: 'resolved', seen: true } : a
    ))

    // Emit a quiet success toast for each auto-resolved alert
    toResolve.forEach(alert => {
      const toastId = `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const msgs = {
        co2_critical: `CO₂ levels normalised in ${alert.building} — ventilation working`,
        temp_spike:   `Temperature back to normal in ${alert.building} — setpoint reached`,
        overloaded:   `Load reduced in ${alert.building} — back within safe range`,
      }
      const toast = {
        id: toastId, severity: 'info', icon: 'info', type: 'info_tip',
        building: alert.building,
        title:   `Auto-resolved — ${alert.building}`,
        message: msgs[alert.type] ?? 'Condition normalised.',
        ts: new Date(), seen: true, status: 'resolved', recommendations: [],
      }
      setToasts(t => [toast, ...t].slice(0, 4))
      setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 6500)
    })
  }, [buildings])

  // ── Core: push a new alert ─────────────────────────────────────────────────
  const push = useCallback((alert) => {
    const id   = `alert-${Date.now()}-${++_uid}`
    const full = {
      ...alert,
      id,
      ts:              new Date(),
      seen:            false,
      status:          'active',
      recommendations: RECOMMENDATIONS[alert.type] ?? [],
    }

    setAlerts(prev => [full, ...prev].slice(0, 200))

    // Toast: max 4 stacked, auto-dismiss after 6.5 s
    setToasts(prev => [full, ...prev].slice(0, 4))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6500)
  }, [])

  // ── Toast controls ─────────────────────────────────────────────────────────
  const dismissToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  // ── Panel controls ─────────────────────────────────────────────────────────
  const dismissAlert = useCallback(id => setAlerts(prev => prev.filter(a => a.id !== id)), [])
  const markSeen     = useCallback(id => setAlerts(prev => prev.map(a => a.id === id ? { ...a, seen: true } : a)), [])
  const markAllSeen  = useCallback(() => setAlerts(prev => prev.map(a => ({ ...a, seen: true }))), [])
  const clearAll     = useCallback(() => setAlerts([]), [])

  // ── Decision Engine: simulate ──────────────────────────────────────────────
  // Computes a before/after preview for the chosen recommendation without
  // touching any real state — result is stored in simulationResults
  const simulate = useCallback((alertId, recId) => {
    const alert    = alertsRef.current.find(a => a.id === alertId)
    if (!alert) return
    const recs     = RECOMMENDATIONS[alert.type] ?? []
    const rec      = recs.find(r => r.id === recId)
    if (!rec) return
    const building = buildingsRef.current.find(b => b.id === alert.buildingId)
    if (!building) return

    const before = {
      load: building.currentLoad,
      co2:  building.co2  ?? 400,
      temp: building.temperature ?? 72,
    }
    const after = { ...before }
    if (rec.impact.loadReduction) after.load = Math.round(before.load * (1 - rec.impact.loadReduction))
    if (rec.impact.co2Reduction)  after.co2  = Math.max(400, Math.round(before.co2 - rec.impact.co2Reduction))
    if (rec.impact.tempReduction) after.temp = +( before.temp - rec.impact.tempReduction).toFixed(1)

    setSimulationResults(prev => ({
      ...prev,
      [`${alertId}-${recId}`]: { before, after, recLabel: rec.label },
    }))

    // Also engage global simulation mode so the ControlPanel shows the
    // predicted campus-wide impact of this recommendation
    const controlOverrides = REC_TO_CONTROLS[recId]
    if (controlOverrides) {
      enableSimulationRef.current?.(controlOverrides)
    }
  }, [])

  // ── Decision Engine: apply fix ─────────────────────────────────────────────
  // Commits recommendation changes to the building, marks alert resolved,
  // and emits a lightweight success toast (no new alert entry)
  const applyFix = useCallback((alertId, recId) => {
    const alert    = alertsRef.current.find(a => a.id === alertId)
    if (!alert) return
    const recs     = RECOMMENDATIONS[alert.type] ?? []
    const rec      = recs.find(r => r.id === recId)
    if (!rec) return
    const building = buildingsRef.current.find(b => b.id === alert.buildingId)
    if (!building) return

    // Compute changes
    const changes = {}
    if (rec.impact.loadReduction) changes.currentLoad  = Math.round(building.currentLoad * (1 - rec.impact.loadReduction))
    if (rec.impact.co2Reduction)  changes.co2          = Math.max(400, Math.round((building.co2 ?? 400) - rec.impact.co2Reduction))
    if (rec.impact.tempReduction) changes.temperature  = +((building.temperature ?? 72) - rec.impact.tempReduction).toFixed(1)

    if (Object.keys(changes).length > 0) updateBuilding(alert.buildingId, changes)

    // Mark alert resolved
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'resolved', seen: true } : a
    ))

    // Clean up simulation result for this rec
    setSimulationResults(prev => {
      const next = { ...prev }
      delete next[`${alertId}-${recId}`]
      return next
    })

    // Emit a success toast (direct, not via push so it doesn't create a new panel entry)
    const toastId = `fix-${Date.now()}`
    const successToast = {
      id:       toastId,
      type:     'info_tip',
      severity: 'info',
      icon:     'info',
      building: alert.building,
      title:    `Fix applied — ${alert.building}`,
      message:  `"${rec.label}" applied. ${rec.impact.description}.`,
      ts:       new Date(),
      seen:     true,
      status:   'resolved',
      recommendations: [],
    }
    setToasts(prev => [successToast, ...prev].slice(0, 4))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 6500)
  }, [updateBuilding])

  // ── Decision Engine: ignore alert ─────────────────────────────────────────
  const ignoreAlert = useCallback((alertId) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'ignored', seen: true } : a
    ))
  }, [])

  // ── Smart Actions: resolve all active alerts matching a type list ──────────
  // Used by the Quick Actions buttons (Optimize Energy, Improve Air, etc.)
  // so related alerts are cleared the moment the action is applied.
  const resolveAlertsByType = useCallback((types) => {
    const typeSet   = new Set(types)
    const toResolve = alertsRef.current.filter(
      a => a.status === 'active' && typeSet.has(a.type)
    )
    if (toResolve.length === 0) return

    const ids = new Set(toResolve.map(a => a.id))
    setAlerts(prev => prev.map(a =>
      ids.has(a.id) ? { ...a, status: 'resolved', seen: true } : a
    ))
  }, [])

  // ── Toast-only notification (no panel entry) ───────────────────────────────
  // Used by Smart Actions to show a confirmation without creating a new alert.
  const pushToast = useCallback((title, message, severity = 'info', icon = 'info') => {
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const toast = {
      id: toastId, type: 'info_tip', severity, icon,
      building: 'Smart Control', title, message,
      ts: new Date(), seen: true, status: 'resolved', recommendations: [],
    }
    setToasts(prev => [toast, ...prev].slice(0, 4))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 6500)
  }, [])

  // ── Detection loop (every 8 s) ─────────────────────────────────────────────
  useEffect(() => {
    const scan = () => {
      const blds     = buildingsRef.current
      const detected = detectAlerts(blds, prevLoadsRef.current)
      detected.forEach(alert => {
        const key       = `${alert.buildingId}-${alert.type}`
        const lastFired = dedupeRef.current[key] ?? 0
        const cooldown  = alert.severity === 'critical' ? 25_000 : 55_000
        if (Date.now() - lastFired > cooldown) {
          dedupeRef.current[key] = Date.now()
          push(alert)
        }
      })
      prevLoadsRef.current = Object.fromEntries(blds.map(b => [b.id, b.currentLoad]))
    }
    const iv = setInterval(scan, 8_000)
    return () => clearInterval(iv)
  }, [push])

  // ── Dedupe ref cleanup (every 5 min) ──────────────────────────────────────
  useEffect(() => {
    const cleanup = setInterval(() => {
      const maxAge = 5 * 60_000
      const now    = Date.now()
      Object.keys(dedupeRef.current).forEach(key => {
        if (now - dedupeRef.current[key] > maxAge) delete dedupeRef.current[key]
      })
    }, 5 * 60_000)
    return () => clearInterval(cleanup)
  }, [])

  // ── Info tips (random, every 40–80 s) ─────────────────────────────────────
  useEffect(() => {
    let timer

    const fireTip = () => {
      let idx
      do { idx = Math.floor(Math.random() * INFO_TIPS.length) }
      while (idx === lastTipRef.current && INFO_TIPS.length > 1)
      lastTipRef.current = idx
      push({
        ...INFO_TIPS[idx],
        buildingId: 'campus',
        type:       'info_tip',
        severity:   'info',
        icon:       'info',
      })
    }

    const schedule = () => {
      const delay = 40_000 + Math.random() * 40_000
      timer = setTimeout(() => { fireTip(); schedule() }, delay)
    }

    // First tip after 20 s
    timer = setTimeout(() => {
      lastTipRef.current = 0
      push({ ...INFO_TIPS[0], buildingId: 'campus', type: 'info_tip', severity: 'info', icon: 'info' })
      schedule()
    }, 20_000)

    return () => clearTimeout(timer)
  }, [push])

  const unseenCount = alerts.filter(a => !a.seen).length

  return (
    <AlertContext.Provider value={{
      alerts, toasts, unseenCount, simulationResults,
      push, dismissToast, dismissAlert, markSeen, markAllSeen, clearAll,
      simulate, applyFix, ignoreAlert, resolveAlertsByType, pushToast,
    }}>
      {children}
    </AlertContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlerts must be inside AlertProvider')
  return ctx
}
