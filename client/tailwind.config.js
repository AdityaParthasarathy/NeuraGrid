/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Premium Light Theme Palette ──────────────────────────────────
        'brand-blue':   '#0F172A',   // Slate-900 for high-contrast branding
        'accent-blue':  '#0284C7',   // Sky-600 (Primary accent)
        'accent-green': '#059669',   // Emerald-600 (Savings & Energy)
        'accent-purple':'#7C3AED',   // Violet-600 (Intelligence & AI)
        'accent-orange':'#EA580C',   // Orange-600 (Warnings)
        'accent-pink':  '#DB2777',   // Pink-600 (Critical alerts)

        // ── Base Surface Palette (Clean Light Theme) ─────────────────────
        'base-bg':      '#F8FAFC',   // Slate-50 (Cool light bg)
        'base-card':    '#FFFFFF',   // Pure White surface
        'base-elevated':'#F1F5F9',   // Slate-100 (Secondary surface)
        'base-border':  '#E2E8F0',   // Slate-200 (Subtle borders)
        'base-muted':   '#94A3B8',   // Slate-400 (Muted text/borders)
        'text-main':    '#1E293B',   // Slate-800 (Primary readability)
        'text-dim':     '#64748B',   // Slate-500 (Secondary info)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'accent-blue':   '0 2px 12px rgba(2,132,199,0.14)',
        'accent-green':  '0 2px 12px rgba(5,150,105,0.14)',
        'premium':       '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow-cyan':    'glowCyan 2s ease-in-out infinite alternate',
        'glow-green':   'glowGreen 2s ease-in-out infinite alternate',
        'float':        'float 6s ease-in-out infinite',
        'scan':         'scan 4s linear infinite',
        'spin-slow':    'spin 8s linear infinite',
        'fade-in':      'fadeIn 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up':     'slideUp 0.22s cubic-bezier(0.16,1,0.3,1) both',
      },
      keyframes: {
        glowCyan: {
          '0%':   { boxShadow: '0 0 4px rgba(2,132,199,0.15)' },
          '100%': { boxShadow: '0 0 12px rgba(2,132,199,0.35)' },
        },
        glowGreen: {
          '0%':   { boxShadow: '0 0 4px rgba(5,150,105,0.15)' },
          '100%': { boxShadow: '0 0 12px rgba(5,150,105,0.35)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
