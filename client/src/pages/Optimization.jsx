import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Sparkles, Zap, Clock, Sun, Wind, Lightbulb, ArrowRight,
  TrendingDown, IndianRupee, Leaf, ChevronDown, CheckCircle2,
  BarChart2, RefreshCw, Play, Building2, ArrowLeftRight,
  Target, Filter, AlertTriangle, Info,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RCTip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts'
import { useEnergy } from '../context/EnergyContext'
import { useCurrency } from '../context/CurrencyContext'
import { USD_TO_INR } from '../utils/currencyINR'
import {
  generateOptimizations, getOptimalSchedule, calcTotalSavings,
} from '../utils/optimizationEngine'
import clsx from 'clsx'

// ─── category config ──────────────────────────────────────────────────────────
const CAT = {
  load_redistribution: { label: 'Load Shift',  icon: ArrowLeftRight, color: '#7C3AED' },
  optimal_timing:      { label: 'Timing',       icon: Clock,          color: '#EA580C' },
  renewable:           { label: 'Renewable',    icon: Sun,            color: '#059669' },
  hvac:                { label: 'HVAC',         icon: Wind,           color: '#0284C7' },
  lighting:            { label: 'Lighting',     icon: Lightbulb,      color: '#EA580C' },
}

const PRI = {
  critical: { color: '#DB2777', bg: 'rgba(219,39,119,0.12)',  label: 'CRITICAL' },
  high:     { color: '#EA580C', bg: 'rgba(234,88,12,0.12)',  label: 'HIGH'     },
  medium:   { color: '#EA580C', bg: 'rgba(234,88,12,0.12)',  label: 'MEDIUM'   },
  low:      { color: '#0284C7', bg: 'rgba(2,132,199,0.10)',   label: 'LOW'      },
}

const RATE_COLOR = { peak: '#DB2777', mid: '#EA580C', off: '#059669' }

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimNum({ value, prefix = '', suffix = '', color, decimals = 0, className = '' }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  const raf  = useRef(null)
  useEffect(() => {
    const from = prev.current; const to = value; prev.current = to
    if (from === to) return
    const start = performance.now()
    const run = now => {
      const t = Math.min((now - start) / 600, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setDisplay(decimals ? +(from + (to - from) * e).toFixed(decimals) : Math.round(from + (to - from) * e))
      if (t < 1) raf.current = requestAnimationFrame(run)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf.current)
  }, [value, decimals])
  return (
    <span className={className} style={color ? { color } : {}}>
      {prefix}{typeof display === 'number' ? display.toLocaleString() : display}{suffix}
    </span>
  )
}

// ─── Recommendation card ──────────────────────────────────────────────────────
function RecCard({ rec, applied, onApply }) {
  const [open, setOpen]       = useState(false)
  const [applying, setApply]  = useState(false)
  const { format }            = useCurrency()
  const cat  = CAT[rec.category]  ?? CAT.hvac
  const pri  = PRI[rec.priority]  ?? PRI.medium
  const Icon = cat.icon

  function handleApply(e) {
    e.stopPropagation()
    setApply(true)
    setTimeout(() => { setApply(false); onApply(rec.id) }, 1200)
  }

  return (
    <div
      className={clsx(
        'rounded-2xl border transition-all duration-200',
        applied ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-black/10',
      )}
      style={{
        background: applied ? 'rgba(5,150,105,0.04)' : 'rgba(255,255,255,0.65)',
        borderColor: open ? `${cat.color}40` : 'rgba(0,0,0,0.08)',
        boxShadow: open ? `0 0 20px ${cat.color}12` : 'none',
      }}
      onClick={() => !applied && setOpen(o => !o)}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Category icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}>
          {applied
            ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
            : <Icon size={15} style={{ color: cat.color }} />}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="chip text-[9px] font-bold"
                style={{ background: `${cat.color}18`, color: cat.color }}>
                {cat.label}
              </span>
              <span className="chip text-[9px] font-bold"
                style={{ background: pri.bg, color: pri.color }}>
                {pri.label}
              </span>
              {rec.effort && (
                <span className="chip text-[9px]" style={{
                  background: rec.effort === 'auto' ? 'rgba(5,150,105,0.12)' : 'rgba(2,132,199,0.10)',
                  color: rec.effort === 'auto' ? '#059669' : '#0284C7',
                }}>
                  {rec.effort}
                </span>
              )}
            </div>

            {/* Savings highlights */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center gap-1 text-xs font-bold font-mono"
                style={{ color: '#059669' }}>
                <TrendingDown size={11} />−{rec.savingPct}%
              </span>
              <span className="text-xs font-bold font-mono"
                style={{ color: '#EA580C' }}>
                {format(rec.savingDay)}/day
              </span>
            </div>
          </div>

          <p className="text-gray-900 text-sm font-semibold leading-snug mt-1.5">{rec.title}</p>
          <p className="text-text-dim text-xs mt-1 leading-relaxed line-clamp-2">{rec.summary}</p>

          {/* Metrics row */}
          <div className="flex items-center gap-4 mt-2.5 flex-wrap text-[11px]">
            <span className="flex items-center gap-1" style={{ color: '#0284C7' }}>
              <Zap size={10} />
              {rec.savingKw} kW saved
            </span>
            <span className="flex items-center gap-1" style={{ color: '#059669' }}>
              <Leaf size={10} />
              {rec.savingCo2} kg CO₂/day
            </span>
            {rec.optimalWindow && (
              <span className="flex items-center gap-1 text-text-dim">
                <Clock size={10} />
                {rec.optimalWindow}
              </span>
            )}
            <span className="text-text-dim ml-auto">{rec.confidence}% confidence</span>
          </div>

          {/* Expanded detail */}
          {open && !applied && (
            <div className="mt-4 pt-4 border-t border-black/5 space-y-3 animate-fade-in">

              {/* From → To building */}
              {rec.fromBuilding && rec.toBuilding && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="px-2.5 py-1.5 rounded-lg border flex-shrink-0"
                    style={{ borderColor: 'rgba(219,39,119,0.3)', background: 'rgba(219,39,119,0.08)' }}>
                    <p className="text-text-dim text-[10px]">From</p>
                    <p className="text-gray-900 font-semibold">{rec.fromBuilding.shortName}</p>
                    <p className="text-[10px]" style={{ color: '#DB2777' }}>
                      {Math.round(rec.fromBuilding.currentLoad / rec.fromBuilding.capacity * 100)}% load
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-text-dim flex-shrink-0" />
                  <div className="px-2.5 py-1.5 rounded-lg border flex-shrink-0"
                    style={{ borderColor: 'rgba(5,150,105,0.3)', background: 'rgba(5,150,105,0.08)' }}>
                    <p className="text-text-dim text-[10px]">To</p>
                    <p className="text-gray-900 font-semibold">{rec.toBuilding.shortName}</p>
                    <p className="text-[10px]" style={{ color: '#059669' }}>
                      {Math.round(rec.toBuilding.currentLoad / rec.toBuilding.capacity * 100)}% load
                    </p>
                  </div>
                  <div className="flex-1 ml-2 text-xs text-text-dim">
                    Shift <span className="text-gray-900 font-bold">{rec.savingKw} kW</span> of non-critical load
                  </div>
                </div>
              )}

              {/* Actions checklist */}
              <div className="space-y-1.5">
                <p className="text-text-dim text-[10px] uppercase tracking-widest">Action steps</p>
                {rec.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-text-dim">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold mt-0.5"
                      style={{ borderColor: `${cat.color}50`, color: cat.color }}>
                      {i + 1}
                    </span>
                    {action}
                  </div>
                ))}
              </div>

              {/* Apply button */}
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: applying ? 'rgba(0,255,136,0.2)' : `${cat.color}22`,
                  border: `1px solid ${cat.color}40`,
                  color: applying ? '#00ff88' : cat.color,
                }}
              >
                {applying
                  ? <><div className="w-3.5 h-3.5 border-2 rounded-full border-t-transparent animate-spin" style={{ borderColor: '#059669', borderTopColor: 'transparent' }} />Applying…</>
                  : <><Play size={11} />Apply Recommendation</>
                }
              </button>
            </div>
          )}
        </div>

        <ChevronDown size={13} className={clsx('text-text-dim flex-shrink-0 mt-1 transition-transform', open && 'rotate-180')} />
      </div>
    </div>
  )
}

// ─── Schedule chart tooltip ───────────────────────────────────────────────────
function SchedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rate = payload[0]?.payload?.rate
  const rateColor = RATE_COLOR[rate] ?? '#64748B'
  return (
    <div className="glass-elevated rounded-xl px-3 py-2.5 border border-base-border text-xs space-y-1.5 min-w-[160px]">
      <p className="text-gray-900 font-semibold">{label}</p>
      <span className="chip text-[9px]" style={{ background: `${rateColor}20`, color: rateColor }}>
        {rate?.toUpperCase()} RATE
      </span>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.stroke ?? p.fill }}>{p.name}</span>
          <span className="text-gray-900 font-bold">{p.value?.toLocaleString()} kW</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Optimization() {
  const { buildings } = useEnergy()
  const { format, formatShort, symbol, currency } = useCurrency()
  const [filter,   setFilter]   = useState('all')
  const [applied,  setApplied]  = useState(new Set())
  const [refreshing, setRefresh] = useState(false)
  const [tick, setTick] = useState(0)

  // Recompute recommendations live (also when buildings change)
  const recs   = useMemo(() => generateOptimizations(buildings), [buildings, tick])
  const sched  = useMemo(() => getOptimalSchedule(), [tick])
  const totals = useMemo(() => calcTotalSavings(recs), [recs])

  const now = new Date().getHours()

  // Re-run engine every 30s to reflect live building drift
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])

  function refresh() {
    setRefresh(true)
    setTimeout(() => { setTick(t => t + 1); setRefresh(false) }, 800)
  }

  const filtered = filter === 'all' ? recs : recs.filter(r => r.category === filter)
  const critCount = recs.filter(r => r.priority === 'critical' || r.priority === 'high').length

  // Category filter tabs
  const CATS = [
    { key: 'all', label: 'All', count: recs.length },
    ...Object.entries(CAT).map(([key, { label }]) => ({
      key, label, count: recs.filter(r => r.category === key).length,
    })),
  ]

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-green/12 border border-accent-green/30 flex items-center justify-center">
              <Sparkles size={18} className="text-accent-green" />
            </div>
            Optimization Engine
          </h1>
          <p className="text-text-dim text-sm mt-1 ml-12">
            Rule-based AI · {recs.length} recommendations · refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {critCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold"
              style={{ background: 'rgba(234,88,12,0.12)', borderColor: 'rgba(234,88,12,0.30)', color: '#EA580C' }}>
              <AlertTriangle size={12} />
              {critCount} high-priority
            </div>
          )}
          <button onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-base-border text-xs text-text-dim hover:text-gray-900 transition-all">
            <RefreshCw size={12} className={clsx(refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary KPIs ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Reducible',  value: totals.totalKw,  suffix: ' kW',    color: '#0284C7', icon: Zap,         sub: `across ${recs.length} recommendations` },
          { label: `Daily Savings (${symbol})`, value: currency === 'USD' ? Math.round(totals.totalDay / USD_TO_INR) : totals.totalDay, prefix: symbol, color: '#EA580C', icon: IndianRupee, sub: 'if all applied' },
          { label: 'CO₂ Reduction',    value: totals.totalCo2, suffix: ' kg/day', color: '#059669', icon: Leaf,        sub: 'carbon avoided' },
          { label: 'Applied',          value: applied.size,    suffix: ' done',   color: '#7C3AED', icon: CheckCircle2,sub: `${recs.length - applied.size} remaining` },
        ].map(({ label, value, prefix = '', suffix = '', color, icon: Icon, sub }) => (
          <div key={label} className="glass rounded-xl border border-base-border p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-text-dim text-xxs">{label}</p>
              <p className="font-bold font-mono text-lg leading-tight" style={{ color }}>
                <AnimNum value={value} prefix={prefix} suffix={suffix} color={color} />
              </p>
              <p className="text-text-dim text-[10px]">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* ── LEFT: Recommendations ─────────────────────── xl:col-span-7 ─── */}
        <div className="xl:col-span-7 space-y-4">

          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {CATS.map(c => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
                  filter === c.key ? 'text-gray-900' : 'border-base-border text-text-dim hover:text-gray-900'
                )}
                style={filter === c.key ? {
                  borderColor: `${CAT[c.key]?.color ?? '#0284C7'}50`,
                  background:  `${CAT[c.key]?.color ?? '#0284C7'}15`,
                  color: CAT[c.key]?.color ?? '#0284C7',
                } : {}}
              >
                {c.key !== 'all' && (() => { const I = CAT[c.key]?.icon; return I ? <I size={11} /> : null })()}
                {c.label}
                <span className="opacity-60 text-[10px]">{c.count}</span>
              </button>
            ))}
          </div>

          {/* Recommendations list */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="glass rounded-2xl border border-base-border py-16 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 size={28} className="text-accent-green opacity-60" />
                <p className="text-gray-900 font-semibold">No recommendations in this category</p>
                <p className="text-text-dim text-sm">All systems in this area are operating optimally.</p>
              </div>
            ) : (
              filtered.map(rec => (
                <RecCard
                  key={rec.id}
                  rec={rec}
                  applied={applied.has(rec.id)}
                  onApply={id => setApplied(s => new Set([...s, id]))}
                />
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Charts ─────────────────────────────── xl:col-span-5 ─── */}
        <div className="xl:col-span-5 space-y-5">

          {/* 24-hour optimal schedule */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
              <div>
                <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
                  <Clock size={13} className="text-accent-blue" />
                  24h Optimal Schedule
                </h3>
                <p className="text-text-dim text-xs mt-0.5">Current vs recommended load profile</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {[
                  { color: '#64748B', label: 'Current',  dashed: false },
                  { color: '#059669', label: 'Optimal',  dashed: true  },
                  { color: '#EA580C', label: 'Solar',    dashed: false, opacity: 0.5 },
                ].map(({ color, label, dashed }) => (
                  <span key={label} className="flex items-center gap-1.5 text-text-dim">
                    <svg width="16" height="4">
                      {dashed
                        ? <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
                        : <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2" />
                      }
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Rate zone annotations */}
            <div className="flex gap-2 mb-3 text-[10px]">
              {[
                { label: 'Off-peak  · 00–09',  color: '#059669' },
                { label: 'On-peak · 09–17',    color: '#DB2777' },
                { label: 'Mid-peak · 17–22',   color: '#EA580C' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1 text-text-dim">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sched} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#64748B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#64748B" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gOptimal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#EA580C" stopOpacity={0.30} />
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                <RCTip content={<SchedTooltip />} />
                <ReferenceLine
                  x={sched[now]?.label}
                  stroke="#EA580C" strokeDasharray="4 3"
                  label={{ value: 'Now', fill: '#EA580C', fontSize: 9, dy: -5 }}
                />
                <Area type="monotone" dataKey="solar"   name="Solar"   stroke="#EA580C" strokeWidth={1}   fill="url(#gSolar)"   dot={false} />
                <Area type="monotone" dataKey="current" name="Current" stroke="#64748B" strokeWidth={1.5} fill="url(#gCurrent)" dot={false} />
                <Area type="monotone" dataKey="optimal" name="Optimal" stroke="#059669" strokeWidth={1.5} fill="url(#gOptimal)" dot={false} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>

            {/* Saving area annotation */}
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-text-dim">Potential daily saving:</span>
              <span className="font-bold font-mono" style={{ color: '#059669' }}>
                ~{Math.round(sched.reduce((s, h) => s + Math.max(0, h.current - h.optimal), 0))} kWh
              </span>
            </div>
          </div>

          {/* Savings by category bar chart */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <h3 className="text-gray-900 font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart2 size={13} className="text-accent-blue" />
              Savings by Category
            </h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart
                data={totals.byCategory.map(c => ({
                  name: CAT[c.cat]?.label ?? c.cat,
                  kW:   c.kw,
                  day:  c.day,
                  color: CAT[c.cat]?.color ?? '#6B7280',
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                <RCTip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div className="glass-elevated rounded-xl px-3 py-2 border border-base-border text-xs space-y-1">
                        <p className="text-gray-900 font-semibold">{label}</p>
                        <p style={{ color: d?.color }}>{d?.kW} kW reducible</p>
                        <p style={{ color: '#EA580C' }}>{format(d?.day ?? 0)}/day savings</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="kW" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {totals.byCategory.map((c, i) => (
                    <Cell key={i} fill={CAT[c.cat]?.color ?? '#6B7280'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Load redistribution matrix */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <h3 className="text-gray-900 font-semibold text-sm mb-3 flex items-center gap-2">
              <ArrowLeftRight size={13} className="text-accent-blue" />
              Building Load Map
            </h3>
            <div className="space-y-2">
              {[...buildings]
                .sort((a, b) => (b.currentLoad / b.capacity) - (a.currentLoad / a.capacity))
                .map(b => {
                  const pct   = b.currentLoad / b.capacity
                  const color = pct > 0.85 ? '#DB2777' : pct > 0.68 ? '#EA580C' : '#059669'
                  const label = pct > 0.85 ? 'Overloaded' : pct > 0.68 ? 'Elevated' : 'Headroom'
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className="text-text-dim text-[10px] font-mono w-10 flex-shrink-0">
                        {b.shortName ?? b.id.slice(0,3).toUpperCase()}
                      </span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.round(pct * 100)}%`, background: color, boxShadow: `0 0 5px ${color}60` }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold w-8 text-right flex-shrink-0" style={{ color }}>
                        {Math.round(pct * 100)}%
                      </span>
                      <span className="chip text-[9px] w-16 text-center flex-shrink-0"
                        style={{ background: `${color}15`, color }}>{label}</span>
                    </div>
                  )
                })}
            </div>
            <p className="text-text-dim text-[10px] mt-3">
              ↑ Drag loads from red → green buildings to balance the campus grid
            </p>
          </div>

          {/* Quick wins panel */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <h3 className="text-gray-900 font-semibold text-sm mb-3 flex items-center gap-2">
              <Target size={13} className="text-accent-orange" />
              Quick Wins <span className="text-text-dim text-xs font-normal ml-1">auto-applicable</span>
            </h3>
            <div className="space-y-2">
              {recs.filter(r => r.effort === 'auto').slice(0, 4).map(r => (
                <div key={r.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border"
                  style={{ background: 'rgba(0,255,136,0.04)', borderColor: 'rgba(0,255,136,0.15)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={12} className="text-accent-green flex-shrink-0" />
                    <span className="text-gray-900 text-xs truncate">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
                    <span className="font-bold font-mono" style={{ color: '#059669' }}>−{r.savingPct}%</span>
                    <span className="font-bold font-mono" style={{ color: '#EA580C' }}>{format(r.savingDay)}/d</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  const autoIds = recs.filter(r => r.effort === 'auto').map(r => r.id)
                  setApplied(s => new Set([...s, ...autoIds]))
                }}
                className="w-full mt-1 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ borderColor: 'rgba(5,150,105,0.30)', background: 'rgba(5,150,105,0.08)', color: '#059669' }}
              >
                <Play size={11} />
                Apply all auto recommendations
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
