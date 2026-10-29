import React, { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { useEnergy } from '../../context/EnergyContext'
import clsx from 'clsx'

const RANGES = ['24h', '7d', '30d']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-elevated rounded-xl px-4 py-3 border border-base-border text-xs space-y-1.5 min-w-[160px] shadow-lg">
      <p className="text-text-dim font-mono mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-text-main font-bold font-mono">{p.value?.toLocaleString()} kW</span>
        </div>
      ))}
    </div>
  )
}

export default function EnergyChart() {
  const { dailyData, weeklyData, monthlyData } = useEnergy()
  const [range, setRange] = useState('24h')

  const data = range === '24h' ? dailyData : range === '7d' ? weeklyData : monthlyData
  const xKey = range === '24h' ? 'time' : range === '7d' ? 'day' : 'date'
  const avg = Math.round(data.reduce((s, d) => s + (d.consumption ?? 0), 0) / data.length)

  return (
    <div className="glass rounded-2xl border border-base-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-text-main font-semibold text-base">Energy Consumption</h3>
          <p className="text-text-dim text-xs mt-0.5">Campus-wide load · Predicted vs Actual</p>
        </div>

        {/* Range tabs */}
        <div className="flex items-center bg-base-elevated rounded-lg p-1 border border-base-border gap-1 shadow-sm">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-all duration-200',
                range === r
                  ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30 shadow-sm'
                  : 'text-text-dim hover:text-text-main'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradConsumption" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0284C7" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0284C7" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradPredicted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={range === '24h' ? 3 : range === '30d' ? 4 : 0}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip content={<CustomTooltip />} />

          {range === '24h' && (
            <ReferenceLine y={avg} stroke="#6B7280" strokeDasharray="4 4" label={{ value: 'avg', fill: '#6B7280', fontSize: 10 }} />
          )}

          {range === '24h' && (
            <Area
              type="monotone"
              dataKey="solar"
              name="Solar"
              stroke="#059669"
              strokeWidth={1.5}
              fill="url(#gradSolar)"
              dot={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="predicted"
            name="Predicted"
            stroke="#7C3AED"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="url(#gradPredicted)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="consumption"
            name="Actual"
            stroke="#0284C7"
            strokeWidth={2}
            fill="url(#gradConsumption)"
            dot={false}
            activeDot={{ r: 4, fill: '#0284C7', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
