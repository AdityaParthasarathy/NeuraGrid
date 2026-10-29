import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
  AreaChart, BarChart, Bar, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, AlertTriangle, Zap, Sun, Clock, Brain,
  Activity, ChevronRight, ThermometerSun, Users, History,
  Wind, Target, Cpu, Info, BarChart3, Sparkles, RefreshCw,
  ArrowUpRight, ArrowDownRight, Calendar,
} from 'lucide-react'
import { useEnergy } from '../context/EnergyContext'
import { useCurrency } from '../context/CurrencyContext'
import {
  generate24hForecast,
  buildingForecasts,
  detectPeakWindows,
  getBestDeferralWindows,
  getModelFactors,
  getForecastSummary,
  RISK_META,
} from '../utils/predictiveEngine'
import clsx from 'clsx'

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimNum({ value, decimals = 0, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const start = display
    const end   = value
    const dur   = 700
    const t0    = performance.now()
    cancelAnimationFrame(ref.current)
    function step(now) {
      const p   = Math.min(1, (now - t0) / dur)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(start + (end - start) * ease)
      if (p < 1) ref.current = requestAnimationFrame(step)
    }
    ref.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(ref.current)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = display.toFixed(decimals)
  return <>{prefix}{Number(fmt).toLocaleString()}{suffix}</>
}

// ─── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ risk, small = false }) {
  const meta = RISK_META[risk] ?? RISK_META.low
  return (
    <span
      className={clsx('inline-flex items-center font-bold uppercase tracking-wide rounded-md', small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5')}
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  )
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function ForecastTooltip({ active, payload, label }) {
  const { format } = useCurrency()
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  const meta = RISK_META[d.risk] ?? RISK_META.low
  return (
    <div className="glass-elevated rounded-xl border border-dark-border p-3 text-xs space-y-2 min-w-[200px]">
      <div className="flex items-center justify-between">
        <span className="text-gray-900 font-mono font-bold text-sm">{d.label}</span>
        <RiskBadge risk={d.risk} small />
      </div>
      <div className="border-t border-base-border/60 pt-2 space-y-1.5">
        <Row label="Predicted Load" value={`${(d.netPredicted ?? 0).toLocaleString()} kW`} color="#0284C7" />
        <Row label="Confidence Band" value={`${(d.netLower ?? 0).toLocaleString()} – ${(d.netUpper ?? 0).toLocaleString()} kW`} color="#0284C7" dim />
        <Row label="Solar Offset"    value={`−${(d.solar ?? 0)} kW`}    color="#059669" />
        <Row label="Yesterday"       value={`${(d.historical ?? 0).toLocaleString()} kW`} color="#64748B" />
        <Row label="Outdoor Temp"    value={`${d.temp ?? '—'}°F`}         color="#EA580C" />
        <Row label="Est. Cost"       value={`${format(d.predictedCost ?? 0)}/h`}  color="#EA580C" />
      </div>
      <div className="border-t border-base-border/60 pt-1.5">
        <div className="flex items-center justify-between">
          <span className="text-text-dim">Model confidence</span>
          <span className="text-gray-900 font-bold">{d.confidence ?? '—'}%</span>
        </div>
      </div>
    </div>
  )
}
function Row({ label, value, color, dim }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-dim">{label}</span>
      <span className={clsx('font-mono font-bold', dim && 'opacity-60')} style={{ color }}>{value}</span>
    </div>
  )
}

// ─── Building sparkline card ──────────────────────────────────────────────────
function BuildingForecastCard({ bf }) {
  const currentHour = new Date().getHours()
  const peakRisk    = bf.peakPt?.risk ?? 'low'
  const meta        = RISK_META[peakRisk]
  const loadPct     = Math.round((bf.currentLoad / bf.capacity) * 100)

  return (
    <div className="glass rounded-2xl border border-base-border p-4 flex flex-col gap-3 hover:border-accent-blue/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold font-mono px-2 py-0.5 rounded"
              style={{ background: `${bf.color}20`, color: bf.color, border: `1px solid ${bf.color}30` }}
            >
              {bf.shortName}
            </span>
            <RiskBadge risk={peakRisk} small />
          </div>
          <p className="text-gray-900 text-sm font-medium mt-1 leading-tight">{bf.name}</p>
        </div>
        <div className="text-right">
          <p className="text-text-dim text-xxs">Peak forecast</p>
          <p className="text-gray-900 font-bold font-mono text-sm">{(bf.peakPt?.net ?? 0).toLocaleString()} kW</p>
          <p className="text-text-dim text-xxs">{bf.peakPt?.label}</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={bf.points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${bf.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={bf.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={bf.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/* Risk zone highlights */}
            {bf.points.filter(p => p.risk !== 'low').map(p => (
              <ReferenceArea
                key={p.hour}
                x1={p.hour}
                x2={Math.min(23, p.hour + 1)}
                fill={RISK_META[p.risk]?.bg ?? 'transparent'}
                strokeOpacity={0}
              />
            ))}
            <XAxis dataKey="hour" type="number" domain={[0, 23]} hide />
            <YAxis domain={['auto', 'auto']} hide />
            <ReferenceLine x={currentHour} stroke="rgba(0,0,0,0.1)" strokeWidth={1} strokeDasharray="2 2" />
            <Area
              dataKey="net"
              stroke={bf.color}
              strokeWidth={1.5}
              fill={`url(#spark-${bf.id})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xxs">
        <span className="text-text-dim">Current load</span>
        <div className="flex items-center gap-2">
              <div className="metric-bar w-16">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${loadPct}%`,
                    background: loadPct > 90 ? '#DB2777' : loadPct > 75 ? '#EA580C' : bf.color,
                  }}
                />
              </div>
          <span className="text-gray-900 font-mono font-bold">{loadPct}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Peak window card ─────────────────────────────────────────────────────────
function PeakWindowCard({ w }) {
  return (
    <div
      className="rounded-xl p-3 border flex flex-col gap-2"
      style={{ background: w.bg, borderColor: w.border }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} style={{ color: w.color }} />
          <span className="text-gray-900 text-xs font-bold">{w.startLabel} – {w.endLabel}</span>
        </div>
        <RiskBadge risk={w.risk} small />
      </div>
      <div className="flex items-center gap-3 text-xxs">
        <span style={{ color: w.color }} className="font-mono font-bold">{w.peakRiskPct}% capacity</span>
        <span className="text-text-dim">·</span>
        <span className="text-text-dim">{w.duration}h window</span>
        <span className="text-text-dim">·</span>
        <span className="text-text-dim">{w.confidence}% confident</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {w.reasons.map(r => (
          <span key={r} className="text-xxs text-text-dim bg-base-elevated px-1.5 py-0.5 rounded">{r}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Model factor bar ─────────────────────────────────────────────────────────
function FactorBar({ f }) {
  const icons = {
    clock:       <Clock size={13} />,
    users:       <Users size={13} />,
    history:     <History size={13} />,
    thermometer: <ThermometerSun size={13} />,
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: f.color }}>
          {icons[f.icon]}
          <span className="text-xs font-medium text-gray-900">{f.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xxs text-text-dim">{f.weight}% weight</span>
          <span className="font-mono text-xs font-bold" style={{ color: f.color }}>
            {f.value}<span className="text-text-dim text-xxs ml-0.5">{f.unit}</span>
          </span>
        </div>
      </div>
      <div className="metric-bar">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, f.value)}%`, background: f.color }}
        />
      </div>
      <p className="text-text-dim text-xxs leading-snug">{f.description}</p>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function PredictiveAnalytics() {
  const { buildings, liveMode } = useEnergy()
  const { format, formatRate, symbol } = useCurrency()
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [refreshing,  setRefreshing]  = useState(false)
  const currentHour = new Date().getHours()

  // Recompute every 30s to keep calibration fresh
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!liveMode) return
    const iv = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(iv)
  }, [liveMode])

  // ── Computed data (memoised — stable across live telemetry drift) ──────────
  const forecast     = useMemo(() => generate24hForecast(buildings), [buildings, tick])
  const bForecasts   = useMemo(() => buildingForecasts(buildings),   [buildings, tick])
  const peakWindows  = useMemo(() => detectPeakWindows(forecast),    [forecast])
  const deferWindows = useMemo(() => getBestDeferralWindows(forecast),[forecast])
  const factors      = useMemo(() => getModelFactors(buildings),      [buildings])
  const summary      = useMemo(() => getForecastSummary(forecast),    [forecast])
  const totalCap     = useMemo(() => buildings.reduce((s, b) => s + (b.capacity ?? 500), 0), [buildings])

  // Savings bar chart data for risk distribution
  const riskDist = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    forecast.filter(p => !p.isPast).forEach(p => { counts[p.risk]++ })
    return [
      { name: 'Critical', value: counts.critical, color: '#DB2777' },
      { name: 'High',     value: counts.high,     color: '#EA580C' },
      { name: 'Medium',   value: counts.medium,   color: '#EA580C' },
      { name: 'Normal',   value: counts.low,       color: '#059669' },
    ]
  }, [forecast])

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => {
      setTick(t => t + 1)
      setLastRefresh(new Date())
      setRefreshing(false)
    }, 800)
  }

  const nowLabel = `${String(currentHour).padStart(2, '0')}:00`

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={20} className="text-accent-blue" />
            <h1 className="text-2xl font-bold text-gray-900">Predictive Analytics</h1>
          </div>
          <p className="text-text-dim text-sm">
            AI-simulated 24-hour energy forecast · Multi-factor model · Peak risk detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-dim text-xs font-mono hidden sm:block">
            Refreshed {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              'border-base-border bg-base-elevated text-text-dim hover:text-text-main hover:border-accent-blue/30'
            )}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh Model
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: TrendingUp, label: 'Forecast Peak',
            value: <><AnimNum value={summary.peakPoint?.netPredicted ?? 0} /> kW</>,
            sub:   `at ${summary.peakPoint?.label ?? '—'}`,
            color: '#EA580C',
          },
          {
            icon: AlertTriangle, label: 'At-Risk Hours',
            value: <><AnimNum value={summary.riskHours} /> hrs</>,
            sub:   `out of ${24 - currentHour} remaining`,
            color: summary.riskHours > 3 ? '#DB2777' : summary.riskHours > 1 ? '#EA580C' : '#059669',
          },
          {
            icon: Sun, label: 'Solar Offset',
            value: <><AnimNum value={summary.solar24} /> kWh</>,
            sub:   "today's total PV generation",
            color: '#00ff88',
          },
          {
            icon: Cpu, label: 'Model Accuracy',
            value: <><AnimNum value={summary.avgConfidence} />%</>,
            sub:   'average prediction confidence',
            color: '#7C3AED',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="glass rounded-xl border border-base-border p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}
            >
              <Icon size={18} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-text-dim text-xxs truncate">{label}</p>
              <p className="text-gray-900 font-bold font-mono text-base mt-0.5" style={{ color }}>{value}</p>
              <p className="text-text-dim text-xxs truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 24h Forecast Chart ──────────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-base-border p-5">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
          <div>
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              <Activity size={14} className="text-accent-blue" />
              24-Hour Energy Forecast
            </h3>
            <p className="text-text-dim text-xs mt-0.5">
              Predicted net campus load · Confidence band · Solar offset · Peak risk zones highlighted
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center flex-wrap gap-3 text-xxs text-text-dim">
            {[
              { color: '#0284C7', label: 'Predicted Load', dash: false },
              { color: '#64748B', label: 'Yesterday',      dash: true  },
              { color: '#059669', label: 'Solar',          dash: false },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className="relative w-6 h-px" style={{ display: 'inline-block' }}>
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: l.color,
                      opacity: l.dash ? 0.5 : 1,
                      backgroundImage: l.dash ? `repeating-linear-gradient(90deg,${l.color} 0,${l.color} 4px,transparent 4px,transparent 8px)` : undefined,
                    }}
                  />
                </span>
                {l.label}
              </span>
            ))}
            {['critical', 'high', 'medium'].map(r => (
              <span key={r} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: RISK_META[r].color, opacity: 0.7 }} />
                {RISK_META[r].label}
              </span>
            ))}
          </div>
        </div>

        <div className="h-[320px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecast} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0284C7" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0284C7" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#059669" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.03} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />

              {/* ── Risk zone vertical bands (per risky hour) ── */}
              {forecast.filter(p => p.risk !== 'low').map(p => (
                <ReferenceArea
                  key={p.hour}
                  x1={p.hour}
                  x2={Math.min(23, p.hour + 0.95)}
                  fill={RISK_META[p.risk].bg}
                  strokeOpacity={0}
                />
              ))}

              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, 23]}
                ticks={[0, 3, 6, 9, 12, 15, 18, 21, 23]}
                tickFormatter={h => `${String(h).padStart(2, '0')}:00`}
                tick={{ fill: '#6B7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
                domain={[0, totalCap * 1.05]}
              />
              <Tooltip content={<ForecastTooltip />} />

              {/* ── Capacity reference lines ── */}
              <ReferenceLine y={totalCap * 0.90} stroke="#DB2777" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="4 4" label={{ value: '90% cap', fill: '#DB2777', fontSize: 9, position: 'insideTopRight' }} />
              <ReferenceLine y={totalCap * 0.75} stroke="#EA580C" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 4" label={{ value: '75% cap', fill: '#EA580C', fontSize: 9, position: 'insideTopRight' }} />

              {/* ── Confidence upper band ── */}
              <Area
                dataKey="upper"
                stroke="#0284C7"
                strokeWidth={0.6}
                strokeOpacity={0.25}
                strokeDasharray="3 4"
                fill="url(#confGrad)"
                dot={false}
                name="Upper bound"
                legendType="none"
                isAnimationActive={false}
              />

              {/* ── Solar generation (bottom area) ── */}
              <Area
                dataKey="solar"
                stroke="#059669"
                strokeWidth={1.2}
                fill="url(#solarGrad)"
                dot={false}
                name="Solar"
                legendType="none"
                isAnimationActive={false}
              />

              {/* ── Historical (yesterday) ── */}
              <Line
                dataKey="historical"
                stroke="#64748B"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                name="Yesterday"
                legendType="none"
                isAnimationActive={false}
              />

              {/* ── Net predicted load (main line) ── */}
              <Area
                dataKey="netPredicted"
                stroke="#0284C7"
                strokeWidth={2.5}
                fill="url(#predGrad)"
                dot={false}
                name="Predicted Load"
                activeDot={{ r: 5, fill: '#0284C7', strokeWidth: 0 }}
                legendType="none"
                isAnimationActive={false}
              />

              {/* ── Lower confidence bound ── */}
              <Line
                dataKey="netLower"
                stroke="#0284C7"
                strokeWidth={0.6}
                strokeOpacity={0.25}
                strokeDasharray="2 5"
                dot={false}
                name="Lower bound"
                legendType="none"
                isAnimationActive={false}
              />

              {/* ── NOW reference line ── */}
              <ReferenceLine
                x={currentHour}
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{ value: 'NOW ▼', fill: '#1E293B', fontSize: 9, position: 'insideTopLeft' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Hour risk strip */}
        <div className="mt-3 flex gap-px">
          {forecast.map(p => (
            <div
              key={p.hour}
              title={`${p.label} — ${RISK_META[p.risk]?.label}`}
              className="flex-1 h-1.5 rounded-sm cursor-default transition-opacity hover:opacity-80"
              style={{
                background: RISK_META[p.risk]?.color ?? '#059669',
                opacity:    p.isPast ? 0.3 : p.risk === 'low' ? 0.4 : 0.85,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xxs text-text-dim mt-1 px-0.5">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
        </div>
      </div>

      {/* ── Middle row: Model Factors | Peak Risk + Deferral ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Model Factors */}
        <div className="xl:col-span-2 glass rounded-2xl border border-base-border p-5 space-y-5">
          <div>
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              <Cpu size={14} className="text-accent-purple" />
              Model Factors
            </h3>
            <p className="text-text-dim text-xs mt-0.5">How the AI weights each input for this forecast</p>
          </div>
          <div className="space-y-4">
            {factors.map(f => <FactorBar key={f.name} f={f} />)}
          </div>
          {/* Model info */}
          <div className="rounded-xl border border-base-border/60 bg-base-elevated/40 p-3 text-xxs text-text-dim space-y-1">
            <div className="flex items-center gap-1.5 text-accent-blue mb-1.5">
              <Info size={11} />
              <span className="font-medium text-xs">About this model</span>
            </div>
            <p>Rule-based multi-factor regression calibrated to live telemetry. Predictions anchor to current load and project forward using learned campus load shapes.</p>
            <p className="text-text-dim/70 mt-1">No external data sources. Confidence degrades ~1.5% per hour of lookahead.</p>
          </div>
        </div>

        {/* Peak Risk Windows + Deferral */}
        <div className="xl:col-span-3 space-y-5">

          {/* Peak Risk Windows */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-accent-orange" />
              Peak Risk Windows
              {peakWindows.length > 0 && (
                <span className="chip bg-accent-pink/15 text-accent-pink border border-accent-pink/25 ml-auto">
                  {peakWindows.length} detected
                </span>
              )}
            </h3>
            {peakWindows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                  <Sparkles size={18} className="text-accent-green" />
                </div>
                <p className="text-gray-900 text-sm font-medium">No risk windows detected</p>
                <p className="text-text-dim text-xs">All forecast hours are within normal operating range.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {peakWindows.map((w, i) => <PeakWindowCard key={i} w={w} />)}
              </div>
            )}
          </div>

          {/* Best Deferral Windows */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2 mb-3">
              <Clock size={14} className="text-accent-green" />
              Best Load Deferral Windows
              <span className="text-text-dim text-xs font-normal ml-1">— upcoming low-risk slots</span>
            </h3>
            {deferWindows.length === 0 ? (
              <p className="text-text-dim text-xs py-4 text-center">No upcoming low-risk windows in the next 24 hours.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {deferWindows.map((d, i) => (
                  <div key={i} className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-accent-green font-bold font-mono text-sm">{d.label}</span>
                      {d.solar > 150 && <Sun size={11} className="text-accent-green opacity-70" />}
                    </div>
                    <p className="text-text-dim text-xxs">{d.loadPct}% load · {formatRate(d.adjRate ?? 0)}</p>
                    {d.savings > 0 && (
                      <span className="inline-block text-xxs font-bold text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">
                        Save {d.savings}% vs peak
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Per-building forecast grid ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
            <BarChart3 size={14} className="text-accent-blue" />
            Per-Building 24h Forecast
          </h3>
          <p className="text-text-dim text-xs">Sparklines show net predicted load · Coloured bands = risk zone</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {bForecasts.map(bf => <BuildingForecastCard key={bf.id} bf={bf} />)}
        </div>
      </div>

      {/* ── Bottom row: Risk distribution + Hourly cost forecast ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Risk distribution bar chart */}
        <div className="glass rounded-2xl border border-base-border p-5">
          <h3 className="text-gray-900 font-semibold text-sm mb-1">Risk Hour Distribution</h3>
          <p className="text-text-dim text-xs mb-4">Remaining forecast hours by risk level</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDist} margin={{ top: 4, right: 8, left: -15, bottom: 0 }} barSize={36}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="glass-elevated rounded-lg px-3 py-2 border border-base-border text-xs">
                        <span style={{ color: payload[0].payload.color }} className="font-bold">{payload[0].payload.name}</span>
                        <span className="text-gray-900 ml-2 font-mono">{payload[0].value} hrs</span>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="value" name="Hours" radius={[4, 4, 0, 0]}>
                  {riskDist.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly cost + carbon forecast */}
        <div className="glass rounded-2xl border border-base-border p-5">
          <h3 className="text-gray-900 font-semibold text-sm mb-1">Predicted Hourly Cost & Carbon</h3>
          <p className="text-text-dim text-xs mb-4">Remaining 24h energy spend & CO₂ at current grid mix</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={forecast.filter(p => !p.isPast)}
                margin={{ top: 4, right: 8, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#EA580C" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#EA580C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis
                  dataKey="hour"
                  type="number"
                  domain={[currentHour, 23]}
                  ticks={[currentHour, currentHour + 4, currentHour + 8, currentHour + 12, 23].filter(h => h <= 23)}
                  tickFormatter={h => `${String(h).padStart(2, '0')}h`}
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis yAxisId="cost"   tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => format(v)} />
                <YAxis yAxisId="carbon" orientation="right" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}kg`} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="glass-elevated rounded-xl px-3 py-2 border border-base-border text-xs space-y-1">
                        <p className="text-text-dim font-mono">{String(label).padStart(2, '0')}:00</p>
                        {payload.map(p => (
                          <div key={p.dataKey} className="flex justify-between gap-3">
                            <span style={{ color: p.color }}>{p.name}</span>
                            <span className="text-gray-900 font-bold">{p.name === 'Cost' ? format(p.value) : `${p.value} kg`}</span>
                          </div>
                        ))}
                      </div>
                    ) : null
                  }
                />
                <Area yAxisId="cost" dataKey="predictedCost" name="Cost" stroke="#EA580C" strokeWidth={2} fill="url(#costGrad)" dot={false} isAnimationActive={false} />
                <Line  yAxisId="carbon" dataKey="predictedCarbon" name="Carbon" stroke="#7C3AED" strokeWidth={1.5} dot={false} strokeDasharray="3 3" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Summary totals */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-base-border/60">
            <div>
              <p className="text-text-dim text-xxs">Projected spend (remaining)</p>
              <p className="text-accent-orange font-bold font-mono text-base">{format(summary.totalCost ?? 0, 1)}</p>
            </div>
            <div>
              <p className="text-text-dim text-xxs">Net load forecast (remaining)</p>
              <p className="text-accent-blue font-bold font-mono text-base">{(summary.totalKwh / 1000).toFixed(1)} MWh</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
