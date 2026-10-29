import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  FlaskConical, RotateCcw, Thermometer, Users, Sun,
  Wind, Zap, Leaf, IndianRupee, Activity, Settings2,
  TrendingUp, TrendingDown, Minus, CheckCircle2,
  ArrowRight, BarChart2, Flame, ChevronRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RCTip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { useEnergy } from '../context/EnergyContext'
import { useCurrency } from '../context/CurrencyContext'
import { USD_TO_INR } from '../utils/currencyINR'
import clsx from 'clsx'

// ─── Physics simulation (instant, no delay) ───────────────────────────────────
function simulate(buildings, { acUsage, lightingLevel, occupancy, renewableInput }) {
  const totalCap = buildings.reduce((s, b) => s + (b.capacity ?? 500), 0)
  const renewGenTotal = (renewableInput / 100) * 700   // 700 kW max campus renewable

  const bldResults = buildings.map(b => {
    const base      = b.currentLoad ?? b.baseLoad ?? 300
    const cap       = b.capacity ?? 500
    const baseOcc   = b.occupancy ?? b.baseOccupancy ?? 75

    // Split baseline into HVAC / Lighting / Equipment fractions
    const hvacBase  = b.hvacLoad       ?? Math.round(base * 0.38)
    const lightBase = b.lightingLoad   ?? Math.round(base * 0.20)
    const equipBase = base - hvacBase - lightBase

    // Apply slider effects
    const hvacSim   = hvacBase  * (acUsage       / 100)
    const lightSim  = lightBase * (lightingLevel  / 100)
    const occFactor = Math.min(1.3, Math.max(0.05, occupancy / Math.max(1, baseOcc)))
    const equipSim  = equipBase * occFactor

    const rawSim    = Math.max(20, Math.round(hvacSim + lightSim + equipSim))

    // Renewable offset proportional to capacity share
    const renewShare = Math.round((cap / totalCap) * renewGenTotal)
    const simLoad   = Math.max(10, rawSim - renewShare)

    const delta     = simLoad - base
    const deltaPct  = Math.round((delta / Math.max(1, base)) * 100)
    const loadPct   = simLoad / cap
    const status    = loadPct > 0.88 ? 'critical' : loadPct > 0.72 ? 'warning' : 'normal'

    return {
      id: b.id, name: b.name,
      shortName: b.shortName ?? b.id.slice(0, 3).toUpperCase(),
      baseline: base, simulated: simLoad, delta, deltaPct, status,
      renewShare, cap,
    }
  })

  const totalBase  = bldResults.reduce((s, r) => s + r.baseline,  0)
  const totalSim   = bldResults.reduce((s, r) => s + r.simulated, 0)
  const totalRenew = Math.min(totalSim, Math.round(renewGenTotal))
  const gridDraw   = Math.max(0, totalSim - totalRenew)
  const renewPct   = Math.round((totalRenew / Math.max(1, totalSim)) * 100)

  // Cost: kW × ₹8.5/kWh (South Indian HT commercial tariff)
  const RATE = 8.5
  const costBase   = Math.round(totalBase * RATE)
  const costSim    = Math.round(totalSim  * RATE)
  const costSaved  = costBase - costSim

  // Carbon: grid kW × 0.82 kg CO₂/kWh (India CEA grid average)
  const carbonBase  = Math.round(totalBase * 0.82)
  const carbonSim   = Math.round(gridDraw  * 0.82)
  const carbonSaved = carbonBase - carbonSim

  // Efficiency score 0–100
  const score = Math.max(0, Math.min(100,
    Math.round(
      (1 - totalSim / Math.max(1, totalBase)) * 40 +   // energy reduction weight
      renewPct * 0.3 +                                  // renewable weight
      (carbonSaved / Math.max(1, carbonBase)) * 30      // carbon weight
    )
  ))

  return {
    buildings: bldResults,
    summary: {
      totalBase, totalSim,
      totalDelta: totalSim - totalBase,
      totalDeltaPct: Math.round(((totalSim - totalBase) / Math.max(1, totalBase)) * 100),
      totalRenew, gridDraw, renewPct,
      costBase, costSim, costSaved,
      carbonBase, carbonSim, carbonSaved,
      score,
    },
  }
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimNum({ value, decimals = 0, prefix = '', suffix = '', color }) {
  const [display, setDisplay] = useState(value)
  const prev  = useRef(value)
  const frame = useRef(null)

  useEffect(() => {
    const from = prev.current; const to = value
    prev.current = to
    if (from === to) return
    const start = performance.now()
    const run = now => {
      const t   = Math.min((now - start) / 500, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(decimals
        ? +(from + (to - from) * ease).toFixed(decimals)
        : Math.round(from + (to - from) * ease))
      if (t < 1) frame.current = requestAnimationFrame(run)
    }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame.current)
  }, [value, decimals])

  return (
    <span style={color ? { color } : {}}>
      {prefix}{typeof display === 'number' ? display.toLocaleString() : display}{suffix}
    </span>
  )
}

// ─── Slider with gradient track ───────────────────────────────────────────────
function Slider({ icon: Icon, label, unit, value, onChange, min, max, step = 1, color, hint }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `${color}18` }}>
            <Icon size={12} style={{ color }} />
          </div>
          <span className="text-gray-900 text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md"
          style={{ background: `${color}18`, color }}>
          {value}{unit}
        </span>
      </div>

      {/* Custom styled range */}
      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }} />
        {/* Filled portion */}
        <div className="absolute h-1.5 rounded-full transition-all duration-75"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}30`,
          }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 h-5 cursor-pointer"
          style={{ zIndex: 2 }}
        />
        {/* Thumb dot */}
        <div className="absolute w-4 h-4 rounded-full border-2 pointer-events-none transition-all duration-75"
          style={{
            left: `calc(${pct}% - 8px)`,
            borderColor: color,
            background: '#FFFFFF',
            boxShadow: `0 2px 10px ${color}40`,
            zIndex: 1,
          }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-text-dim">
        <span>{min}{unit}</span>
        {hint && <span className="opacity-60">{hint}</span>}
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

// ─── Before / After KPI card ──────────────────────────────────────────────────
function BACard({ icon: Icon, label, before, after, delta, unit, prefix = '', color, invert = false }) {
  const improved = invert ? delta > 0 : delta < 0
  const deltaColor = delta === 0 ? '#94A3B8' : improved ? '#059669' : '#DB2777'
  const DeltaIcon  = delta === 0 ? Minus : improved ? TrendingDown : TrendingUp

  return (
    <div className="glass rounded-2xl border border-base-border p-4 group relative transition-all duration-300 hover:shadow-lg hover:border-accent-blue/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={12} style={{ color }} />
        </div>
        <span className="text-text-dim text-[11px] font-medium truncate">{label}</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        {/* Before */}
        <div className="min-w-0 relative" title={`${before.toLocaleString()} ${unit}`}>
          <p className="text-[10px] text-text-dim mb-0.5">Baseline</p>
          <p className="text-sm font-bold font-mono text-gray-400 truncate group-hover:overflow-visible group-hover:whitespace-nowrap group-hover:z-10 group-hover:bg-white/90 group-hover:pr-2 transition-all">
            {prefix}{before.toLocaleString()}<span className="text-[10px] font-normal opacity-70 ml-0.5">{unit}</span>
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight size={14} className="text-text-dim mb-1.5 flex-shrink-0" />

        {/* After */}
        <div className="text-right min-w-0 relative" title={`${after.toLocaleString()} ${unit}`}>
          <p className="text-[10px] text-text-dim mb-0.5">Simulated</p>
          <p className="text-lg font-bold font-mono truncate group-hover:overflow-visible group-hover:whitespace-nowrap group-hover:z-10 group-hover:bg-white/90 group-hover:pl-2 transition-all" style={{ color }}>
            <AnimNum value={after} prefix={prefix} color={color} />
            <span className="text-[10px] font-normal opacity-80 ml-0.5">{unit}</span>
          </p>
        </div>
      </div>

      {/* Delta bar */}
      <div className="mt-3 flex items-center gap-2">
        <DeltaIcon size={11} style={{ color: deltaColor }} />
        <span className="text-xs font-bold font-mono" style={{ color: deltaColor }}>
          <AnimNum value={Math.abs(delta)} prefix={delta > 0 ? '+' : delta < 0 ? '−' : ''} suffix={unit} color={deltaColor} />
        </span>
        <span className="text-text-dim text-[10px] ml-auto">
          {delta === 0 ? 'No change' : improved ? 'improvement' : 'increase'}
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.abs(delta / Math.max(1, before)) * 100 * 3)}%`,
            background: `linear-gradient(90deg, ${deltaColor}60, ${deltaColor})`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Donut center label ───────────────────────────────────────────────────────
function DonutLabel({ viewBox, value, label, color }) {
  const { cx, cy } = viewBox
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize={22} fontWeight={700} fontFamily="monospace">
        {value}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748B" fontSize={10} fontFamily="Inter, sans-serif">
        {label}
      </text>
    </g>
  )
}

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = [
  { id: 'p1', name: 'Eco Mode',        emoji: '🌿', acUsage: 70,  lightingLevel: 60,  occupancy: 75,  renewableInput: 90,  color: '#059669' },
  { id: 'p2', name: 'Summer Peak',     emoji: '☀️', acUsage: 100, lightingLevel: 100, occupancy: 95,  renewableInput: 80,  color: '#EA580C' },
  { id: 'p3', name: 'Night Skeleton',  emoji: '🌙', acUsage: 30,  lightingLevel: 20,  occupancy: 10,  renewableInput: 5,   color: '#7C3AED' },
  { id: 'p4', name: 'Winter Storm',    emoji: '❄️', acUsage: 85,  lightingLevel: 95,  occupancy: 60,  renewableInput: 10,  color: '#0284C7' },
  { id: 'p5', name: 'Full Renewable',  emoji: '⚡', acUsage: 80,  lightingLevel: 85,  occupancy: 80,  renewableInput: 100, color: '#EA580C' },
]

const DEFAULTS = { acUsage: 100, lightingLevel: 100, occupancy: 75, renewableInput: 40 }

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SimulationLab() {
  const { buildings } = useEnergy()
  const { format, symbol, currency } = useCurrency()
  const [controls, setControls] = useState(DEFAULTS)
  const [activePreset, setActivePreset] = useState(null)

  const set = key => val => {
    setActivePreset(null)
    setControls(c => ({ ...c, [key]: val }))
  }

  function applyPreset(p) {
    setActivePreset(p.id)
    setControls({ acUsage: p.acUsage, lightingLevel: p.lightingLevel, occupancy: p.occupancy, renewableInput: p.renewableInput })
  }

  function reset() {
    setActivePreset(null)
    setControls(DEFAULTS)
  }

  // ── Live simulation (recalculates on every slider move) ──────────────────
  const sim = useMemo(() => simulate(buildings, controls), [buildings, controls])

  const { summary: s, buildings: simBlds } = sim

  // Chart data — grouped bars
  const barData = simBlds.map(b => ({
    name:      b.shortName,
    Baseline:  b.baseline,
    Simulated: b.simulated,
    status:    b.status,
  }))

  // Donut — energy source mix
  const donutData = [
    { name: 'Renewable', value: s.totalRenew,  color: '#059669' },
    { name: 'Grid',      value: s.gridDraw,    color: '#EA580C' },
  ]

  // Radar — impact breakdown
  const radarData = [
    { axis: 'Energy',   value: Math.max(0, Math.round((1 - s.totalSim  / Math.max(1, s.totalBase))  * 100 + 50)) },
    { axis: 'Cost',     value: Math.max(0, Math.round((1 - s.costSim   / Math.max(1, s.costBase))   * 100 + 50)) },
    { axis: 'Carbon',   value: Math.max(0, Math.round((1 - s.carbonSim / Math.max(1, s.carbonBase)) * 100 + 50)) },
    { axis: 'Renew.',   value: s.renewPct },
    { axis: 'Score',    value: s.score },
  ]

  // Efficiency score ring
  const RING_R = 44
  const RING_C = 2 * Math.PI * RING_R
  const scoreColor = s.score > 65 ? '#059669' : s.score > 40 ? '#EA580C' : '#DB2777'

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center">
              <FlaskConical size={18} className="text-accent-purple" />
            </div>
            Simulation Lab
          </h1>
          <p className="text-text-dim text-sm mt-1 ml-12">
            Drag sliders to model what-if scenarios — results update instantly
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-base-border text-xs text-text-dim">
          <Activity size={12} className="text-accent-purple" />
          <span className="text-text-dim text-xs font-mono ml-2 uppercase tracking-wide">Simulation Active</span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green ml-1" />
        </div>
      </div>

      {/* ── Preset chips ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
              activePreset === p.id
                ? 'text-gray-900'
                : 'border-base-border text-text-dim hover:text-gray-900'
            )}
            style={activePreset === p.id
              ? { borderColor: `${p.color}50`, background: `${p.color}15`, color: p.color }
              : {}}
          >
            <span>{p.emoji}</span>
            {p.name}
            {activePreset === p.id && <CheckCircle2 size={11} style={{ color: p.color }} />}
          </button>
        ))}
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-base-border text-text-dim hover:text-gray-900 text-xs transition-all ml-auto"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* ── LEFT: Sliders + Score ───────────────────────── xl:col-span-4 ─ */}
        <div className="xl:col-span-4 space-y-4">

          {/* Controls card */}
          <div className="glass rounded-2xl border border-base-border p-5 space-y-5">
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              <Settings2 size={14} className="text-accent-blue" />
              <span className="text-text-main font-bold">Scenario Parameters</span>
              <span className="text-text-dim text-[10px] font-normal ml-auto">Live · instant feedback</span>
            </h3>

            <Slider
              icon={Wind}
              label="AC / HVAC Usage"
              unit="%" min={0} max={100}
              value={controls.acUsage}
              onChange={set('acUsage')}
              color="#0284C7"
              hint="HVAC load factor"
            />
            <Slider
              icon={Zap}
              label="Lighting Level"
              unit="%" min={0} max={100}
              value={controls.lightingLevel}
              onChange={set('lightingLevel')}
              color="#EA580C"
              hint="smart dimming"
            />
            <Slider
              icon={Users}
              label="Campus Occupancy"
              unit="%" min={0} max={100}
              value={controls.occupancy}
              onChange={set('occupancy')}
              color="#7C3AED"
              hint="students + staff"
            />
            <Slider
              icon={Sun}
              label="Renewable Input"
              unit="%" min={0} max={100}
              value={controls.renewableInput}
              onChange={set('renewableInput')}
              color="#059669"
              hint="solar + wind"
            />
          </div>

          {/* Efficiency score ring */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <h3 className="text-gray-900 font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart2 size={14} className="text-accent-blue" />
              Scenario Score
            </h3>

            <div className="flex items-center gap-5">
              {/* Ring */}
              <div className="relative flex-shrink-0">
                <svg width={110} height={110} viewBox="0 0 110 110">
                  <circle cx={55} cy={55} r={RING_R} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={10} />
                  <circle
                    cx={55} cy={55} r={RING_R} fill="none"
                    stroke={scoreColor} strokeWidth={10}
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - s.score / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${scoreColor}90)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AnimNum value={s.score} color={scoreColor} />
                  <p className="text-[10px] text-text-dim">/ 100</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="flex-1 space-y-2">
                {[
                  { label: 'Energy',  val: Math.max(0, Math.round((1 - s.totalSim / Math.max(1, s.totalBase)) * 100)), color: '#0284C7' },
                  { label: 'Cost',    val: Math.max(0, Math.round((s.costSaved / Math.max(1, s.costBase)) * 100)),     color: '#EA580C' },
                  { label: 'Carbon',  val: Math.max(0, Math.round((s.carbonSaved / Math.max(1, s.carbonBase)) * 100)), color: '#059669' },
                  { label: 'Renew.',  val: s.renewPct,                                                                  color: '#7C3AED' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-text-dim text-[10px] w-10">{label}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, val)}%`, background: color, boxShadow: `0 0 4px ${color}80` }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>{val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Radar chart */}
          <div className="glass rounded-2xl border border-base-border p-4">
            <h3 className="text-gray-900 font-semibold text-sm mb-2 flex items-center gap-2">
              <Activity size={14} className="text-accent-blue" />
              Impact Radar
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="rgba(0,0,0,0.05)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#6B7280', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="#0284C7"
                  strokeWidth={1.5}
                  fill="#0284C7"
                  fillOpacity={0.12}
                  dot={{ fill: '#0284C7', r: 3 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── RIGHT: Before/After + Charts ──────────────── xl:col-span-8 ── */}
        <div className="xl:col-span-8 space-y-5">

          {/* ── Before / After KPI cards ───────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BACard
              icon={Zap}        label="Energy Load"
              before={s.totalBase}  after={s.totalSim}
              delta={s.totalDelta}  unit=" kW"
              color="#0284C7"
            />
            <BACard
              icon={IndianRupee} label={`Cost / Hour (${symbol})`}
              before={currency === 'USD' ? Math.round(s.costBase / USD_TO_INR) : s.costBase}
              after={currency === 'USD'  ? Math.round(s.costSim  / USD_TO_INR) : s.costSim}
              delta={currency === 'USD'  ? Math.round((s.costSim - s.costBase) / USD_TO_INR) : s.costSim - s.costBase}
              unit="/hr" prefix={symbol}
              color="#EA580C"
            />
            <BACard
              icon={Leaf}       label="Carbon"
              before={s.carbonBase} after={s.carbonSim}
              delta={s.carbonSim - s.carbonBase}  unit=" kg/hr"
              color="#059669"
            />
            <BACard
              icon={Sun}        label="Renewables"
              before={40}           after={s.renewPct}
              delta={s.renewPct - 40}  unit="%"
              color="#7C3AED"   invert
            />
          </div>

          {/* ── Savings summary banner ─────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
            style={{
              background: '#F9FAFB',
              border: '1px solid rgba(0,255,136,0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center">
                <Leaf size={18} className="text-accent-green" />
              </div>
              <div>
                <p className="text-gray-900 font-bold text-sm">Projected Savings vs Baseline</p>
                <p className="text-text-dim text-xs mt-0.5">Applying all scenario parameters campus-wide</p>
              </div>
            </div>
            <div className="flex gap-5 flex-wrap">
              {[
                { label: 'Energy saved',  value: `${Math.abs(s.totalDelta)} kW`,         color: '#0284C7' },
                { label: 'Cost saved',    value: `${format(Math.abs(s.costSaved))}/hr`, color: '#EA580C' },
                { label: 'CO₂ reduced',   value: `${Math.abs(s.carbonSaved)} kg/hr`,      color: '#059669' },
                { label: 'Renewable',     value: `${s.renewPct}% of load`,               color: '#7C3AED' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] text-text-dim">{label}</p>
                  <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Grouped bar chart: Baseline vs Simulated ──────────────────── */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-gray-900 font-semibold text-sm">Building Load — Before vs After</h3>
                <p className="text-text-dim text-xs mt-0.5">
                  Total delta:{' '}
                  <span className="font-bold" style={{ color: s.totalDelta <= 0 ? '#059669' : '#DB2777' }}>
                    {s.totalDelta > 0 ? '+' : ''}{s.totalDelta} kW
                    ({s.totalDeltaPct > 0 ? '+' : ''}{s.totalDeltaPct}%)
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                {[
                  { color: '#64748B', label: 'Baseline' },
                  { color: '#0284C7', label: 'Simulated' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-text-dim">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }} barGap={3} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RCTip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const b = simBlds.find(b => b.shortName === label)
                    return (
                      <div className="glass-elevated rounded-xl px-3 py-2.5 border border-base-border text-xs space-y-1.5">
                        <p className="text-gray-900 font-semibold">{b?.name ?? label}</p>
                        {payload.map(p => (
                          <div key={p.dataKey} className="flex justify-between gap-4">
                            <span style={{ color: p.fill }}>{p.name}</span>
                            <span className="text-gray-900 font-bold">{p.value} kW</span>
                          </div>
                        ))}
                        {b && (
                          <p className="font-bold border-t border-base-border pt-1"
                            style={{ color: b.delta <= 0 ? '#059669' : '#DB2777' }}>
                            Δ {b.delta > 0 ? '+' : ''}{b.delta} kW ({b.deltaPct > 0 ? '+' : ''}{b.deltaPct}%)
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="Baseline"  fill="rgba(107,140,186,0.45)" radius={[3,3,0,0]} maxBarSize={28} />
                <Bar dataKey="Simulated" radius={[3,3,0,0]} maxBarSize={28}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.status === 'critical' ? '#DB2777'
                      : entry.status === 'warning'  ? '#EA580C'
                      : '#0284C7'
                    } fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Bottom row: Donut + Per-building table ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Donut: energy source mix */}
            <div className="lg:col-span-2 glass rounded-2xl border border-base-border p-5">
              <h3 className="text-gray-900 font-semibold text-sm mb-4 flex items-center gap-2">
                <Sun size={14} className="text-accent-green" />
                Energy Mix
              </h3>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive
                    labelLine={false}
                  >
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.color} stroke="none"
                        style={{ filter: `drop-shadow(0 0 6px ${d.color}70)` }} />
                    ))}
                    <DonutLabel
                      value={s.renewPct}
                      label="renewable"
                      color="#059669"
                    />
                  </Pie>
                  <RCTip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="glass-elevated rounded-lg px-3 py-2 border border-base-border text-xs">
                          <span style={{ color: payload[0].payload.color }}>{payload[0].name}: </span>
                          <span className="text-gray-900 font-bold">{payload[0].value} kW</span>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs">
                {donutData.map(d => (
                  <span key={d.name} className="flex items-center gap-1.5 text-text-dim">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.color }} />
                    {d.name}: <span className="text-gray-900 font-mono font-bold ml-0.5">{d.value} kW</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Per-building table */}
            <div className="lg:col-span-3 glass rounded-2xl border border-base-border p-5">
              <h3 className="text-gray-900 font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart2 size={14} className="text-accent-blue" />
                Building Results
              </h3>
              <div className="space-y-1.5 overflow-y-auto max-h-[190px] pr-0.5">
                {simBlds.map(b => {
                  const sc = b.status === 'critical' ? '#DB2777' : b.status === 'warning' ? '#EA580C' : '#059669'
                  const DI = b.delta > 0 ? TrendingUp : b.delta < 0 ? TrendingDown : Minus
                  return (
                    <div key={b.id} className="flex items-center gap-3 py-1.5 border-b border-base-border/40 last:border-0">
                      <span className="text-text-dim text-[10px] font-mono w-10 flex-shrink-0">{b.shortName}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (b.simulated / b.cap) * 100)}%`, background: sc }} />
                      </div>
                      <span className="text-gray-900 text-[11px] font-mono font-bold w-16 text-right flex-shrink-0">
                        {b.simulated} kW
                      </span>
                      <span className="flex items-center gap-0.5 text-[11px] font-bold w-14 justify-end flex-shrink-0"
                        style={{ color: b.delta <= 0 ? '#059669' : '#DB2777' }}>
                        <DI size={9} />
                        {b.deltaPct > 0 ? '+' : ''}{b.deltaPct}%
                      </span>
                      <span className="chip text-[9px] w-12 text-center flex-shrink-0"
                        style={{ background: `${sc}18`, color: sc }}>{b.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
