import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import {
  Zap, Building2, AlertTriangle, Leaf, TrendingDown, TrendingUp,
  Activity, Sun, Wind, Flame, Award, Bell, Clock, Battery,
  Cpu, Radio, ArrowUpRight, ArrowDownRight, Droplets, Wifi,
  ChevronRight, AlertCircle, CheckCircle2, Info,
} from 'lucide-react'
import { useEnergy } from '../context/EnergyContext'
import { useCurrency } from '../context/CurrencyContext'
import { format } from 'date-fns'
import { calcEnergyScore } from '../utils/aiEngine'
import AirflowVisualization from '../components/airflow/AirflowVisualization'
import TempHeatmap from '../components/heatmap/TempHeatmap'
import EnergyFlowPanel from '../components/energyflow/EnergyFlowPanel'
import CO2FogPanel from '../components/co2fog/CO2FogPanel'
import clsx from 'clsx'

// ─── Animated Number Counter ──────────────────────────────────────────────────
function AnimatedValue({ value, decimals = 0, className = '' }) {
  const [display, setDisplay] = useState(value)
  const frame  = useRef(null)
  const prev   = useRef(value)

  useEffect(() => {
    const from = prev.current
    const to   = value
    if (from === to) return
    const dur   = 650
    const start = performance.now()
    const run   = now => {
      const t    = Math.min((now - start) / dur, 1)
      const ease = 1 - (1 - t) ** 3          // cubic ease-out
      const cur  = from + (to - from) * ease
      setDisplay(decimals ? +cur.toFixed(decimals) : Math.round(cur))
      if (t < 1) frame.current = requestAnimationFrame(run)
      else prev.current = to
    }
    frame.current = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame.current)
  }, [value, decimals])

  return (
    <span className={className}>
      {typeof display === 'number' ? display.toLocaleString() : display}
    </span>
  )
}

// ─── Glow card wrapper ────────────────────────────────────────────────────────
function GlowCard({ children, color = '#0284C7', className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx('glass rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden', className)}
      style={{ borderColor: `${color}33`, boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)' }}
    >
      {/* subtle corner tint for light theme depth */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none"
        style={{ background: color }}
      />
      {children}
    </div>
  )
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
function DarkTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-elevated rounded-xl px-3 py-2.5 border border-dark-border text-xs shadow-2xl min-w-[130px]">
      <p className="text-text-dim font-mono mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: p.color || p.fill }}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="text-gray-900 font-bold font-mono">{p.value?.toLocaleString?.()} {unit}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Pulse dot ────────────────────────────────────────────────────────────────
function PulseDot({ color = '#059669', size = 8 }) {
  return (
    <span className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full animate-ping opacity-60"
        style={{ background: color }}
      />
      <span className="relative block rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  )
}



// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const {
    buildings, metrics, insights, liveMode, lastUpdated,
    setLiveMode, dailyData
  } = useEnergy()
  const { format: formatCurrency, symbol: currSymbol } = useCurrency()

  // Live total (Single source of truth from metrics)
  const totalLoad     = metrics.totalConsumption
  const totalCapacity = metrics.totalCapacity
  const solarKw       = metrics.solarGeneration
  const windKw        = 118
  const renewableKw   = solarKw + windKw
  const gridKw        = Math.max(0, totalLoad - renewableKw)
  const utilPct       = Math.round((totalLoad / totalCapacity) * 100)
  const carbonT       = +(gridKw * 0.00082 * 1).toFixed(2)    // per hour
  const todayMwh      = +(totalLoad * 10 / 1000).toFixed(1)

  // Building bar chart data
  const buildingBars = useMemo(() =>
    [...buildings]
      .sort((a, b) => b.currentLoad - a.currentLoad)
      .map(b => ({
        name:     b.shortName,
        fullName: b.name,
        load:     b.currentLoad,
        capacity: b.capacity,
        pct:      Math.round((b.currentLoad / b.capacity) * 100),
        color:    b.currentLoad / b.capacity >= 0.8 ? '#DB2777'
          : b.currentLoad / b.capacity >= 0.6 ? '#EA580C' : '#059669',
      })),
    [buildings]
  )

  // Renewable donut data
  const renewableData = [
    { name: 'Solar',    value: solarKw, color: '#EA580C' },
    { name: 'Wind',     value: windKw,  color: '#0284C7' },
    { name: 'Grid',     value: gridKw,  color: '#DB2777' },
  ]
  const renewPct = Math.round((renewableKw / totalLoad) * 100)

  // Widget: top waster
  const topWaster = useMemo(() =>
    [...buildings].sort((a, b) => (b.currentLoad / b.capacity) - (a.currentLoad / a.capacity))[0],
    [buildings]
  )

  // Widget: most efficient (occupied)
  const mostEfficient = useMemo(() =>
    [...buildings]
      .filter(b => b.occupancy > 25)
      .sort((a, b) => (a.currentLoad / a.capacity) - (b.currentLoad / b.capacity))[0],
    [buildings]
  )

  // Alerts list
  const alerts = useMemo(() => [
    ...buildings.flatMap(b =>
      (b.alerts ?? []).map(msg => ({
        id: `${b.id}-${msg}`,
        severity: b.status === 'critical' ? 'critical' : 'warning',
        building: b.shortName,
        msg, ts: 'Live',
      }))
    ),
    ...insights.slice(0, 5).map(i => ({
      id: i.id, severity: i.severity, building: i.building?.split(' ')[0] ?? '—',
      msg: i.title, ts: i.timestamp,
    })),
  ].slice(0, 8), [buildings, insights])

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ═══════════════════════════════════════════════════════════════
          LIVE TICKER BANNER
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-2xl border border-accent-blue/20 p-4 relative overflow-hidden"
        style={{ background: '#FFFFFF' }}
      >
        {/* animated scan line */}
        <div className="scan-overlay" />

        <div className="flex flex-wrap items-center gap-6 relative z-10">
          {/* Main counter */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <PulseDot color="#059669" size={10} />
            <div>
              <p className="text-text-dim text-xxs uppercase tracking-widest">Current Load</p>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono font-black leading-none"
                  style={{ fontSize: 36, color: '#0F172A' }}
                >
                  <AnimatedValue value={totalLoad} />
                </span>
                <span className="text-accent-blue text-sm font-bold">kW</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-12 bg-dark-border" />

          {/* Sub-metrics */}
          {[
            { icon: Sun,      label: 'Solar',     value: solarKw,  unit: 'kW',   color: '#EA580C' },
            { icon: Wind,     label: 'Wind',      value: windKw,   unit: 'kW',   color: '#0284C7' },
            { icon: Zap,      label: 'Grid Draw', value: gridKw,   unit: 'kW',   color: '#DB2777' },
            { icon: Leaf,     label: 'CO₂ /hr',   value: carbonT,  unit: 't',    color: '#059669', dec: 2 },
            { icon: Battery,  label: 'Renewable', value: renewPct, unit: '%',    color: '#7C3AED' },
            { icon: Activity, label: 'Utilization',value: utilPct, unit: '%',    color: '#EA580C' },
          ].map(({ icon: Icon, label, value, unit, color, dec }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <div>
                <p className="text-text-dim text-xxs">{label}</p>
                <p className="font-mono font-bold text-sm leading-none mt-0.5" style={{ color }}>
                  <AnimatedValue value={value} decimals={dec ?? 0} />
                  <span className="font-normal text-xxs ml-1">{unit}</span>
                </p>
              </div>
            </div>
          ))}

          {/* Live/pause toggle */}
          <button
            onClick={() => setLiveMode(m => !m)}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex-shrink-0"
            style={liveMode
              ? { borderColor: 'rgba(5,150,105,0.35)', background: 'rgba(5,150,105,0.1)', color: '#059669' }
              : { borderColor: '#E2E8F0', background: '#F1F5F9', color: '#64748B' }
            }
          >
            <Wifi size={12} className={liveMode ? 'animate-pulse-slow' : ''} />
            {liveMode ? 'LIVE' : 'PAUSED'}
          </button>
        </div>

        {/* Sub-bar: time + buildings */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dark-border/60 text-xxs text-text-dim relative z-10">
          <span className="flex items-center gap-1.5">
            <Clock size={10} />
            {format(lastUpdated, 'EEE d MMM · HH:mm:ss')}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <Building2 size={10} />
            {buildings.length} buildings monitored
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <Cpu size={10} />
            Est. today: <strong className="text-gray-900 ml-1">{todayMwh} MWh</strong>
          </span>
          <span className="ml-auto text-text-dim/50">
            Updates every 5 s
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          KPI CARDS ROW
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            label: 'Current Load',
            value: totalLoad, unit: 'kW',
            sub: `${utilPct}% of ${totalCapacity.toLocaleString()} kW capacity`,
            icon: Zap, color: '#0284C7',
            trend: utilPct > 80 ? 'up' : 'down', trendVal: `${utilPct}%`,
          },
          {
            label: 'Renewable Energy',
            value: renewPct, unit: '%',
            sub: `${renewableKw} kW solar + wind`,
            icon: Leaf, color: '#059669',
            trend: 'up', trendVal: '+3%',
          },
          {
            label: 'System Alerts',
            value: alerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length,
            unit: 'active',
            sub: `${alerts.filter(a=>a.severity==='critical').length} critical`,
            icon: AlertTriangle,
            color: alerts.some(a=>a.severity==='critical') ? '#DB2777' : '#EA580C',
            trend: 'up', trendVal: '+2',
            pulse: alerts.some(a=>a.severity==='critical'),
          },
        ].map(({ label, value, unit, sub, icon: Icon, color, trend, trendVal, pulse }) => (
          <GlowCard key={label} color={color} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
              >
                <Icon size={18} style={{ color }} className={pulse ? 'animate-pulse-slow' : ''} />
              </div>
              {trend && (
                <div className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: trend === 'up' ? '#EA580C' : '#059669' }}>
                  {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {trendVal}
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-mono font-black text-3xl leading-none" style={{ color }}>
                <AnimatedValue value={value} />
              </span>
              <span className="text-text-dim text-sm">{unit}</span>
            </div>
            <p className="text-gray-900 text-sm font-semibold">{label}</p>
            <p className="text-text-dim text-xs mt-0.5">{sub}</p>
          </GlowCard>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ROW: Building Bar Chart + Renewable Donut
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* Building energy usage — horizontal bar chart */}
        <GlowCard color="#0284C7" className="xl:col-span-7 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-gray-900 font-semibold">Energy Usage by Building</h3>
              <p className="text-text-dim text-xs mt-0.5">Live load · sorted by consumption</p>
            </div>
            <div className="flex items-center gap-3 text-xxs">
              {[['#059669','Efficient'],['#EA580C','Moderate'],['#DB2777','High']].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1" style={{ color: c }}>
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={buildingBars}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
              barSize={18}
            >
              <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                type="number"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v} kW`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={46}
                tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <RechartTip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="glass-elevated rounded-xl px-3 py-2.5 border border-dark-border text-xs shadow-2xl">
                      <p className="text-gray-900 font-semibold mb-1.5">{d.fullName}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-6">
                          <span className="text-text-dim">Load</span>
                          <span className="text-gray-900 font-mono font-bold" style={{ color: d.color }}>{d.load} kW</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-text-dim">Capacity</span>
                          <span className="text-gray-900 font-mono">{d.capacity} kW</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-text-dim">Utilization</span>
                          <span className="font-mono font-bold" style={{ color: d.color }}>{d.pct}%</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="load" name="Load" radius={[0, 4, 4, 0]}>
                {buildingBars.map((entry) => (
                  <Cell
                    key={entry.id ?? entry.name}
                    fill={entry.color}
                    fillOpacity={0.85}
                    style={{ filter: `drop-shadow(0 0 4px ${entry.color}88)` }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Capacity reference labels */}
          <div className="flex items-center justify-between text-xxs text-text-dim mt-2 px-14">
            <span>0 kW</span>
            <span>← Current load vs capacity →</span>
            <span>{Math.max(...buildingBars.map(b => b.capacity))} kW</span>
          </div>
        </GlowCard>

        {/* Renewable vs Non-renewable donut */}
        <GlowCard color="#059669" className="xl:col-span-5 p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="text-gray-900 font-semibold">Energy Source Split</h3>
            <p className="text-text-dim text-xs mt-0.5">Renewable vs grid · real-time</p>
          </div>

          {/* Donut */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative">
              <PieChart width={220} height={220}>
                <Pie
                  data={renewableData}
                  cx={110}
                  cy={110}
                  innerRadius={72}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {renewableData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      style={{ filter: `drop-shadow(0 0 8px ${entry.color}88)` }}
                    />
                  ))}
                </Pie>
                <RechartTip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="glass-elevated rounded-xl px-3 py-2 border border-dark-border text-xs">
                        <p className="font-bold mb-0.5" style={{ color: d.color }}>{d.name}</p>
                        <p className="text-gray-900 font-mono">{d.value} kW</p>
                        <p className="text-text-dim">{Math.round(d.value / totalLoad * 100)}%</p>
                      </div>
                    )
                  }}
                />
              </PieChart>

              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <AnimatedValue
                  value={renewPct}
                  className="font-mono font-black leading-none"
                  style={{ fontSize: 28, color: '#059669' }}
                />
                <p className="text-xxs text-text-dim mt-1">Renewable</p>
                <p className="text-xxs text-accent-green font-bold mt-0.5">
                  <AnimatedValue value={renewableKw} /> kW
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-3 w-full mt-4">
              {renewableData.map(({ name, value, color }) => (
                <div key={name} className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-dark-border"
                  style={{ background: `${color}08` }}>
                  <div className="w-3 h-3 rounded-sm" style={{ background: color, boxShadow: `0 0 6px ${color}88` }} />
                  <p className="text-xxs text-text-dim">{name}</p>
                  <p className="text-xs font-bold font-mono" style={{ color }}>
                    <AnimatedValue value={value} /> kW
                  </p>
                </div>
              ))}
            </div>

            {/* Renewable progress bar */}
            <div className="w-full mt-4">
              <div className="flex justify-between text-xxs mb-1">
                <span className="text-text-dim">Renewable share</span>
                <span className="font-bold text-accent-green font-mono">{renewPct}% / 30% target</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (renewPct / 30) * 100)}%`,
                    background: 'linear-gradient(90deg, #059669, #0284C7)',
                  }}
                />
              </div>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PEAK USAGE TIMES — 24h Line Chart
      ══════════════════════════════════════════════════════════════════ */}
      <GlowCard color="#7b2fff" className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h3 className="text-gray-900 font-semibold">Peak Usage Times — 24-Hour Profile</h3>
            <p className="text-text-dim text-xs mt-0.5">Actual load · System prediction · Peak threshold</p>
          </div>
          <div className="flex items-center gap-4 text-xxs">
            {[
              { color: '#0284C7', label: 'Actual',    dash: false },
              { color: '#7C3AED', label: 'Predicted', dash: true  },
              { color: '#DB2777', label: 'Peak',      dash: true  },
            ].map(({ color, label, dash }) => (
              <span key={label} className="flex items-center gap-1.5 text-text-dim">
                <svg width="18" height="4">
                  {dash
                    ? <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="1.5" strokeDasharray="4 2" />
                    : <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" />}
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0284C7" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0284C7" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="gPeak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#DB2777" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#DB2777" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#6B7280', fontSize: 10 }}
              axisLine={false} tickLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fill: '#6B7280', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
            />
            <RechartTip content={<DarkTip unit="kW" />} />

            {/* "Now" reference line */}
            <ReferenceLine
              x={`${String(new Date().getHours()).padStart(2, '0')}:00`}
              stroke="#EA580C"
              strokeDasharray="4 4"
              label={{ value: 'Now', fill: '#EA580C', fontSize: 10, position: 'top' }}
            />

            <Area type="monotone" dataKey="peak"      name="Peak"      stroke="#DB2777" strokeWidth={1}   strokeDasharray="5 3" fill="url(#gPeak)"   dot={false} />
            <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="5 3" fill="none"          dot={false} />
            <Area type="monotone" dataKey="actual"    name="Actual"    stroke="#0284C7" strokeWidth={2}   fill="url(#gActual)"  dot={false}
              activeDot={{ r: 4, fill: '#0284C7', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Hour annotations */}
        <div className="flex justify-between text-xxs text-text-dim mt-2 px-2">
          {['Midnight','Dawn · 06:00','Morning Peak','Noon','Afternoon','Evening','Night'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </GlowCard>

      {/* ═══════════════════════════════════════════════════════════════
          WIDGETS ROW: Waster · Efficient · Live Alerts
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Top Energy Wasting Building ──────────────────────────── */}
        <GlowCard color="#ff2d78" className="p-5">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-base-border">
            <div className="w-10 h-10 rounded-xl bg-accent-pink/10 border border-accent-pink/25 flex items-center justify-center">
              <Flame size={18} className="text-accent-pink animate-pulse-slow" />
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold text-sm">Top Energy Wasting Building</h3>
              <p className="text-text-dim text-xxs">Highest load-to-capacity ratio</p>
            </div>
          </div>

          {topWaster && (() => {
            const pct   = Math.round((topWaster.currentLoad / topWaster.capacity) * 100)
            const waste = Math.round(topWaster.currentLoad - topWaster.capacity * 0.55)
            return (
              <div className="space-y-4">
                {/* Building identity */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black font-mono flex-shrink-0"
                    style={{ background: 'rgba(219,39,119,0.15)', border: '1px solid rgba(219,39,119,0.35)', color: '#DB2777' }}
                  >
                    {topWaster.shortName}
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm leading-tight">{topWaster.name}</p>
                    <p className="text-text-dim text-xxs mt-0.5">{topWaster.type} · {topWaster.floors}F</p>
                  </div>
                </div>

                {/* Load gauge */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-dim">Current Load</span>
                    <span className="font-mono font-bold text-accent-pink">{pct}% capacity</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700 relative"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #EA580C, #DB2777)', boxShadow: '0 0 12px rgba(219,39,119,0.4)' }}
                    >
                      <div className="absolute inset-0 bg-white/10 rounded-full" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Load',    value: `${topWaster.currentLoad} kW`,  color: '#DB2777' },
                    { label: 'Excess',  value: `+${waste} kW`,                 color: '#EA580C' },
                    { label: 'CO₂/hr', value: `${Math.round(topWaster.currentLoad * 0.82)} kg`,  color: '#EA580C' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center p-2 rounded-xl border border-base-border" style={{ background: 'rgba(219,39,119,0.05)' }}>
                      <p className="text-text-dim text-xxs">{label}</p>
                      <p className="font-mono font-bold text-xs mt-0.5" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Alerts from this building */}
                {topWaster.alerts?.length > 0 && (
                  <div className="space-y-1.5">
                    {(topWaster.alerts ?? []).slice(0, 2).map((a, i) => (
                      <div key={`alert-${i}`} className="flex items-start gap-2 text-xxs p-2 rounded-lg"
                        style={{ background: 'rgba(219,39,119,0.08)', border: '1px solid rgba(219,39,119,0.2)' }}>
                        <AlertCircle size={10} className="text-accent-pink flex-shrink-0 mt-0.5" />
                        <span className="text-accent-pink">{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </GlowCard>

        {/* ── Most Efficient Zone ──────────────────────────────────── */}
        <GlowCard color="#00ff88" className="p-5">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-base-border">
            <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/25 flex items-center justify-center">
              <Award size={18} className="text-accent-green" />
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold text-sm">Most Efficient Zone</h3>
              <p className="text-text-dim text-xxs">Lowest load · best optimization</p>
            </div>
          </div>

          {mostEfficient && (() => {
            const pct   = Math.round((mostEfficient.currentLoad / mostEfficient.capacity) * 100)
            const score = calcEnergyScore(mostEfficient)
            const saved = Math.round((mostEfficient.capacity * 0.8 - mostEfficient.currentLoad) * 0.15)
            return (
              <div className="space-y-4">
                {/* Identity */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black font-mono flex-shrink-0"
                    style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)', color: '#059669' }}
                  >
                    {mostEfficient.shortName}
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm leading-tight">{mostEfficient.name}</p>
                    <p className="text-text-dim text-xxs mt-0.5">{mostEfficient.type} · {mostEfficient.floors}F</p>
                  </div>
                </div>

                {/* Efficiency gauge */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-dim">Load Efficiency</span>
                    <span className="font-mono font-bold text-accent-green">Only {pct}% used</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #059669, #0284C7)', boxShadow: '0 0 12px rgba(5,150,105,0.3)' }}
                    />
                  </div>
                </div>

                {/* Score ring + stats */}
                <div className="flex items-center gap-4">
                  {/* Score ring */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r="26" fill="none"
                        stroke="#059669" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(score / 100) * 163.4} 163.4`}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(5,150,105,0.4))' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono font-black text-sm text-accent-green leading-none">{score}</span>
                      <span className="text-xxs text-text-dim">score</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    {[
                      { label: 'Load',      value: `${mostEfficient.currentLoad} kW`,  color: '#00ff88' },
                      { label: 'Occupancy', value: `${mostEfficient.occupancy}%`,       color: '#00f5ff' },
                      { label: `${currSymbol} Saved`, value: `${formatCurrency(saved * 83)}/day`, color: '#fbbf24' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-text-dim">{label}</span>
                        <span className="font-mono font-bold" style={{ color }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Efficiency badge */}
                <div
                  className="w-full py-2 rounded-xl text-center text-xs font-bold border"
                  style={{ background: 'rgba(5,150,105,0.08)', borderColor: 'rgba(5,150,105,0.25)', color: '#059669' }}
                >
                  ✓ Carbon-optimal operation · {Math.round(mostEfficient.currentLoad * 0.82)} kg CO₂/hr
                </div>
              </div>
            )
          })()}
        </GlowCard>

        {/* ── Live Alerts ──────────────────────────────────────────── */}
        <GlowCard color="#fbbf24" className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center">
                <Bell size={18} className="text-yellow-400 animate-pulse-slow" />
              </div>
              <div>
                <h3 className="text-gray-900 font-semibold text-sm">Live Alerts</h3>
                <p className="text-text-dim text-xxs">{alerts.length} active notifications</p>
              </div>
            </div>
            <span
              className="chip font-bold text-xxs"
              style={{ background: 'rgba(219,39,119,0.15)', color: '#DB2777', border: '1px solid rgba(219,39,119,0.3)' }}
            >
              {alerts.filter(a => a.severity === 'critical').length} CRIT
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-72 pr-1">
            {alerts.map((alert, i) => {
              const cfg = {
                critical: { color: '#DB2777', icon: AlertCircle,   bg: 'rgba(219,39,119,0.08)',  border: 'rgba(219,39,119,0.2)'  },
                warning:  { color: '#EA580C', icon: AlertTriangle, bg: 'rgba(234,88,12,0.08)',   border: 'rgba(234,88,12,0.2)'   },
                info:     { color: '#0284C7', icon: Info,          bg: 'rgba(2,132,199,0.06)',   border: 'rgba(2,132,199,0.15)'  },
                success:  { color: '#059669', icon: CheckCircle2,  bg: 'rgba(5,150,105,0.06)',   border: 'rgba(5,150,105,0.15)'  },
              }[alert.severity] ?? { color: '#64748B', icon: Info, bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.25)' }

              const Icon = cfg.icon

              return (
                <div
                  key={alert.id ?? i}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <Icon size={12} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium leading-snug truncate">{alert.msg}</p>
                    <p className="text-text-dim text-xxs mt-0.5">{alert.building}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className="chip text-xxs font-bold"
                      style={{ background: `${cfg.color}18`, color: cfg.color }}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-text-dim text-xxs">{alert.ts}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Alert summary footer */}
          <div className="border-t border-dark-border mt-3 pt-3 grid grid-cols-3 text-center gap-2">
            {[
              { label: 'Critical', count: alerts.filter(a=>a.severity==='critical').length, color: '#DB2777' },
              { label: 'Warning',  count: alerts.filter(a=>a.severity==='warning').length,  color: '#EA580C' },
              { label: 'Info',     count: alerts.filter(a=>a.severity==='info').length,     color: '#0284C7' },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <p className="font-black font-mono text-lg leading-none" style={{ color }}>{count}</p>
                <p className="text-text-dim text-xxs">{label}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          AIRFLOW VISUALIZATION — campus ventilation & CO₂ overview
      ══════════════════════════════════════════════════════════════════ */}
      <AirflowVisualization />

      {/* ═══════════════════════════════════════════════════════════════
          TEMPERATURE HEATMAP — campus thermal distribution
      ══════════════════════════════════════════════════════════════════ */}
      <TempHeatmap />

      {/* ═══════════════════════════════════════════════════════════════
          ENERGY FLOW — grid topology with animated particle paths
      ══════════════════════════════════════════════════════════════════ */}
      <EnergyFlowPanel />

      {/* ═══════════════════════════════════════════════════════════════
          CO₂ FOG — air quality haze visualization per building
      ══════════════════════════════════════════════════════════════════ */}
      <CO2FogPanel />

    </div>
  )
}
