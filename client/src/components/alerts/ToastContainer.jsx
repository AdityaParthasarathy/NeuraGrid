import React, { useEffect, useState } from 'react'
import { X, Zap, AlertTriangle, Wind, Thermometer, Moon, Info } from 'lucide-react'
import { useAlerts } from '../../context/AlertContext'
import { SEV } from '../../context/alertConstants'
import clsx from 'clsx'

const ICON_MAP = {
  zap: Zap, 'alert-triangle': AlertTriangle, wind: Wind,
  thermometer: Thermometer, moon: Moon, info: Info,
}

function Toast({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const sev  = SEV[alert.severity] ?? SEV.info
  const Icon = ICON_MAP[alert.icon] ?? AlertTriangle

  // Slide in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => onDismiss(alert.id), 300)
  }

  // Auto-leave on 6s (context removes it, this is just animation)
  useEffect(() => {
    const t = setTimeout(() => { setLeaving(true) }, 6000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="pointer-events-auto w-[340px] rounded-2xl border overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.97)',
        borderColor: sev.border,
        boxShadow: `0 0 30px ${sev.color}22, 0 8px 32px rgba(0,0,0,0.3)`,
        backdropFilter: 'blur(20px)',
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(110%)',
        opacity: leaving ? 0 : 1,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      }}
    >
      {/* Severity bar at top */}
      <div className="h-0.5 w-full" style={{ background: sev.color }} />

      <div className="flex items-start gap-3 p-3.5">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
        >
          <Icon size={14} style={{ color: sev.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className="chip text-[9px] font-bold flex-shrink-0"
              style={{ background: sev.bg, color: sev.color }}
            >
              {sev.label}
            </span>
            <button
              onClick={dismiss}
              className="text-text-dim hover:text-gray-900 transition-colors flex-shrink-0 -mt-0.5"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-gray-900 text-xs font-semibold leading-snug mt-1">{alert.title}</p>
          <p className="text-text-dim text-[11px] mt-0.5 leading-relaxed line-clamp-2">{alert.message}</p>
          <p className="text-text-dim text-[10px] mt-1.5 font-mono opacity-60">
            {alert.building}
          </p>
        </div>
      </div>

      {/* Progress bar (drains over 6s) */}
      <div className="h-0.5 mx-3.5 mb-2.5 rounded-full" style={{ background: 'rgba(0,0,0,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{
            background: sev.color,
            animation: 'drainProgress 6s linear forwards',
          }}
        />
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useAlerts()

  return (
    <>
      {/* Inject drain animation */}
      <style>{`
        @keyframes drainProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      {/* Fixed stack — bottom-right */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none"
        style={{ maxWidth: 340 }}
      >
        {toasts.map(t => (
          <Toast key={t.id} alert={t} onDismiss={dismissToast} />
        ))}
      </div>
    </>
  )
}
