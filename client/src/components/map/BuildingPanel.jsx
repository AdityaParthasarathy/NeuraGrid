import React from 'react'
import {
  X, Thermometer, Users, Zap, Cpu,
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RechartTooltip,
  ReferenceLine,
} from 'recharts'
import clsx from 'clsx'

export function getStatusStyle(loadPct) {
  if (loadPct < 0.60)
    return {
      label: 'Efficient', color: '#059669',
      fillBg: 'rgba(5,150,105,0.08)', borderColor: 'rgba(5,150,105,0.3)',
      text: '#059669', chipCls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
    }
  if (loadPct < 0.80)
    return {
      label: 'Moderate', color: '#EA580C',
      fillBg: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.3)',
      text: '#EA580C', chipCls: 'bg-orange-400/10 text-orange-600 border-orange-400/25',
    }
  return {
    label: 'High Load', color: '#DB2777',
    fillBg: 'rgba(219,39,119,0.08)', borderColor: 'rgba(219,39,119,0.3)',
    text: '#DB2777', chipCls: 'bg-pink-500/10 text-pink-600 border-pink-500/25',
  }
}

function SparkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-elevated rounded px-2 py-1 text-xxs border border-dark-border">
      {payload[0].value} kW
    </div>
  )
}

export default function BuildingPanel({ building, history, onClose }) {
  if (!building) return null

  const loadPct   = building.currentLoad / building.capacity
  const status    = getStatusStyle(loadPct)
  const kwhToday  = Math.round(building.currentLoad * 0.82 * 14)
  const sparkData = (history ?? []).map((h, i) => ({ i, load: h.load }))
  const minLoad   = Math.min(...sparkData.map(d => d.load))
  const maxLoad   = Math.max(...sparkData.map(d => d.load))

  const METRICS = [
    { icon: Zap,         label: 'Energy',    value: building.currentLoad, unit: 'kW', color: '#0284C7' },
    { icon: Cpu,         label: 'Devices',   value: building.devices,     unit: 'on', color: '#7C3AED' },
    { icon: Users,       label: 'Occupancy', value: `${building.occupancy}`, unit: '%', color: '#059669' },
    { icon: Thermometer, label: 'Temp',      value: building.temperature, unit: '°F', color: '#EA580C' },
  ]

  return (
    <div
      className="absolute top-4 right-4 z-[1000] w-[310px] rounded-2xl overflow-hidden animate-slide-up pointer-events-auto"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${status.borderColor}`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)`,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="p-4 pb-3 border-b border-dark-border/70" style={{ background: status.fillBg }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{building.icon}</span>
            <div>
              <h3 className="text-gray-900 font-bold text-sm leading-tight">{building.name}</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(107,140,186,1)' }}>
                {building.type} · {building.floors}F · {building.area}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[#6B7280] hover:text-gray-900 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Status badge + load bar */}
        <div className="mt-3 flex items-center gap-3">
          <span
            className={clsx('chip text-xxs font-bold border flex-shrink-0', status.chipCls)}
          >
            ● {status.label}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span style={{ color: '#6B7280' }}>Load</span>
              <span className="text-gray-900 font-mono">{Math.round(loadPct * 100)}% / {building.capacity} kW</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${loadPct * 100}%`, background: status.color, boxShadow: `0 0 8px ${status.color}80` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Metrics 2×2 grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {METRICS.map(({ icon: Icon, label, value, unit, color }) => (
          <div
            key={label}
            className="rounded-xl p-2.5 border border-black/5"
            style={{ background: 'rgba(255,255,255,0.65)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={11} style={{ color }} />
              <span className="text-[10px]" style={{ color: '#6B7280' }}>{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono leading-none" style={{ color }}>{value}</span>
              <span className="text-[10px]" style={{ color: '#6B7280' }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sparkline chart ────────────────────────────────────────────── */}
      <div className="px-3 pb-3">
        <div className="rounded-xl p-3 border border-black/5" style={{ background: 'rgba(255,255,255,0.65)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px]" style={{ color: '#6B7280' }}>Energy Trend · live · 2 min window</span>
            <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: status.color }}>
              <TrendingUp size={9} />
              {building.currentLoad} kW
            </span>
          </div>

          <ResponsiveContainer width="100%" height={64}>
            <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`sg-${building.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={status.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={status.color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <ReferenceLine y={minLoad} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <RechartTooltip content={<SparkTooltip />} />
              <Area
                type="monotone"
                dataKey="load"
                stroke={status.color}
                strokeWidth={1.5}
                fill={`url(#sg-${building.id})`}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 3, fill: status.color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex justify-between text-[9px] mt-0.5" style={{ color: '#6B7280' }}>
            <span>Low: {minLoad} kW</span>
            <span>Peak: {maxLoad} kW</span>
          </div>
        </div>
      </div>

      {/* ── Device list ────────────────────────────────────────────────── */}
      <div className="px-3 pb-3">
        <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>
          Active Devices
        </p>
        <div className="space-y-1.5">
          {building.deviceList.map((d, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-gray-900 min-w-0">
                {d.status === 'warning'
                  ? <AlertTriangle size={10} className="text-yellow-400 flex-shrink-0" />
                  : <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
                }
                <span className="truncate">{d.name}</span>
              </span>
              <span
                className="chip text-[10px] flex-shrink-0 ml-2 font-mono"
                style={{
                  background: d.status === 'warning' ? 'rgba(234,88,12,0.15)' : 'rgba(5,150,105,0.1)',
                  color:       d.status === 'warning' ? '#EA580C' : '#059669',
                }}
              >
                {d.count}{d.status === 'warning' ? ' ⚠' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-2.5 border-t border-dark-border/70 flex items-center justify-between"
        style={{ background: 'rgba(248,250,252,0.9)' }}
      >
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#6B7280' }}>
          <Clock size={9} />
          Est. today:
          <span className="text-gray-900 font-bold font-mono ml-0.5">{kwhToday.toLocaleString()} kWh</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#059669' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live
        </span>
      </div>
    </div>
  )
}
