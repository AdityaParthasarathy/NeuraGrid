/**
 * Shared alert severity config — kept in its own file so Vite Fast Refresh
 * can reload AlertContext.jsx (a file that exports React components) without
 * choking on the non-component SEV export.
 */
export const SEV = {
  critical: { color: '#ff2d78', bg: 'rgba(255,45,120,0.12)',  border: 'rgba(255,45,120,0.30)',  label: 'CRITICAL' },
  warning:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.30)',  label: 'WARNING'  },
  info:     { color: '#00f5ff', bg: 'rgba(0,245,255,0.10)',   border: 'rgba(0,245,255,0.25)',   label: 'INFO'     },
}
