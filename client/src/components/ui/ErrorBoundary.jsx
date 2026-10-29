/**
 * ErrorBoundary — catches React render errors inside page components.
 * Displays a polished error card that matches the NeuraGrid dark theme.
 */
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // In production this would go to an error reporting service
    console.error('[NeuraGrid] Render error:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null, info: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[480px] px-6 animate-fade-in">
          <div className="glass rounded-2xl border border-accent-pink/30 p-8 max-w-md w-full text-center space-y-5 shadow-lg"
            style={{ boxShadow: '0 0 40px rgba(219,39,119,0.12)' }}>

            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-accent-pink/10 border border-accent-pink/30 flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DB2777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            {/* Message */}
            <div>
              <h2 className="text-text-main font-bold text-lg">Something went wrong</h2>
              <p className="text-text-dim text-sm mt-1.5 leading-relaxed">
                This component encountered an unexpected error. Your live data and other pages are unaffected.
              </p>
            </div>

            {/* Error detail */}
            <div className="text-left bg-base-elevated rounded-xl border border-base-border p-3 shadow-sm">
              <p className="text-accent-pink text-xs font-mono leading-relaxed break-all">
                {this.state.error?.message ?? 'Unknown error'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-neon text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-base-border text-text-dim hover:text-text-main hover:border-accent-blue/30 shadow-sm transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
