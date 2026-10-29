import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  BUILDINGS,
  CAMPUS_METRICS,
  SYSTEM_INSIGHTS,
  generateDailyData,
  generateWeeklyData,
  generateMonthlyData,
} from '../utils/mockData'
import { detectAnomalies, calcEnergyScore } from '../utils/aiEngine'

const EnergyContext = createContext(null)

// Building-specific temperature offsets from setpoint (°F above the campus setpoint)
const TEMP_OFFSETS = {
  mechlabs:  6,   // heavy machinery = hottest
  ablock:    2,   // dense server racks
  cblock:    1,
  bblock:    1,
  stevejobs: 0,
  green:     -2,  // best insulation = coolest (b.id = 'green', not 'greenbldg')
}

export function EnergyProvider({ children }) {
  const [buildings, setBuildings]       = useState(BUILDINGS)
  const [metrics,   setMetrics]         = useState(CAMPUS_METRICS)
  const [dailyData, setDailyData]       = useState(generateDailyData)
  const [weeklyData]                    = useState(generateWeeklyData)
  const [monthlyData]                   = useState(generateMonthlyData)
  const [insights]                      = useState(SYSTEM_INSIGHTS)
  const [selectedBuilding, setSelected] = useState(null)
  const [liveMode, setLiveMode]         = useState(true)
  const [lastUpdated, setLastUpdated]   = useState(new Date())

  // ── Slider controls ────────────────────────────────────────────────────────
  // Stored in both state (for UI reactivity) and ref (so the tick closure
  // always reads the latest value without needing to remount the interval).
  const [controls, setControlsState] = useState({
    ventilation: 60,   // 0–100 %   → CO₂ effect
    temperature: 24,   // 16–32 °C  → temp + AC load
    energyLoad:  75,   // 0–100 %   → direct load multiplier
  })
  const controlsRef = useRef(controls)

  // ── Simulation mode ────────────────────────────────────────────────────────
  // When active, setControl routes changes to simulatedControls instead of
  // the real controls, so the live tick is never disturbed during a preview.
  const [simulationMode, setSimulationMode]         = useState(false)
  const [simulatedControls, setSimulatedControls]   = useState(null)
  const simulationModeRef = useRef(false)  // ref so setControl stays stable (no deps)

  // Routes to simulated or real state depending on mode
  const setControl = useCallback((key, val) => {
    if (simulationModeRef.current) {
      setSimulatedControls(prev => ({ ...(prev ?? controlsRef.current), [key]: val }))
    } else {
      controlsRef.current = { ...controlsRef.current, [key]: val }
      setControlsState(prev => ({ ...prev, [key]: val }))
    }
  }, [])  // stable — deliberately uses refs, no deps

  // Enable: snapshot real controls → simulatedControls, accept optional overrides
  const enableSimulation = useCallback((overrides = {}) => {
    const initial = { ...controlsRef.current, ...overrides }
    simulationModeRef.current = true
    setSimulatedControls(initial)
    setSimulationMode(true)
  }, [])

  // Apply: commit simulated → real, exit simulation
  const applySimulation = useCallback(() => {
    setSimulatedControls(prev => {
      if (prev) {
        controlsRef.current = { ...prev }
        setControlsState({ ...prev })
      }
      return null
    })
    simulationModeRef.current = false
    setSimulationMode(false)
  }, [])

  // Cancel: discard preview, exit simulation
  const cancelSimulation = useCallback(() => {
    simulationModeRef.current = false
    setSimulatedControls(null)
    setSimulationMode(false)
  }, [])

  const resetControls = useCallback(() => {
    const defaults = { ventilation: 60, temperature: 24, energyLoad: 75 }
    if (simulationModeRef.current) {
      setSimulatedControls(defaults)
    } else {
      controlsRef.current = defaults
      setControlsState(defaults)
    }
  }, [])

  // ── Live telemetry tick (every 5 s) ─────────────────────────────────────────
  useEffect(() => {
    if (!liveMode) return

    const interval = setInterval(() => {
      let freshTotal = 0

      setBuildings(prev => {
        const { ventilation, temperature, energyLoad } = controlsRef.current

        // ── Global load multiplier from controls ──────────────────────────────
        // energyLoad 75 → baseline (×1.0), lower → shed, higher → increase
        const loadMult   = energyLoad / 75
        // Temperature: each °C below 24 adds 2.5% AC load (colder setpoint = more energy)
        const tempMult   = 1 + (24 - temperature) * 0.025
        // Ventilation penalty: fans above 60% start drawing extra power
        const ventCost   = Math.max(0, ventilation - 60) * 0.0015
        // Combined — floor at 5% to prevent total blackout
        const globalMult = Math.max(0.05, loadMult * tempMult + ventCost)

        // ── Ventilation CO₂ bias ──────────────────────────────────────────────
        // At   0% vent → +8 ppm/tick drift bias (CO₂ rises)
        // At  60% vent →  0 ppm bias (neutral)
        // At 100% vent → −8 ppm/tick bias (CO₂ falls)
        const ventBias = (50 - ventilation) / 50 * 8

        // ── Temperature setpoint (°F) for campus ─────────────────────────────
        const setpointF = temperature * 9 / 5 + 32

        const next = prev.map(b => {
          // ── Load: lerp toward (baseLoad × globalMult) + small positive-biased drift ──
          // Drift range: −1.2 % … +1.8 % with slight upward bias so total consumption
          // rises smoothly rather than making abrupt random drops.
          const targetLoad   = b.baseLoad * globalMult
          const drift        = (Math.random() - 0.44) * 0.03
          const interpolated = b.currentLoad + (targetLoad - b.currentLoad) * 0.2
          const newLoad      = Math.max(50, Math.min(b.capacity, Math.round(interpolated * (1 + drift))))

          // ── CO₂: random walk + ventilation bias ─────────────────────────────
          const newCo2 = Math.max(380, Math.min(1200,
            b.co2 + Math.round((Math.random() - 0.5) * 15 + ventBias)
          ))

          // ── Temp: lerp toward setpoint + per-building offset ─────────────────
          const targetF = setpointF + (TEMP_OFFSETS[b.id] ?? 0)
          const newTemp = Math.max(65, Math.min(95,
            +(b.temperature + (targetF - b.temperature) * 0.12 + (Math.random() - 0.5) * 0.3).toFixed(1)
          ))

          return {
            ...b,
            currentLoad: newLoad,
            co2:         newCo2,
            temperature: newTemp,
            status:
              newLoad / b.capacity > 0.9  ? 'critical' :
              newLoad / b.capacity > 0.75 ? 'warning'  : 'normal',
          }
        })

        freshTotal = next.reduce((s, b) => s + b.currentLoad, 0)
        return next
      })

      setMetrics(prev => {
        const newTotal = Math.round(prev.totalConsumption * 0.2 + freshTotal * 0.8)

        // Single source of truth: Sync current hour's graph point with live counter
        const nowHour = new Date().getHours()
        setDailyData(history => {
          const next = [...history]
          if (next[nowHour]) {
            next[nowHour].actual = newTotal
          }
          return next
        })

        return {
          ...prev,
          totalConsumption: newTotal,
          solarGeneration:  Math.max(0, Math.round(prev.solarGeneration + (Math.random() - 0.5) * 15)),
          gridDraw:         Math.max(0, Math.round(prev.gridDraw         + (Math.random() - 0.5) * 20)),
        }
      })

      setLastUpdated(new Date())
    }, 5000)

    return () => clearInterval(interval)
  }, [liveMode])

  // ── Refresh chart data every 60 s ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setDailyData(generateDailyData()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getBuildingScore = useCallback(
    id => calcEnergyScore(buildings.find(b => b.id === id) ?? {}),
    [buildings],
  )

  const getBuildingAnomalies = useCallback(
    id => detectAnomalies(buildings.find(b => b.id === id) ?? {}),
    [buildings],
  )

  // ── Imperative building update (used by Alert Decision Engine) ───────────────
  const updateBuilding = useCallback((id, changes) => {
    setBuildings(prev => {
      const next = prev.map(b => {
        if (b.id !== id) return b
        const updated = { ...b, ...changes }
        const loadPct = updated.currentLoad / (updated.capacity || 1)
        updated.status = loadPct > 0.9 ? 'critical' : loadPct > 0.75 ? 'warning' : 'normal'
        return updated
      })
      const freshTotal = next.reduce((s, b) => s + b.currentLoad, 0)
      setMetrics(m => ({ ...m, totalConsumption: freshTotal }))
      return next
    })
  }, [])

  return (
    <EnergyContext.Provider
      value={{
        buildings,
        metrics,
        dailyData,
        weeklyData,
        monthlyData,
        insights,
        selectedBuilding,
        setSelectedBuilding: setSelected,
        liveMode,
        setLiveMode,
        lastUpdated,
        getBuildingScore,
        getBuildingAnomalies,
        updateBuilding,
        controls,
        setControl,
        resetControls,
        simulationMode,
        simulatedControls,
        enableSimulation,
        applySimulation,
        cancelSimulation,
      }}
    >
      {children}
    </EnergyContext.Provider>
  )
}

export function useEnergy() {
  const ctx = useContext(EnergyContext)
  if (!ctx) throw new Error('useEnergy must be used within EnergyProvider')
  return ctx
}
