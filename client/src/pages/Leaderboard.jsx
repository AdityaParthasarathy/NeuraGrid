import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
  generateLeaderboard, getCampusScore, getCategoryWinners,
  BADGE_DEFS, TIER_ORDER, scoreColor,
} from '../utils/gamificationEngine'
import { useEnergy } from '../context/EnergyContext'
import { Trophy, TrendingUp, TrendingDown, Minus, Star,
         Zap, Award, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimNum({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(value)
  const raf = useRef(null)
  const prev = useRef(value)
  useEffect(() => {
    const start = prev.current
    const end   = value
    const dur   = 600
    const t0    = performance.now()
    cancelAnimationFrame(raf.current)
    function step(now) {
      const p    = Math.min(1, (now - t0) / dur)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(+(start + (end - start) * ease).toFixed(decimals))
      if (p < 1) raf.current = requestAnimationFrame(step)
      else prev.current = value
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value, decimals])
  return <>{display.toLocaleString()}</>
}

// ─── Score ring (SVG) ─────────────────────────────────────────────────────────
function ScoreRing({ score, size = 64, color, strokeWidth = 5 }) {
  const r       = (size - strokeWidth * 2) / 2
  const circ    = 2 * Math.PI * r
  const offset  = circ * (1 - score / 100)
  return (
    <svg width={size} height={size} className="flex-shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
    </svg>
  )
}

// ─── Badge chip ───────────────────────────────────────────────────────────────
function BadgeChip({ badgeKey, size = 'md' }) {
  const def = BADGE_DEFS[badgeKey]
  if (!def) return null
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={clsx(
          'inline-flex items-center gap-1 rounded-lg font-medium cursor-default transition-all',
          size === 'lg' ? 'text-sm px-3 py-1.5' : size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
        )}
        style={{ background: def.bg, color: def.color, border: `1px solid ${def.border}` }}
      >
        <span>{def.emoji}</span>
        {size !== 'sm' && <span>{def.name}</span>}
      </span>
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 glass-elevated rounded-xl border border-dark-border p-2.5 pointer-events-none">
          <p className="text-white text-xs font-semibold">{def.emoji} {def.name}</p>
          <p className="text-text-dim text-xxs mt-0.5 leading-snug">{def.desc}</p>
          <span className="inline-block mt-1 text-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: def.bg, color: def.color }}>
            {def.tier}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Rank change indicator ─────────────────────────────────────────────────────
function RankChange({ change }) {
  if (change === 0) return <span className="flex items-center gap-0.5 text-text-dim text-xxs font-mono"><Minus size={9} />0</span>
  if (change > 0)   return <span className="flex items-center gap-0.5 text-accent-green text-xxs font-bold"><TrendingUp size={10} />+{change}</span>
  return              <span className="flex items-center gap-0.5 text-accent-pink text-xxs font-bold"><TrendingDown size={10} />{change}</span>
}

// ─── Medal display ─────────────────────────────────────────────────────────────
function Medal({ rank }) {
  if (rank === 1) return <span className="text-2xl leading-none">🥇</span>
  if (rank === 2) return <span className="text-2xl leading-none">🥈</span>
  if (rank === 3) return <span className="text-2xl leading-none">🥉</span>
  return (
    <span className="w-7 h-7 rounded-full bg-dark-elevated border border-dark-border flex items-center justify-center text-text-dim text-xs font-bold font-mono">
      {rank}
    </span>
  )
}

// ─── Score breakdown bar ───────────────────────────────────────────────────────
function BreakdownBar({ label, score, maxPts, color }) {
  const contrib = Math.round((score / 100) * maxPts)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xxs">
        <span className="text-text-dim">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{contrib}<span className="text-text-dim font-normal">/{maxPts}pts</span></span>
      </div>
      <div className="metric-bar">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Champion hero card ────────────────────────────────────────────────────────
function ChampionCard({ building }) {
  if (!building) return null
  const { score, scoreBreakdown, badges, color, tagline, xp, level } = building
  return (
    <div className="relative rounded-2xl overflow-hidden border p-6 sm:p-8"
      style={{
        background: `linear-gradient(135deg, ${building.color}12 0%, rgba(19,25,41,0.95) 60%)`,
        borderColor: '#fbbf2450',
        boxShadow: `0 0 40px ${building.color}20, 0 0 80px rgba(251,191,36,0.08)`,
      }}
    >
      {/* Animated glow pulse */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 15% 50%, ${building.color}18 0%, transparent 60%)`,
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={18} className="text-yellow-400" />
        <span className="text-yellow-400 font-bold text-sm uppercase tracking-widest">Greenest Building of the Day</span>
        <span className="ml-auto chip bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 text-xs">
          Live Ranking
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Score ring */}
        <div className="relative flex-shrink-0">
          <ScoreRing score={score} size={120} color={color} strokeWidth={7} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black font-mono" style={{ color }}><AnimNum value={score} /></span>
            <span className="text-text-dim text-xxs font-medium uppercase tracking-wide">Score</span>
          </div>
        </div>

        {/* Building info */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start gap-3 flex-wrap">
            <span className="text-sm font-bold px-2.5 py-1 rounded-lg"
              style={{ background: `${building.color}20`, color: building.color, border: `1px solid ${building.color}30` }}>
              {building.shortName}
            </span>
            <div>
              <h2 className="text-white text-xl sm:text-2xl font-black leading-tight">{building.name}</h2>
              <p className="text-text-dim text-sm mt-0.5">{tagline}</p>
            </div>
          </div>

          {/* Level + XP */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: level.color + '20', color: level.color, border: `1px solid ${level.color}30` }}>
              {level.label}
            </span>
            <span className="text-text-dim text-xxs font-mono">{xp.toLocaleString()} XP</span>
            <div className="flex-1 max-w-[120px]">
              <div className="metric-bar">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: level.color }} />
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {badges.map(k => <BadgeChip key={k} badgeKey={k} size="md" />)}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="w-full sm:w-48 space-y-3 flex-shrink-0">
          {Object.values(scoreBreakdown).map(({ label, score: s, maxPts }) => (
            <BreakdownBar key={label} label={label} score={s} maxPts={maxPts} color={color} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Category winner card ──────────────────────────────────────────────────────
function CategoryCard({ cat }) {
  const { emoji, title, subtitle, winner, value, color } = cat
  if (!winner) return null
  return (
    <div className="glass rounded-2xl border border-base-border p-4 flex flex-col gap-2 hover:border-accent-blue/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{emoji}</span>
        <span className="text-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
          Winner
        </span>
      </div>
      <div>
        <p className="text-white text-sm font-bold">{title}</p>
        <p className="text-text-dim text-xxs">{subtitle}</p>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="chip text-xs font-mono"
          style={{ background: `${winner.color ?? '#00f5ff'}20`, color: winner.color ?? '#00f5ff', border: `1px solid ${winner.color ?? '#00f5ff'}30` }}>
          {winner.shortName}
        </span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{value}</span>
      </div>
    </div>
  )
}

// ─── Leaderboard row (rank 4–8) ────────────────────────────────────────────────
function RankRow({ building, rank }) {
  const { score, badges, color, rankChange, loadPct, level, tagline, xp } = building
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass rounded-xl border border-base-border overflow-hidden transition-colors hover:border-accent-blue/15">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* Rank */}
        <Medal rank={rank} />

        {/* Building */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded hidden sm:inline"
            style={{ background: `${building.color}20`, color: building.color, border: `1px solid ${building.color}30` }}>
            {building.shortName}
          </span>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{building.name}</p>
            <p className="text-text-dim text-xxs truncate hidden sm:block">{tagline}</p>
          </div>
        </div>

        {/* Score ring + value */}
        <div className="relative flex-shrink-0">
          <ScoreRing score={score} size={44} color={color} strokeWidth={3.5} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black font-mono" style={{ color }}>{score}</span>
          </div>
        </div>

        {/* Change */}
        <div className="w-8 flex justify-center flex-shrink-0">
          <RankChange change={rankChange} />
        </div>

        {/* Load bar */}
        <div className="hidden md:flex items-center gap-2 w-28 flex-shrink-0">
          <div className="metric-bar flex-1">
            <div className="h-full rounded-full" style={{
              width: `${loadPct}%`,
              background: loadPct > 90 ? '#ff2d78' : loadPct > 75 ? '#ff6b35' : color,
            }} />
          </div>
          <span className="text-xxs font-mono text-white">{loadPct}%</span>
        </div>

        {/* Badges */}
        <div className="hidden lg:flex items-center gap-1 flex-shrink-0 min-w-[60px]">
          {badges.slice(0, 3).map(k => <BadgeChip key={k} badgeKey={k} size="sm" />)}
          {badges.length > 3 && (
            <span className="text-xxs text-text-dim">+{badges.length - 3}</span>
          )}
        </div>

        {/* Expand */}
        <div className="text-text-dim flex-shrink-0 ml-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-dark-border/60 px-4 py-4 bg-dark-elevated/30 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Score breakdown */}
          <div className="space-y-3">
            <p className="text-text-dim text-xs font-medium uppercase tracking-wide">Score Breakdown</p>
            {Object.values(building.scoreBreakdown).map(({ label, score: s, maxPts }) => (
              <BreakdownBar key={label} label={label} score={s} maxPts={maxPts} color={color} />
            ))}
          </div>
          {/* Badges + stats */}
          <div className="space-y-3">
            <p className="text-text-dim text-xs font-medium uppercase tracking-wide">Badges Earned</p>
            {badges.length === 0 ? (
              <p className="text-text-dim text-xs italic">No badges yet — keep improving!</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {badges.map(k => <BadgeChip key={k} badgeKey={k} size="md" />)}
              </div>
            )}
            <div className="pt-2 border-t border-dark-border/40 grid grid-cols-2 gap-2 text-xxs">
              {[
                { label: 'XP',          value: `${xp.toLocaleString()} XP`, color: level.color },
                { label: 'Level',       value: level.label,                   color: level.color },
                { label: 'CO₂',         value: `${building.co2} ppm`,         color: building.co2 > 800 ? '#ff2d78' : '#00f5ff' },
                { label: 'Temperature', value: `${building.temperature}°F`,    color: Math.abs(building.temperature - 70) > 3 ? '#ff6b35' : '#00ff88' },
                { label: 'Load',        value: `${building.currentLoad} kW`,   color },
                { label: 'Savings',     value: `${building.savings > 0 ? '+' : ''}${building.savings}%`, color: building.savings > 0 ? '#00ff88' : '#ff2d78' },
              ].map(({ label: l, value: v, color: c }) => (
                <div key={l}>
                  <span className="text-text-dim">{l}: </span>
                  <span className="font-mono font-bold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Podium card (top 3) ───────────────────────────────────────────────────────
const PODIUM_META = {
  1: { label: '1st Place', borderColor: '#fbbf24', glow: '#fbbf2430', height: 'min-h-[260px]' },
  2: { label: '2nd Place', borderColor: '#cbd5e1', glow: '#cbd5e120', height: 'min-h-[220px]' },
  3: { label: '3rd Place', borderColor: '#f97316', glow: '#f9731620', height: 'min-h-[200px]' },
}

function PodiumCard({ building }) {
  const { score, badges, color, rankChange, loadPct, level, xp, rank } = building
  const meta = PODIUM_META[rank]
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={clsx('rounded-2xl border p-5 flex flex-col gap-4 transition-all cursor-pointer', meta.height)}
      style={{ borderColor: meta.borderColor + '60', background: `linear-gradient(160deg, ${color}10 0%, rgba(19,25,41,0.9) 70%)`, boxShadow: `0 0 24px ${meta.glow}` }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Rank + change */}
      <div className="flex items-center justify-between">
        <Medal rank={rank} />
        <div className="flex items-center gap-2">
          <RankChange change={rankChange} />
          {expanded ? <ChevronUp size={12} className="text-text-dim" /> : <ChevronDown size={12} className="text-text-dim" />}
        </div>
      </div>

      {/* Score ring */}
      <div className="relative self-center">
        <ScoreRing score={score} size={80} color={color} strokeWidth={5} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black font-mono" style={{ color }}><AnimNum value={score} /></span>
          <span className="text-xxs text-text-dim">pts</span>
        </div>
      </div>

      {/* Building */}
      <div className="text-center">
        <span className="text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
          {building.shortName}
        </span>
        <p className="text-white font-bold text-sm mt-1.5 leading-tight">{building.name}</p>
        <p className="text-text-dim text-xxs mt-0.5">{level.label} · {xp.toLocaleString()} XP</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-1">
        {badges.slice(0, 4).map(k => <BadgeChip key={k} badgeKey={k} size="sm" />)}
      </div>

      {/* Load bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xxs">
          <span className="text-text-dim">Load</span>
          <span className="text-white font-mono">{loadPct}%</span>
        </div>
        <div className="metric-bar">
          <div className="h-full rounded-full" style={{
            width: `${loadPct}%`,
            background: loadPct > 85 ? '#ff2d78' : loadPct > 70 ? '#ff6b35' : color,
          }} />
        </div>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-dark-border/40 pt-3 space-y-2">
          {Object.values(building.scoreBreakdown).map(({ label, score: s, maxPts }) => (
            <BreakdownBar key={label} label={label} score={s} maxPts={maxPts} color={color} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Badge gallery ─────────────────────────────────────────────────────────────
function BadgeGallery({ leaderboard }) {
  // Build map of badge → buildings that earned it
  const earnedBy = {}
  leaderboard.forEach(b => {
    b.badges.forEach(k => {
      if (!earnedBy[k]) earnedBy[k] = []
      earnedBy[k].push(b)
    })
  })

  return (
    <div className="glass rounded-2xl border border-dark-border p-5">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Award size={14} className="text-accent-purple" />
          Badge Gallery
        </h3>
        <p className="text-text-dim text-xs mt-0.5">All available achievements — hover any badge to learn more</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TIER_ORDER.flatMap(tier =>
          Object.entries(BADGE_DEFS)
            .filter(([, def]) => def.tier === tier)
            .map(([key, def]) => {
              const holders = earnedBy[key] ?? []
              const locked  = holders.length === 0
              return (
                <div key={key}
                  className={clsx('rounded-xl border p-3 flex items-start gap-3 transition-all', locked ? 'opacity-35' : 'hover:border-opacity-60')}
                  style={{ borderColor: locked ? 'rgba(255,255,255,0.06)' : def.border, background: locked ? 'rgba(255,255,255,0.02)' : def.bg }}
                >
                  <span className="text-2xl flex-shrink-0 mt-0.5">{def.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-white text-xs font-semibold">{def.name}</p>
                      <span className="text-xxs font-bold uppercase tracking-wide px-1 py-px rounded"
                        style={{ background: def.bg, color: def.color, border: `1px solid ${def.border}` }}>
                        {def.tier}
                      </span>
                    </div>
                    <p className="text-text-dim text-xxs mt-0.5 leading-snug">{def.desc}</p>
                    {holders.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {holders.map(b => (
                          <span key={b.id} className="text-xxs font-bold px-1.5 py-px rounded"
                            style={{ background: `${b.color ?? def.color}20`, color: b.color ?? def.color, border: `1px solid ${b.color ?? def.color}25` }}>
                            {b.shortName}
                          </span>
                        ))}
                      </div>
                    )}
                    {locked && <p className="text-text-dim text-xxs mt-1 italic">Not yet awarded</p>}
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { buildings, liveMode } = useEnergy()

  // Refresh every 30s in live mode
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!liveMode) return
    const iv = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(iv)
  }, [liveMode])

  const leaderboard   = useMemo(() => generateLeaderboard(buildings),       [buildings, tick])
  const campusScore   = useMemo(() => getCampusScore(buildings),             [buildings, tick])
  const categoryWinners = useMemo(() => getCategoryWinners(leaderboard),    [leaderboard])
  const champion      = leaderboard[0]
  const podium        = leaderboard.slice(0, 3)
  const rest          = leaderboard.slice(3)

  // Total badges awarded today
  const totalBadges = leaderboard.reduce((s, b) => s + b.badges.length, 0)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={22} className="text-yellow-400" />
            <h1 className="text-2xl font-bold text-white">Energy Leaderboard</h1>
          </div>
          <p className="text-text-dim text-sm">
            Live building rankings · Efficiency scores · Badge awards · Updated every 30s
          </p>
        </div>
        {/* Campus score */}
        <div className="flex items-center gap-3 glass rounded-2xl border border-dark-border px-4 py-3">
          <div className="relative">
            <ScoreRing score={campusScore.avg} size={52} color={campusScore.color} strokeWidth={4} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black font-mono" style={{ color: campusScore.color }}>
                <AnimNum value={campusScore.avg} />
              </span>
            </div>
          </div>
          <div>
            <p className="text-text-dim text-xxs">Campus Score</p>
            <p className="text-white font-bold text-sm">{campusScore.grade} · {campusScore.label}</p>
            <p className="text-text-dim text-xxs">{totalBadges} badges awarded today</p>
          </div>
        </div>
      </div>

      {/* ── Champion Hero ────────────────────────────────────────────────────── */}
      {champion && <ChampionCard building={champion} />}

      {/* ── Category Winners ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
          <Star size={14} className="text-yellow-400" />
          Category Champions
          <span className="text-text-dim text-xs font-normal ml-1">— special awards for today</span>
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {categoryWinners.map(cat => <CategoryCard key={cat.key} cat={cat} />)}
        </div>
      </div>

      {/* ── Podium (Top 3) ────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
          <Trophy size={14} className="text-yellow-400" />
          Top 3 Podium
          <span className="text-text-dim text-xs font-normal ml-1">— click any card to expand score breakdown</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Classic podium order: 2nd | 1st | 3rd */}
          {[podium[1], podium[0], podium[2]].filter(Boolean).map(b => (
            <PodiumCard key={b.id} building={b} />
          ))}
        </div>
      </div>

      {/* ── Full rankings 4–N ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
          <Zap size={14} className="text-accent-blue" />
          Full Rankings
          <span className="text-text-dim text-xs font-normal ml-1">— click to expand each building</span>
        </h3>
        <div className="space-y-2">
          {rest.map((b, i) => (
            <RankRow key={b.id} building={b} rank={i + 4} />
          ))}
        </div>
      </div>

      {/* ── Badge Gallery ─────────────────────────────────────────────────────── */}
      <BadgeGallery leaderboard={leaderboard} />

    </div>
  )
}
