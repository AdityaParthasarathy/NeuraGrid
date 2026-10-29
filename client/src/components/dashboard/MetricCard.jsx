import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

export default function MetricCard({
  title,
  value,
  unit = '',
  subtitle,
  icon: Icon,
  color = 'cyan',  // cyan | green | purple | orange | pink
  trend,           // number (positive = up, negative = down)
  trendLabel,
  className = '',
  pulse = false,
}) {
  const colorMap = {
    cyan:   { text: 'text-accent-blue',   bg: 'bg-accent-blue/10',   border: 'border-accent-blue/20',   glow: ''            },
    green:  { text: 'text-accent-green',  bg: 'bg-accent-green/10',  border: 'border-accent-green/20',  glow: ''            },
    purple: { text: 'text-accent-purple', bg: 'bg-accent-purple/10', border: 'border-accent-purple/20', glow: ''            },
    orange: { text: 'text-accent-orange', bg: 'bg-accent-orange/10', border: 'border-accent-orange/20', glow: ''            },
    pink:   { text: 'text-accent-pink',   bg: 'bg-accent-pink/10',   border: 'border-accent-pink/20',   glow: ''            },
  }
  const c = colorMap[color] ?? colorMap.cyan

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? 'text-accent-green' : trend < 0 ? 'text-accent-pink' : 'text-text-dim'

  return (
    <div className={clsx('glass rounded-2xl p-5 border relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5', c.border, className)}>
      {/* Background accent */}
      <div className={clsx('absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500', c.bg)} style={{ transform: 'translate(30%, -30%)' }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', c.bg, 'border', c.border)}>
            {Icon && <Icon size={18} className={clsx(c.text, pulse && 'animate-pulse-slow')} />}
          </div>
          {trend !== undefined && (
            <div className={clsx('flex items-center gap-1 text-xs font-medium', trendColor)}>
              <TrendIcon size={12} />
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <span className={clsx('text-2xl font-bold font-mono', c.text)}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {unit && <span className="text-text-dim text-sm ml-1">{unit}</span>}
        </div>

        {/* Title */}
        <p className="text-text-main text-sm font-medium">{title}</p>

        {/* Subtitle / trend label */}
        {(subtitle || trendLabel) && (
          <p className="text-text-dim text-xs mt-1">{trendLabel ?? subtitle}</p>
        )}
      </div>
    </div>
  )
}
