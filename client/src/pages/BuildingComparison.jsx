/**
 * NeuraGrid — Building Comparison "Compare"
 * Side-by-side real-time comparison of any two campus buildings.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useEnergy } from '../context/EnergyContext'
import { calcEnergyScore } from '../utils/aiEngine'
import {
  LineChart, Line, ResponsiveContainer, Tooltip as ChartTooltip,
} from 'recharts'
import {
  Scale, Trophy, Zap, Wind, Leaf, GraduationCap,
  TrendingUp, BarChart3, RefreshCw, ChevronDown, Flame, Shield,
  ArrowRight, Minus, Sparkles,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Metric definitions ───────────────────────────────────────────────────────
const METRICS = [
  {
    key:    'load',
    label:  'Energy Consumption',
    unit:   'kW',
    icon:   Zap,
    better: 'lower',
    max:    b => b.capacity,
    get:    b => b.currentLoad,
    format: v => v.toLocaleString(),
    color:  '#0284C7',
  },
  {
    key:    'score',
    label:  'Efficiency Score',
    unit:   '/100',
    icon:   BarChart3,
    better: 'higher',
    max:    () => 100,
    get:    (b, s) => s,
    format: v => v,
    color:  '#7C3AED',
  },
  {
    key:    'co2',
    label:  'CO₂ Emissions',
    unit:   'kg/hr',
    icon:   Wind,
    better: 'lower',
    max:    b => Math.ceil(b.capacity * 0.82 / 50) * 50,
    get:    b => Math.round(b.currentLoad * 0.82),
    format: v => v,
    color:  '#EA580C',
  },
  {
    key:    'renewable',
    label:  'Renewable Energy',
    unit:   '%',
    icon:   Leaf,
    better: 'higher',
    max:    () => 100,
    get:    b => b.renewableContribution,
    format: v => v,
    color:  '#059669',
  },
  {
    key:    'rooms',
    label:  'Total Classrooms',
    unit:   '',
    icon:   GraduationCap,
    better: null,           // neutral — no winner
    max:    () => 60,
    get:    b => b.classroomCount,
    format: v => v,
    color:  '#EA580C',
  },
  {
    key:    'loadpct',
    label:  'Active Load',
    unit:   '%',
    icon:   TrendingUp,
    better: 'lower',
    max:    () => 100,
    get:    b => Math.round((b.currentLoad / b.capacity) * 100),
    format: v => `${v}`,
    color:  '#DB2777',
  },
]

// Metrics used in winner scoring (first 3 scoreable ones)
const SCORE_METRICS = METRICS.filter(m => m.better !== null).slice(0, 3)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(val, max) {
  return Math.min(100, Math.max(0, max > 0 ? (val / max) * 100 : 0))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Tiny sparkline powered by Recharts */
function Sparkline({ data, color, loading }) {
  if (loading || data.length < 2) {
    return (
      <div className="w-full h-16 flex items-center justify-center">
        <span className="text-text-dim text-xs animate-pulse">Collecting data…</span>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <ChartTooltip
          contentStyle={{ background: '#FFFFFF', border: `1px solid ${color}33`, borderRadius: 8, fontSize: 11, color: '#1F2937' }}
          itemStyle={{ color }}
          formatter={v => [`${v} kW`, 'Load']}
          labelFormatter={() => ''}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Styled building dropdown */
function BuildingSelect({ value, onChange, exclude, buildings, side }) {
  const accentColor = side === 'left' ? '#0284C7' : '#7C3AED'
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full pl-4 pr-9 py-2.5 rounded-xl text-sm font-semibold text-gray-900
                   cursor-pointer transition-all duration-200 focus:outline-none"
        style={{
          background:   '#FFFFFF',
          border:       `1.5px solid ${accentColor}40`,
          boxShadow:    `0 2px 12px ${accentColor}15`,
          color:        '#111827',
        }}
        onFocus={e  => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 20px ${accentColor}35` }}
        onBlur={e   => { e.target.style.borderColor = `${accentColor}40`; e.target.style.boxShadow = `0 0 12px ${accentColor}15` }}
      >
        {buildings.filter(b => b.id !== exclude).map(b => (
          <option key={b.id} value={b.id} style={{ background: '#FFFFFF', color: '#111827' }}>
            {b.icon}  {b.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: accentColor }}
      />
    </div>
  )
}

/** Animated horizontal progress bar */
function MetricBar({ value, max, color, flip = false }) {
  const width = pct(value, max)
  return (
    <div
      className="h-2 rounded-full overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.06)', width: '100%' }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width:      `${width}%`,
          background: `linear-gradient(${flip ? '270deg' : '90deg'}, ${color}aa, ${color})`,
          boxShadow:  `0 0 8px ${color}30`,
          ...(flip ? { marginLeft: 'auto' } : {}),
        }}
      />
    </div>
  )
}

/** Single metric comparison row */
function MetricRow({ metric, leftB, rightB, leftScore, rightScore }) {
  const Icon    = metric.icon
  const leftVal  = metric.get(leftB,  leftScore)
  const rightVal = metric.get(rightB, rightScore)
  const leftMax  = metric.max(leftB)
  const rightMax = metric.max(rightB)

  let leftWins = null   // true | false | null (tie / neutral)
  if (metric.better === 'higher') leftWins = leftVal > rightVal ? true : leftVal < rightVal ? false : null
  if (metric.better === 'lower')  leftWins = leftVal < rightVal ? true : leftVal > rightVal ? false : null

  const winColor  = '#059669'
  const loseColor = '#DB2777'
  const tieColor  = '#7C3AED'

  const leftColor  = leftWins === true ? winColor : leftWins === false ? loseColor : metric.color
  const rightColor = leftWins === false ? winColor : leftWins === true ? loseColor : metric.color

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-white/5 last:border-0">

      {/* ── Left side ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-end gap-2">
          {leftWins === true  && <span className="text-accent-green text-xxs font-bold">BETTER</span>}
          {leftWins === false && <span className="text-accent-pink  text-xxs font-bold">WORSE</span>}
          <span
            className="font-mono font-bold text-sm transition-all duration-300"
            style={{ color: leftColor }}
          >
            {metric.format(leftVal)}<span className="text-xs font-normal opacity-60 ml-0.5">{metric.unit}</span>
          </span>
        </div>
        <MetricBar value={leftVal} max={leftMax} color={leftColor} flip />
      </div>

      {/* ── Center icon ── */}
      <div className="flex flex-col items-center gap-1 w-24">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${metric.color}15`, border: `1px solid ${metric.color}30` }}
        >
          <Icon size={13} style={{ color: metric.color }} />
        </div>
        <span className="text-text-dim text-xxs text-center leading-tight">{metric.label}</span>
        {/* Tie/win indicator */}
        <div className="flex items-center gap-1 mt-0.5">
          {leftWins === true  && <ArrowRight size={10} className="rotate-180 text-accent-green" />}
          {leftWins === false && <ArrowRight size={10} className="text-accent-green" />}
          {leftWins === null  && metric.better !== null && <Minus size={10} style={{ color: tieColor }} />}
          {leftWins === null  && metric.better === null && <Minus size={10} className="text-text-dim" />}
        </div>
      </div>

      {/* ── Right side ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-start gap-2">
          <span
            className="font-mono font-bold text-sm transition-all duration-300"
            style={{ color: rightColor }}
          >
            {metric.format(rightVal)}<span className="text-xs font-normal opacity-60 ml-0.5">{metric.unit}</span>
          </span>
          {leftWins === false && <span className="text-accent-green text-xxs font-bold">BETTER</span>}
          {leftWins === true  && <span className="text-accent-pink  text-xxs font-bold">WORSE</span>}
        </div>
        <MetricBar value={rightVal} max={rightMax} color={rightColor} />
      </div>
    </div>
  )
}

/** Building header card */
function BuildingHeader({ building, isWinner, score, side }) {
  const accentColor = side === 'left' ? building.color : building.color
  return (
    <div
      className="rounded-2xl p-4 transition-all duration-500 relative overflow-hidden"
      style={{
        background:  '#FFFFFF',
        border:      `1.5px solid ${isWinner ? accentColor : accentColor + '40'}`,
        boxShadow:   isWinner ? `0 8px 30px ${accentColor}20, 0 4px 60px ${accentColor}10` : '0 2px 10px rgba(0,0,0,0.05)',
      }}
    >
      {isWinner && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
        />
      )}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl leading-none">{building.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base leading-tight truncate">{building.name}</h3>
          <p className="text-text-dim text-xs capitalize">{building.type} · {building.floors}F · {building.area}</p>
        </div>
        {isWinner && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}60` }}
          >
            <Trophy size={16} style={{ color: accentColor }} />
          </div>
        )}
      </div>

      {/* Score ring */}
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke={accentColor} strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - score / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 4px ${accentColor}40)` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm font-mono">{score}</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div>
            <div className="flex justify-between text-xxs mb-1">
              <span className="text-text-dim">Load</span>
              <span className="font-mono" style={{ color: accentColor }}>
                {building.currentLoad.toLocaleString()} / {building.capacity.toLocaleString()} kW
              </span>
            </div>
            <MetricBar
              value={building.currentLoad}
              max={building.capacity}
              color={building.currentLoad / building.capacity > 0.8 ? '#DB2777' : accentColor}
            />
          </div>
          <div>
            <div className="flex justify-between text-xxs mb-1">
              <span className="text-text-dim">Status</span>
              <span className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                'border-base-border bg-base-elevated text-text-dim hover:text-text-main'
              )}>
                ● {building.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BuildingComparison() {
  const { buildings, getBuildingScore } = useEnergy()

  // Default: Green vs A-Block
  const [leftId,  setLeftId]  = useState('green')
  const [rightId, setRightId] = useState('ablock')

  // Sparkline history: { [buildingId]: Array<{i, v}> }
  const histRef  = useRef({})
  const [sparkL, setSparkL] = useState([])
  const [sparkR, setSparkR] = useState([])

  const leftB  = buildings.find(b => b.id === leftId)  ?? buildings[0]
  const rightB = buildings.find(b => b.id === rightId) ?? buildings[1]

  const leftScore  = useMemo(() => calcEnergyScore(leftB),  [leftB])
  const rightScore = useMemo(() => calcEnergyScore(rightB), [rightB])

  // Accumulate sparkline history on every live tick
  useEffect(() => {
    const append = (id, val) => {
      if (!histRef.current[id]) histRef.current[id] = []
      const arr = histRef.current[id]
      arr.push({ i: arr.length, v: val })
      if (arr.length > 18) arr.shift()
      // Re-index
      return arr.map((d, idx) => ({ ...d, i: idx }))
    }
    setSparkL(append(leftId,  leftB.currentLoad))
    setSparkR(append(rightId, rightB.currentLoad))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftB.currentLoad, rightB.currentLoad, leftId, rightId])

  // Reset history when buildings change
  const handleLeftChange = useCallback(id => {
    histRef.current[id] = []
    setSparkL([])
    setLeftId(id)
  }, [])
  const handleRightChange = useCallback(id => {
    histRef.current[id] = []
    setSparkR([])
    setRightId(id)
  }, [])

  const handleSwap = () => {
    const tmp = leftId
    handleLeftChange(rightId)
    handleRightChange(tmp)
  }

  // ── Winner calculation ─────────────────────────────────────────────────────
  const { leftWins, rightWins, winner, winnerDiff } = useMemo(() => {
    let lw = 0, rw = 0
    const details = []

    SCORE_METRICS.forEach(m => {
      const lv = m.get(leftB,  leftScore)
      const rv = m.get(rightB, rightScore)
      if (m.better === 'higher') {
        if (lv > rv) { lw++; details.push({ m, winner: 'left',  diff: lv - rv, pct: Math.round((lv - rv) / Math.max(rv, 1) * 100) }) }
        else if (rv > lv) { rw++; details.push({ m, winner: 'right', diff: rv - lv, pct: Math.round((rv - lv) / Math.max(lv, 1) * 100) }) }
      } else if (m.better === 'lower') {
        if (lv < rv) { lw++; details.push({ m, winner: 'left',  diff: rv - lv, pct: Math.round((rv - lv) / Math.max(rv, 1) * 100) }) }
        else if (rv < lv) { rw++; details.push({ m, winner: 'right', diff: lv - rv, pct: Math.round((rv - lv) / Math.max(lv, 1) * 100) }) }
      }
    })

    const winner = lw > rw ? 'left' : rw > lw ? 'right' : 'tie'

    // Best differentiating stat for the summary line
    const topDiff = details
      .filter(d => d.winner === winner)
      .sort((a, b) => b.pct - a.pct)[0]

    let winnerDiff = ''
    if (winner === 'left' && topDiff) {
      winnerDiff = `${leftB.name} ${topDiff.m.better === 'lower' ? 'uses' : 'scores'} ${topDiff.pct}% ${topDiff.m.better === 'lower' ? 'less' : 'higher'} on ${topDiff.m.label}`
    } else if (winner === 'right' && topDiff) {
      winnerDiff = `${rightB.name} ${topDiff.m.better === 'lower' ? 'uses' : 'scores'} ${topDiff.pct}% ${topDiff.m.better === 'lower' ? 'less' : 'higher'} on ${topDiff.m.label}`
    }

    return { leftWins: lw, rightWins: rw, winner, winnerDiff }
  }, [leftB, rightB, leftScore, rightScore])

  const winnerBuilding = winner === 'left' ? leftB : winner === 'right' ? rightB : null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(219,39,119,0.15)', border: '1px solid rgba(219,39,119,0.35)' }}
          >
            <Scale size={20} style={{ color: '#DB2777' }} />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Compare</h1>
            <p className="text-text-dim text-xs">Side-by-side building comparison · live data</p>
          </div>
        </div>

        <button
          onClick={handleSwap}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                     text-text-dim hover:text-gray-900"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          <RefreshCw size={13} />
          Swap
        </button>
      </div>

      {/* ── Selectors row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <BuildingSelect
          value={leftId}
          onChange={handleLeftChange}
          exclude={rightId}
          buildings={buildings}
          side="left"
        />

        {/* VS badge */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm"
            style={{
              background:  'linear-gradient(135deg, rgba(2,132,199,0.15), rgba(219,39,119,0.15))',
              border:      '2px solid rgba(219,39,119,0.4)',
              color:       '#DB2777',
              boxShadow:   '0 4px 20px rgba(219,39,119,0.2)',
              animation:   'pulse 2s ease-in-out infinite',
            }}
          >
            VS
          </div>
        </div>

        <BuildingSelect
          value={rightId}
          onChange={handleRightChange}
          exclude={leftId}
          buildings={buildings}
          side="right"
        />
      </div>

      {/* ── Winner banner ───────────────────────────────────────────────── */}
      {winner !== 'tie' && winnerBuilding && (
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center justify-between"
          style={{
            background:  `linear-gradient(135deg, ${winnerBuilding.color}15, ${winnerBuilding.color}08)`,
            border:      `1px solid ${winnerBuilding.color}35`,
            boxShadow:   `0 0 24px ${winnerBuilding.color}15`,
          }}
        >
          <div className="flex items-center gap-3">
            <Trophy size={22} style={{ color: winnerBuilding.color }} />
            <div>
              <p className="text-gray-900 font-bold text-sm">
                🏆 Winner: <span style={{ color: winnerBuilding.color }}>{winnerBuilding.name}</span>
              </p>
              {winnerDiff && (
                <p className="text-text-dim text-xs mt-0.5">{winnerDiff}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <span style={{ color: winnerBuilding.color }} className="font-bold">
              {Math.max(leftWins, rightWins)}
            </span>
            <span>/</span>
            <span>{SCORE_METRICS.length} metrics won</span>
          </div>
        </div>
      )}

      {winner === 'tie' && (
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center gap-3"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}
        >
          <Shield size={20} className="text-accent-purple" />
          <div>
            <p className="text-white font-bold text-sm">⚖️ It's a Tie!</p>
            <p className="text-text-dim text-xs">Both buildings are equally matched across scored metrics.</p>
          </div>
        </div>
      )}

      {/* ── Main comparison panel ────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4">

        {/* Left building header */}
        <BuildingHeader
          building={leftB}
          isWinner={winner === 'left'}
          score={leftScore}
          side="left"
        />

        {/* Center label */}
        <div className="flex items-center justify-center w-6">
          <div
            className="h-full w-px rounded-full"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.12), transparent)' }}
          />
        </div>

        {/* Right building header */}
        <BuildingHeader
          building={rightB}
          isWinner={winner === 'right'}
          score={rightScore}
          side="right"
        />
      </div>

      {/* ── Metrics comparison ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Scale size={18} className="text-accent-blue" />
            Metric Comparison
          </h2>
          <div className="flex items-center gap-4 text-xxs text-text-dim">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-green inline-block" /> Better</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-pink  inline-block" /> Worse</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-purple inline-block" /> Tied</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 mb-2 pb-2 border-b border-black/10">
          <p
            className="text-right text-xs font-bold truncate"
            style={{ color: leftB.color }}
          >
            {leftB.icon} {leftB.shortName}
          </p>
          <div className="w-24" />
          <p
            className="text-left text-xs font-bold truncate"
            style={{ color: rightB.color }}
          >
            {rightB.icon} {rightB.shortName}
          </p>
        </div>

        {/* Metric rows */}
        {METRICS.map(m => (
          <MetricRow
            key={m.key}
            metric={m}
            leftB={leftB}
            rightB={rightB}
            leftScore={leftScore}
            rightScore={rightScore}
          />
        ))}
      </div>

      {/* ── Sparkline charts ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { building: leftB,  data: sparkL, score: leftScore,  isWinner: winner === 'left'  },
          { building: rightB, data: sparkR, score: rightScore, isWinner: winner === 'right' },
        ].map(({ building, data, score, isWinner }) => (
          <div
            key={building.id}
            className="rounded-2xl p-4 transition-all duration-500"
            style={{
              background: '#FFFFFF',
              border:     `1.5px solid ${isWinner ? building.color + '50' : 'rgba(0,0,0,0.06)'}`,
              boxShadow:  isWinner ? `0 8px 20px ${building.color}15` : '0 2px 10px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={18} className="text-accent-purple" />
                </div>
                <div>
                  <h4 className="text-text-main font-bold text-sm">Efficiency Head-to-Head</h4>
                  <p className="text-text-dim text-xs">AI analysis of current operational delta</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isWinner && <Trophy size={14} style={{ color: building.color }} />}
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: building.color }}
                >
                  {building.currentLoad.toLocaleString()} kW
                </span>
              </div>
            </div>
            <Sparkline data={data} color={building.color} loading={data.length < 2} />
            <div className="flex justify-between mt-2 text-xxs text-text-dim">
              <span>← Past</span>
              <span>Now →</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Score summary ────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
      >
        <h2 className="text-gray-900 font-semibold text-sm mb-4 flex items-center gap-2">
          <Flame size={15} className="text-accent-orange" />
          Score Breakdown
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Left wins */}
          <div className="text-center">
            <div
              className="text-4xl font-black font-mono mb-1"
              style={{ color: leftB.color, textShadow: `0 4px 20px ${leftB.color}30` }}
            >
              {leftWins}
            </div>
            <p className="text-text-dim text-xs">{leftB.shortName}</p>
            <p className="text-text-dim text-xxs">metrics won</p>
          </div>
          {/* Center divider */}
          <div className="flex flex-col items-center justify-center gap-2">
            <Scale size={24} style={{ color: winner !== 'tie' ? (winner === 'left' ? leftB.color : rightB.color) : '#7C3AED' }} />
            <span className="text-text-dim text-xxs">of {SCORE_METRICS.length} scored</span>
          </div>
          {/* Right wins */}
          <div className="text-center">
            <div
              className="text-4xl font-black font-mono mb-1"
              style={{ color: rightB.color, textShadow: `0 4px 20px ${rightB.color}30` }}
            >
              {rightWins}
            </div>
            <p className="text-text-dim text-xs">{rightB.shortName}</p>
            <p className="text-text-dim text-xxs">metrics won</p>
          </div>
        </div>
      </div>

    </div>
  )
}
