import React, { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, LineChart, Line, Legend, Cell,
} from 'recharts'
import { TrendingDown, Leaf, IndianRupee, DollarSign, Zap, BarChart3 } from 'lucide-react'
import { useCurrency } from '../context/CurrencyContext'
import { useEnergy } from '../context/EnergyContext'
import { getBuildingComparison } from '../utils/mockData'
import clsx from 'clsx'

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={clsx('glass rounded-2xl border border-base-border p-5', className)}>
      <div className="mb-4">
        <h3 className="text-gray-900 font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-text-dim text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  const { format } = useCurrency()
  if (!active || !payload?.length) return null
  return (
    <div className="glass-elevated rounded-xl px-3 py-2.5 border border-base-border text-xs space-y-1 min-w-[140px]">
      <p className="text-text-dim font-mono mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-gray-900 font-bold">
            {p.dataKey === 'cost'
              ? format(p.value)
              : (typeof p.value === 'number' ? p.value.toLocaleString() : p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { monthlyData, weeklyData, dailyData } = useEnergy()
  const { format, formatShort, symbol, currency } = useCurrency()
  const [metric, setMetric] = useState('consumption') // consumption | carbon | cost
  const comparison = getBuildingComparison()

  // Radar data
  const radarData = [
    { subject: 'Efficiency',  A: 72, fullMark: 100 },
    { subject: 'Renewables',  A: 48, fullMark: 100 },
    { subject: 'Load Factor', A: 65, fullMark: 100 },
    { subject: 'Carbon',      A: 58, fullMark: 100 },
    { subject: 'Savings',     A: 81, fullMark: 100 },
    { subject: 'Uptime',      A: 99, fullMark: 100 },
  ]

  // Hourly breakdown by load type
  const loadBreakdown = dailyData.slice(6, 22).map(d => {
    const val = d.actual ?? d.predicted ?? 0
    return {
      ...d,
      hvac: Math.round(val * 0.42),
      lighting: Math.round(val * 0.22),
      equipment: Math.round(val * 0.36),
    }
  })

  const METRICS = [
    { key: 'consumption', label: 'Energy (kWh)',         color: '#0284C7' },
    { key: 'carbon',      label: 'Carbon (kg)',          color: '#059669' },
    { key: 'cost',        label: `Cost (${symbol})`,     color: '#EA580C' },
  ]

  const totalMonthly = monthlyData.reduce((s, d) => s + d.consumption, 0)
  const totalSavings  = monthlyData.reduce((s, d) => s + d.savings, 0)
  const avgDaily      = Math.round(totalMonthly / monthlyData.length)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Panel</h1>
          <p className="text-text-dim text-sm mt-1">30-day energy performance · Usage trends · Building comparison</p>
        </div>

      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Zap,         label: 'Month Total',   value: `${(totalMonthly / 1000).toFixed(0)} MWh`,    color: '#0284C7' },
          { icon: TrendingDown,label: 'Total Savings',  value: `${(totalSavings / 1000).toFixed(1)} MWh`,   color: '#059669' },
          { icon: Leaf,        label: 'Carbon Avoided', value: `${Math.round(totalSavings * 0.82)} kg`,      color: '#7C3AED' },
          { icon: currency === 'INR' ? IndianRupee : DollarSign, label: 'Cost Savings', value: format(totalSavings * 8.5), color: '#EA580C' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass rounded-xl border border-base-border p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-text-dim text-xxs">{label}</p>
              <p className="text-gray-900 font-bold font-mono text-base mt-0.5" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 30-day trend + metric selector */}
      <ChartCard
        title="30-Day Energy Trend"
        subtitle="Select a parameter below to update the chart"
      >
        <div className="flex gap-2 mb-4">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                metric === m.key
                  ? 'border-transparent text-white font-bold'
                  : 'border-base-border text-text-dim hover:text-gray-900'
              )}
              style={metric === m.key ? { background: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Chart re-renders whenever metric changes — keys force full remount so
            the gradient id always matches the active colour */}
        {(() => {
          const activeMetric = METRICS.find(m => m.key === metric) ?? METRICS[0]
          const gradId       = `gradTrend_${metric}`
          const showBaseline = metric === 'consumption'

          // Axis formatter: cost uses short currency, others use k-suffix
          const yFmt = metric === 'cost'
            ? v => formatShort(v)
            : v => `${(v / 1000).toFixed(0)}k`

          const tipName = activeMetric.label

          return (
            <ResponsiveContainer key={metric} width="100%" height={240}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={activeMetric.color} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={activeMetric.color} stopOpacity={0} />
                  </linearGradient>
                  {showBaseline && (
                    <linearGradient id="gradBase30" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6B7280" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={yFmt} />
                <Tooltip content={<CustomTooltip />} />
                {showBaseline && (
                  <Area type="monotone" dataKey="baseline" name="Baseline" stroke="#6B7280" strokeWidth={1} strokeDasharray="4 4" fill="url(#gradBase30)" dot={false} />
                )}
                <Area
                  type="monotone"
                  dataKey={activeMetric.key}
                  name={tipName}
                  stroke={activeMetric.color}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: activeMetric.color, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        })()}
      </ChartCard>

      {/* Load breakdown + building comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Stacked hourly breakdown */}
        <ChartCard title="Hourly Load Breakdown" subtitle="HVAC · Lighting · Equipment (today, 06:00–22:00)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={loadBreakdown} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barSize={12}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#6B7280' }} />
              <Bar dataKey="hvac"      name="HVAC"      fill="#EA580C" stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="lighting"  name="Lighting"  fill="#DB2777" stackId="a" />
              <Bar dataKey="equipment" name="Equipment" fill="#7C3AED" stackId="a" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar / performance spider */}
        <ChartCard title="Campus Performance Radar" subtitle="Multi-dimensional sustainability score">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 9 }} />
              <Radar name="Campus" dataKey="A" stroke="#0284C7" fill="#0284C7" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Building comparison table */}
      <ChartCard title="Building Comparison" subtitle="Energy consumption · Efficiency · Carbon">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-base-border">
                {['Building', 'Today (kWh)', 'Efficiency', 'Carbon (kg)', 'Occupancy'].map(h => (
                  <th key={h} className="text-left text-text-dim font-medium py-2 pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border/50">
              {comparison.map(b => (
                <tr key={b.name} className="hover:bg-base-elevated/50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="chip bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-mono">{b.name}</span>
                      <span className="text-gray-900">{b.fullName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-gray-900">{b.consumption.toLocaleString()}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="metric-bar w-16">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${b.efficiency}%`,
                              background: b.efficiency > 70 ? '#059669' : b.efficiency > 50 ? '#EA580C' : '#DB2777',
                            }}
                          />
                      </div>
                      <span className="text-gray-900">{b.efficiency}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-gray-900">{b.carbon}</td>
                  <td className="py-2.5">
                    <span
                      className="chip"
                      style={{
                        background: b.occupancy > 80 ? 'rgba(234,88,12,0.1)' : 'rgba(2,132,199,0.1)',
                        color: b.occupancy > 80 ? '#EA580C' : '#0284C7',
                      }}
                    >
                      {b.occupancy}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Weekly bar chart */}
      <ChartCard title="Weekly Energy & Cost" subtitle="7-day consumption vs cost trend">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left"  tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatShort(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left"  dataKey="consumption" name="kWh"  fill="#0284C7" fillOpacity={0.8} radius={[4,4,0,0]} barSize={22}>
              {weeklyData.map((_, i) => (
                <Cell key={i} fill={i === weeklyData.length - 1 ? '#059669' : '#0284C7'} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="cost"        name="Cost" fill="#EA580C"  fillOpacity={0.7} radius={[4,4,0,0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
