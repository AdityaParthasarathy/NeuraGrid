import React, { useState, useEffect, useRef } from 'react'
import { Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Leaf, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'

// ─── Animated number ticker (for the live stats strip) ────────────────────────
function Ticker({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const target = value
    const dur    = 1800
    const start  = performance.now()
    const run = now => {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 4)
      setDisplay(Math.round(target * e))
      if (t < 1) raf.current = requestAnimationFrame(run)
    }
    raf.current = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <>{display.toLocaleString()}{suffix}</>
}

// ─── Floating particle (purely decorative) ────────────────────────────────────
function Particle({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width:     style.size,
        height:    style.size,
        left:      style.x,
        top:       style.y,
        background: style.color,
        opacity:   style.opacity,
        filter:    `blur(${style.blur}px)`,
        animation: `float ${style.dur}s ease-in-out ${style.delay}s infinite alternate`,
      }}
    />
  )
}

const PARTICLES = [
  { size: 260, x: '-5%',  y: '10%',  color: '#0284C7', opacity: 0.05, blur: 60, dur: 7,  delay: 0   },
  { size: 320, x: '70%',  y: '-8%',  color: '#7C3AED', opacity: 0.06, blur: 70, dur: 9,  delay: 1.5 },
  { size: 200, x: '85%',  y: '60%',  color: '#059669', opacity: 0.04, blur: 55, dur: 6,  delay: 0.8 },
  { size: 180, x: '15%',  y: '70%',  color: '#7C3AED', opacity: 0.05, blur: 50, dur: 8,  delay: 2   },
  { size: 140, x: '50%',  y: '85%',  color: '#0284C7', opacity: 0.04, blur: 45, dur: 10, delay: 0.3 },
]

// ─── Campus stat card ──────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, suffix, color }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{
        background:   `${color}08`,
        borderColor:  `${color}25`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <p className="text-text-dim text-xxs">{label}</p>
        <p className="font-bold font-mono text-sm leading-tight" style={{ color }}>
          <Ticker value={value} suffix={suffix} />
        </p>
      </div>
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({ label, icon: Icon, type = 'text', value, onChange, placeholder, error, autoFocus }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword ? (show ? 'text' : 'password') : type

  return (
    <div className="space-y-1.5">
      <label className="text-text-dim text-xs font-medium">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon size={15} className="text-text-dim" />
        </span>
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={isPassword ? 'current-password' : type === 'email' ? 'email' : 'name'}
          className={clsx(
            'w-full bg-base-card border rounded-xl pl-10 pr-10 py-3 text-sm text-text-main placeholder-text-dim/50',
            'focus:outline-none transition-all duration-200',
            error
              ? 'border-accent-pink/50 focus:border-accent-pink focus:ring-1 focus:ring-accent-pink/30'
              : 'border-base-border focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20'
          )}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow(s => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: '#DB2777' }}>{error}</p>}
    </div>
  )
}

// ─── Main Auth Page ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode]     = useState('login') // 'login' | 'register'

  // Form fields
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')

  // UI state
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState({})
  const [apiError, setApiError] = useState('')

  // Reset form when switching mode
  function switchMode(next) {
    setMode(next)
    setName(''); setEmail(''); setPassword(''); setConfirm('')
    setErrors({}); setApiError('')
  }

  // ── Validate ────────────────────────────────────────────────────────────────
  function validate() {
    const e = {}
    if (mode === 'register' && !name.trim())
      e.name = 'Full name is required.'
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email))
      e.email = 'Enter a valid email address.'
    if (password.length < 6)
      e.password = 'Password must be at least 6 characters.'
    if (mode === 'register' && password !== confirm)
      e.confirm = 'Passwords do not match.'
    return e
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setApiError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    // Small artificial delay for UX feedback
    await new Promise(r => setTimeout(r, 600))

    const result = mode === 'login'
      ? login({ email, password })
      : register({ name, email, password })

    setLoading(false)
    if (!result.ok) setApiError(result.error)
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: '#F8FAFC' }}
    >
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(2,132,199,0.06) 1px, transparent 1px)',
          backgroundSize:  '32px 32px',
        }}
      />

      {/* Ambient glow orbs */}
      {PARTICLES.map((p, i) => <Particle key={i} style={p} />)}

      {/* Scan line overlay */}
      <div className="scan-overlay pointer-events-none" />

      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mx-4">

        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-2xl blur-xl"
              style={{ background: 'radial-gradient(circle, rgba(2,132,199,0.15) 0%, transparent 70%)' }}
            />
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center border"
              style={{
                background:   'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(124,58,237,0.08) 100%)',
                borderColor:  'rgba(2,132,199,0.25)',
                boxShadow:    '0 8px 32px rgba(2,132,199,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              <Zap size={28} className="text-accent-blue" />
            </div>
          </div>

          <h1 className="text-text-main font-bold text-2xl tracking-tight">NeuraGrid</h1>
          <p className="text-text-dim text-xs uppercase tracking-widest mt-1">
            Smart Campus Energy Twin
          </p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-8 border"
          style={{
            background:  'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(2,132,199,0.08)',
            boxShadow:   '0 24px 64px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          {/* Mode tabs */}
          <div
            className="flex rounded-xl p-1 mb-7 border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {[
              { key: 'login',    label: 'Sign In'   },
              { key: 'register', label: 'Register'  },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                  mode === key
                    ? 'text-accent-blue bg-white shadow-sm border border-accent-blue/10'
                    : 'text-text-dim hover:text-text-main'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-text-main font-bold text-lg">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-text-dim text-sm mt-1">
              {mode === 'login'
                ? 'Sign in to access your campus energy dashboard.'
                : 'Join NeuraGrid and start monitoring campus energy.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {mode === 'register' && (
              <Field
                label="Full Name"
                icon={User}
                value={name}
                onChange={setName}
                placeholder="Dr. Jane Smith"
                error={errors.name}
                autoFocus
              />
            )}

            <Field
              label="Email Address"
              icon={Mail}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@university.edu"
              error={errors.email}
              autoFocus={mode === 'login'}
            />

            <Field
              label="Password"
              icon={Lock}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
              error={errors.password}
            />

            {mode === 'register' && (
              <Field
                label="Confirm Password"
                icon={Lock}
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Repeat your password"
                error={errors.confirm}
              />
            )}

            {/* API-level error */}
            {apiError && (
              <div
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm border"
                style={{
                  background:  'rgba(219,39,119,0.06)',
                  borderColor: 'rgba(219,39,119,0.2)',
                  color:       '#DB2777',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#DB2777' }} />
                {apiError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all duration-200 mt-2"
              style={{
                background:  loading
                  ? 'rgba(2,132,199,0.1)'
                  : 'linear-gradient(135deg, #0284C7 0%, #7C3AED 100%)',
                color:       loading ? '#0284C7' : '#FFFFFF',
                boxShadow:   loading ? 'none' : '0 8px 24px rgba(2,132,199,0.2)',
                border:      loading ? '1px solid rgba(2,132,199,0.2)' : 'none',
                opacity:     loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <div
                    className="w-4 h-4 border-2 rounded-full border-t-transparent animate-spin"
                    style={{ borderColor: '#0284C7', borderTopColor: 'transparent' }}
                  />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Switch mode helper text */}
          <p className="text-center text-text-dim text-xs mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: '#0284C7' }}
            >
              {mode === 'login' ? 'Register here' : 'Sign in instead'}
            </button>
          </p>
        </div>

        {/* Live campus stats strip */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatCard icon={Zap}      label="Campus Load"  value={1394}  suffix=" kW"  color="#0284C7" />
          <StatCard icon={Leaf}     label="Solar Active" value={110}   suffix=" kW"  color="#059669" />
          <StatCard icon={Activity} label="Buildings"    value={6}     suffix=""     color="#7C3AED" />
        </div>

        <p className="text-center text-text-dim/40 text-xxs mt-5 tracking-wide">
          NeuraGrid Energy Twin v2.1 &nbsp;·&nbsp; Smart Campus Management
        </p>
      </div>
    </div>
  )
}
