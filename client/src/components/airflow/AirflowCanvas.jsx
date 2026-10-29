/**
 * NeuraGrid — AirflowCanvas
 *
 * Canvas-based particle animation representing ventilation airflow for a single
 * building. Runs a continuous requestAnimationFrame loop; the loop reads
 * ventilation and co2 from refs so prop changes take effect immediately without
 * restarting the animation (avoids jank on slider moves).
 *
 * Visual encoding:
 *   Particle colour  → blends cyan (clean/high-vent) → amber → red (stale/low-vent + high CO₂)
 *   Particle count   → proportional to ventilation level (2–28)
 *   Particle speed   → proportional to ventilation level
 *   Left-edge arrows → vent inlet markers, scale with intensity
 *
 * Exported helper:
 *   co2OverlayStyle(ppm, ventilation)  → inline style for the background tint div
 *     green (clean) → yellow → red (critical), fades as ventilation rises
 */

import React, { useRef, useEffect } from 'react'

// ─── Math helpers ─────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Vent inlet Y positions as fraction of canvas height (4 intake points)
const VENT_Y = [0.14, 0.37, 0.61, 0.84]

// Cap DPR at 2 — 3× retina would triple canvas pixels for negligible visual gain
const MAX_DPR = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2)

// ─── Particle factory ─────────────────────────────────────────────────────────
function spawnParticle(w, h, slot) {
  return {
    x:   w * Math.random() * 0.03,               // spawn near left wall
    y:   h * VENT_Y[slot % 4] + (Math.random() - 0.5) * 11,
    bsf: 0.55 + Math.random() * 0.90,            // per-particle speed factor
    vy:  (Math.random() - 0.5) * 0.18,           // vertical drift
    ph:  Math.random() * Math.PI * 2,            // sine phase
    fr:  0.009 + Math.random() * 0.013,          // sine frequency
    amp: 3.0  + Math.random() * 5.5,             // sine amplitude (px)
    sz:  1.1  + Math.random() * 1.7,             // dot radius (px)
    t:   0,                                       // life progress 0→1
    ls:  0.0035 + Math.random() * 0.003,          // life speed per frame
    sl:  slot,                                   // spawn slot (for recycling)
  }
}

// Opacity envelope: fade-in over first 12% of life, hold, fade-out over last 22%
function particleAlpha(t) {
  if (t < 0.12) return t / 0.12
  if (t > 0.78) return (1 - t) / 0.22
  return 1
}

// ─── CO₂ overlay style (exported) ────────────────────────────────────────────
/**
 * Returns an inline style object for a semi-transparent colour overlay that
 * communicates air quality. Ventilation "visually clears" the red tint even
 * before the CO₂ reading drops, giving instant slider feedback.
 */
export function co2OverlayStyle(ppm, ventilation) {
  // Apparent severity: high CO₂ minus ventilation credit
  const rawT  = clamp((ppm - 400) / 800, 0, 1)
  const t     = rawT * (1 - (ventilation / 100) * 0.70)

  if (t < 0.04) return { transition: 'background 1.5s ease' }   // clean air — no overlay

  // Colour ramp: green(5,150,105) → amber(234,88,12) → red(219,39,119)
  let r, g, b
  if (t < 0.5) {
    const s = t * 2
    r = Math.round(lerp(5,   234, s))
    g = Math.round(lerp(150,  88, s))
    b = Math.round(lerp(105,  12, s))
  } else {
    const s = (t - 0.5) * 2
    r = Math.round(lerp(234, 219, s))
    g = Math.round(lerp( 88,  39, s))
    b = Math.round(lerp( 12, 119, s))
  }

  const alpha = t * 0.13   // max ~13% opacity — subtle but visible
  return {
    background: [
      `radial-gradient(ellipse at 50% 45%,`,
      `rgba(${r},${g},${b},${(alpha * 1.9).toFixed(3)}) 0%,`,
      `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(3)}) 50%,`,
      `transparent 88%)`,
    ].join(' '),
    transition: 'background 1.5s ease',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * @param {number}  ventilation  0–100 — slider value from EnergyContext
 * @param {number}  co2          ppm reading for this building
 * @param {boolean} active       false → clear canvas and pause RAF
 */
export default function AirflowCanvas({ ventilation = 60, co2 = 600, active = true }) {
  const canvasRef = useRef(null)

  // Mutable refs — RAF loop reads these without restarting when props change
  const ventRef   = useRef(ventilation)
  const co2Ref    = useRef(co2)
  const activeRef = useRef(active)

  useEffect(() => { ventRef.current = ventilation }, [ventilation])
  useEffect(() => { co2Ref.current  = co2         }, [co2])
  useEffect(() => { activeRef.current = active    }, [active])

  // Single mount effect: set up ResizeObserver + RAF loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx       = canvas.getContext('2d', { alpha: true })
    const particles = []
    let   raf       = null

    // ── Resize handler ──────────────────────────────────────────────────────
    function resize() {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      canvas.width  = Math.round(rect.width  * MAX_DPR)
      canvas.height = Math.round(rect.height * MAX_DPR)
    }

    const RO = window.ResizeObserver
      ? new ResizeObserver(resize)
      : { observe() {}, disconnect() {} }
    RO.observe(canvas)
    resize()

    // ── Animation loop ──────────────────────────────────────────────────────
    function frame() {
      raf = requestAnimationFrame(frame)

      const dpr  = MAX_DPR
      const w    = canvas.width  / dpr
      const h    = canvas.height / dpr

      // Reset transform each frame (ResizeObserver may not have re-scaled yet)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      if (!activeRef.current || w < 10 || h < 10) return

      // ── Derived parameters ─────────────────────────────────────────────────
      const vent    = ventRef.current
      const co2ppm  = co2Ref.current
      const intens  = vent / 100                                    // 0–1
      const co2norm = clamp((co2ppm - 400) / 800, 0, 1)            // 0=clean, 1=critical

      // Particle colour: blue(2,132,199) at good conditions, drifts amber→red at poor air
      const tint    = co2norm * (1 - intens * 0.68)
      const pR = Math.round(tint < 0.5 ? lerp(2,   234, tint * 2) : lerp(234, 219, (tint - 0.5) * 2))
      const pG = Math.round(tint < 0.5 ? lerp(132,  88, tint * 2) : lerp(88,  39, (tint - 0.5) * 2))
      const pB = Math.round(tint < 0.5 ? lerp(199,  12, tint * 2) : lerp(12, 119, (tint - 0.5) * 2))
      const maxA   = 0.06 + intens * 0.52
      const target = Math.round(2 + intens * 26)                   // 2–28 particles

      // ── Spawn up to target ─────────────────────────────────────────────────
      while (particles.length < target) {
        particles.push(spawnParticle(w, h, particles.length % 4))
      }

      // ── Update + draw (iterate backwards for safe splice) ─────────────────
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // Physics — speed directly driven by current ventilation ref
        p.x += intens * 1.85 * p.bsf
        p.y += Math.sin(p.x * p.fr + p.ph) * p.amp * 0.055 + p.vy
        p.t += p.ls

        if (p.x >= w || p.t >= 1) {
          // Recycle in-range slots, remove excess
          if (i < target) { particles[i] = spawnParticle(w, h, p.sl) }
          else            { particles.splice(i, 1) }
          continue
        }

        const alpha = particleAlpha(p.t) * maxA
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${pR},${pG},${pB},${alpha.toFixed(3)})`
        ctx.fill()
      }

      // ── Vent inlet markers (left edge) ─────────────────────────────────────
      if (intens > 0.04) {
        const vA  = 0.10 + intens * 0.36
        const arl = 5 + intens * 10    // arrow length (px)

        VENT_Y.forEach(yp => {
          const y = h * yp

          // Inlet bar
          ctx.beginPath()
          ctx.moveTo(0, y - 4)
          ctx.lineTo(0, y + 4)
          ctx.strokeStyle = `rgba(${pR},${pG},${pB},${vA})`
          ctx.lineWidth   = 2.5
          ctx.stroke()

          // Arrow shaft
          ctx.beginPath()
          ctx.moveTo(2.5, y)
          ctx.lineTo(arl, y)
          ctx.strokeStyle = `rgba(${pR},${pG},${pB},${(vA * 0.7).toFixed(3)})`
          ctx.lineWidth   = 1.4
          ctx.stroke()

          // Arrowhead
          ctx.beginPath()
          ctx.moveTo(arl - 3.5, y - 2.5)
          ctx.lineTo(arl + 0.5, y)
          ctx.lineTo(arl - 3.5, y + 2.5)
          ctx.strokeStyle = `rgba(${pR},${pG},${pB},${(vA * 0.7).toFixed(3)})`
          ctx.lineWidth   = 1.3
          ctx.stroke()
        })
      }
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      RO.disconnect()
    }
  }, [])  // mount-once — all dynamic values come from refs

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
