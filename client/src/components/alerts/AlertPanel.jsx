import React, { useState, useEffect } from 'react'
import {
  X, Zap, AlertTriangle, Wind, Thermometer, Moon, Info,
  Bell, BellOff, Trash2, CheckCheck,
  ShieldAlert, Clock,
  ChevronDown, ChevronUp,
  Play, CheckCircle2, EyeOff, Lightbulb, Wrench,
} from 'lucide-react'
import { useAlerts } from '../../context/AlertContext'
import { SEV } from '../../context/alertConstants'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const ICON_MAP = {
  zap: Zap, 'alert-triangle': AlertTriangle, wind: Wind,
  thermometer: Thermometer, moon: Moon, info: Info,
}

const TYPE_LABEL = {
  energy_spike: 'Energy Spike',
  night_usage:  'Night Anomaly',
  overloaded:   'Overloaded',
  co2_critical: 'CO₂ Alert',
  temp_spike:   'Temperature',
  info_tip:     'Info',
}

const URGENCY_COLOR = { high: '#DB2777', medium: '#EA580C', low: '#0284C7' }

// ─── Simulation Preview ───────────────────────────────────────────────────────
function SimPreview({ result, onApply }) {
  const rows = []
  if (result.before.load !== result.after.load) rows.push({ label: 'Load', before: `${result.before.load} kW`, after: `${result.after.load} kW` })
  if (result.before.co2  !== result.after.co2)  rows.push({ label: 'CO₂',  before: `${result.before.co2} ppm`, after: `${result.after.co2} ppm` })
  if (result.before.temp !== result.after.temp) rows.push({ label: 'Temp', before: `${result.before.temp}°F`,   after: `${result.after.temp}°F` })

  return (
    <div
      className="mt-2 rounded-lg p-2.5 space-y-2"
      style={{ background: 'rgba(2,132,199,0.04)', border: '1px solid rgba(2,132,199,0.18)' }}
    >
      <p className="text-[9px] font-bold text-accent-blue tracking-wider uppercase">Predicted Impact</p>

      {rows.length > 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {rows.map(r => (
            <div key={r.label} className="text-center">
              <p className="text-text-dim text-[9px] mb-0.5">{r.label}</p>
              <p className="text-[10px]">
                <span className="text-text-dim">{r.before}</span>
                <span className="text-text-dim mx-0.5">→</span>
                <span className="font-bold" style={{ color: '#22c55e' }}>{r.after}</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-text-dim text-[10px]">Operational improvement — no numeric reduction.</p>
      )}

      <button
        onClick={onApply}
        className="w-full py-1.5 rounded-md text-[11px] font-bold text-emerald-700 transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-1.5"
        style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.35), rgba(34,197,94,0.18))', border: '1px solid rgba(34,197,94,0.45)' }}
      >
        <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
        Apply Fix
      </button>
    </div>
  )
}

// ─── Single Recommendation Row ────────────────────────────────────────────────
function RecRow({ alertId, rec, simulationResults, onSimulate, onApply }) {
  const simKey    = `${alertId}-${rec.id}`
  const simResult = simulationResults[simKey]
  const uc        = URGENCY_COLOR[rec.urgency] ?? '#0284C7'

  return (
    <div
      className="rounded-lg p-2.5 space-y-1.5"
      style={{ background: 'rgba(248,250,252,0.9)', border: '1px solid rgba(203,213,225,0.8)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            className="chip text-[8px] font-bold flex-shrink-0"
            style={{ background: `${uc}22`, color: uc, border: `1px solid ${uc}44` }}
          >
            {rec.urgency.toUpperCase()}
          </span>
          <span className="text-gray-900 text-[11px] font-medium truncate">{rec.label}</span>
        </div>

        {!simResult && (
          <button
            onClick={() => onSimulate(alertId, rec.id)}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md flex-shrink-0 transition-all hover:opacity-90"
            style={{ background: 'rgba(2,132,199,0.10)', border: '1px solid rgba(2,132,199,0.30)', color: '#0284C7' }}
          >
            <Play size={8} />
            Simulate
          </button>
        )}

        {simResult && (
          <span className="text-[9px] flex-shrink-0" style={{ color: '#22c55e' }}>● Simulated</span>
        )}
      </div>

      {/* Impact description */}
      <p className="text-text-dim text-[10px] leading-relaxed">{rec.impact.description}</p>

      {/* Simulation result */}
      {simResult && (
        <SimPreview result={simResult} onApply={() => onApply(alertId, rec.id)} />
      )}
    </div>
  )
}

// ─── Alert Card (expandable) ─────────────────────────────────────────────────
function AlertCard({ alert, onDismiss, onMarkSeen, onSimulate, onApply, onIgnore, simulationResults }) {
  const [expanded, setExpanded] = useState(false)

  const sev        = SEV[alert.severity] ?? SEV.info
  const Icon       = ICON_MAP[alert.icon] ?? AlertTriangle
  const ago        = formatDistanceToNow(new Date(alert.ts), { addSuffix: true })
  const isResolved = alert.status === 'resolved'
  const isIgnored  = alert.status === 'ignored'
  const recs       = alert.recommendations ?? []
  const hasRecs    = recs.length > 0 && !isResolved && !isIgnored

  // Severity color overrides for resolved / ignored
  const labelText = isResolved ? 'RESOLVED' : isIgnored ? 'IGNORED' : sev.label
  const labelColor = isResolved ? '#22c55e' : isIgnored ? '#6b7280' : sev.color
  const labelBg    = isResolved ? 'rgba(34,197,94,0.12)' : isIgnored ? 'rgba(107,114,128,0.12)' : sev.bg

  return (
    <div
      className={clsx(
        'relative border-b border-base-border/60 transition-all duration-200',
        isIgnored  && 'opacity-40',
        isResolved && 'opacity-55',
        !alert.seen && !isIgnored && !isResolved && 'bg-slate-100/70',
      )}
    >
      {/* Unseen dot */}
      {!alert.seen && !isIgnored && !isResolved && (
        <div
          className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full"
          style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}` }}
        />
      )}

      {/* ── Main clickable row ─────────────────────────────────── */}
      <div
        className="flex gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition-colors"
        onClick={() => {
          if (!alert.seen) onMarkSeen(alert.id)
          if (hasRecs) setExpanded(e => !e)
        }}
      >
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
          style={{ background: isResolved ? 'rgba(34,197,94,0.12)' : sev.bg, border: `1px solid ${isResolved ? 'rgba(34,197,94,0.35)' : sev.border}` }}
        >
          {isResolved
            ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
            : <Icon size={13} style={{ color: sev.color }} />
          }
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="chip text-[9px] font-bold"
                style={{ background: labelBg, color: labelColor }}
              >
                {labelText}
              </span>
              <span className="text-text-dim text-[10px]">{TYPE_LABEL[alert.type] ?? alert.type}</span>

              {/* Recommendations badge */}
              {hasRecs && (
                <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'rgba(2,132,199,0.55)' }}>
                  <Lightbulb size={8} />
                  {recs.length} fix{recs.length > 1 ? 'es' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Expand chevron */}
              {hasRecs && (
                expanded
                  ? <ChevronUp  size={11} className="text-text-dim" />
                  : <ChevronDown size={11} className="text-text-dim" />
              )}
              {/* Dismiss */}
              <button
                onClick={e => { e.stopPropagation(); onDismiss(alert.id) }}
                className="text-text-dim hover:text-gray-900 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          </div>

          <p className="text-gray-900 text-xs font-semibold leading-snug mt-1">{alert.title}</p>
          <p className="text-text-dim text-[11px] mt-0.5 leading-relaxed">{alert.message}</p>

          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-dim">
            <span className="flex items-center gap-1">
              <Clock size={9} />
              {ago}
            </span>
            <span style={{ color: sev.color }} className="opacity-75">{alert.building}</span>
          </div>
        </div>
      </div>

      {/* ── Expanded recommendations panel ────────────────────────── */}
      {expanded && hasRecs && (
        <div className="px-4 pb-4 space-y-2">
          {/* Section header */}
          <div className="flex items-center gap-1.5 pt-0.5 pb-1 border-t border-base-border/40">
            <Wrench size={9} className="text-accent-blue" />
            <p className="text-[10px] font-semibold text-accent-blue">Recommended Actions</p>
          </div>

          {/* Recommendations */}
          {recs.map(rec => (
            <RecRow
              key={rec.id}
              alertId={alert.id}
              rec={rec}
              simulationResults={simulationResults}
              onSimulate={onSimulate}
              onApply={onApply}
            />
          ))}

          {/* Ignore button */}
          <button
            onClick={() => { onIgnore(alert.id); setExpanded(false) }}
            className="w-full pt-1 pb-0.5 text-[10px] text-text-dim hover:text-accent-pink transition-colors flex items-center justify-center gap-1.5"
          >
            <EyeOff size={9} />
            Ignore this alert
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function AlertPanel({ open, onClose }) {
  const {
    alerts, unseenCount,
    dismissAlert, markSeen, markAllSeen, clearAll,
    simulate, applyFix, ignoreAlert, simulationResults,
  } = useAlerts()

  const [filter,  setFilter]  = useState('all')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) setTimeout(() => setVisible(true), 10)
    else setVisible(false)
  }, [open])

  // Active-only counts for tabs (ignored/resolved still count toward total but not active)
  const activeAlerts = alerts.filter(a => a.status !== 'ignored')
  const critCount    = activeAlerts.filter(a => a.severity === 'critical').length
  const warnCount    = activeAlerts.filter(a => a.severity === 'warning').length
  const infoCount    = activeAlerts.filter(a => a.severity === 'info').length

  const filtered = (() => {
    const base = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)
    return base
  })()

  const TABS = [
    { key: 'all',      label: 'All',      count: alerts.length },
    { key: 'critical', label: 'Critical', count: critCount },
    { key: 'warning',  label: 'Warning',  count: warnCount },
    { key: 'info',     label: 'Info',     count: infoCount },
  ]

  if (!open && !visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-slate-900/20 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-[1001] flex flex-col"
        style={{
          width: 'min(440px, 100vw)',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent-pink/10 border border-accent-pink/25 flex items-center justify-center">
              <Bell size={14} className="text-accent-pink" />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-sm">Alert Center</h2>
              <p className="text-text-dim text-[11px]">
                {unseenCount > 0 ? `${unseenCount} unread` : 'All caught up'} · {alerts.length} total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 border border-base-border flex items-center justify-center text-text-dim hover:text-gray-900 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Severity summary strip ───────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-base-border border-b border-base-border flex-shrink-0">
          {[
            { label: 'Critical', count: critCount, color: '#DB2777', icon: ShieldAlert },
            { label: 'Warning',  count: warnCount, color: '#EA580C', icon: AlertTriangle },
            { label: 'Info',     count: infoCount,  color: '#0284C7', icon: Info },
          ].map(({ label, count, color, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center py-3 gap-1">
              <Icon size={14} style={{ color }} />
              <span className="font-bold font-mono text-lg leading-none" style={{ color }}>{count}</span>
              <span className="text-text-dim text-[10px]">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Tabs + actions ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-base-border flex-shrink-0">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  filter === t.key
                    ? 'bg-slate-200 text-gray-900'
                    : 'text-text-dim hover:text-gray-900'
                )}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1 opacity-60">{t.count}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={markAllSeen}
              title="Mark all as read"
              className="w-7 h-7 rounded-lg border border-base-border flex items-center justify-center text-text-dim hover:text-accent-blue transition-colors"
            >
              <CheckCheck size={12} />
            </button>
            <button
              onClick={clearAll}
              title="Clear all alerts"
              className="w-7 h-7 rounded-lg border border-base-border flex items-center justify-center text-text-dim hover:text-accent-pink transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* ── Alert list ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-base-border flex items-center justify-center">
                <BellOff size={22} className="text-text-dim" />
              </div>
              <p className="text-gray-900 font-semibold text-sm">No alerts</p>
              <p className="text-text-dim text-xs">All systems operating normally in this category.</p>
            </div>
          ) : (
            filtered.map(a => (
              <AlertCard
                key={a.id}
                alert={a}
                onDismiss={dismissAlert}
                onMarkSeen={markSeen}
                onSimulate={simulate}
                onApply={applyFix}
                onIgnore={ignoreAlert}
                simulationResults={simulationResults}
              />
            ))
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-t border-base-border flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
            Live monitoring · every 8s
          </div>
          <button
            onClick={clearAll}
            className="text-[11px] text-text-dim hover:text-accent-pink transition-colors flex items-center gap-1"
          >
            <Trash2 size={10} />
            Clear all
          </button>
        </div>
      </div>
    </>
  )
}
