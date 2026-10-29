/**
 * PageLoader — shown via React.Suspense while a lazy page chunk loads.
 * Skeleton matches the common page layout (header + KPI cards + charts).
 */
import React from 'react'

function Bone({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

export default function PageLoader() {
  return (
    <div className="space-y-6 animate-fade-in" aria-label="Loading page…">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-52" />
          <Bone className="h-3.5 w-80" />
        </div>
        <Bone className="h-9 w-28 rounded-xl" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl border border-dark-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bone className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Bone className="h-3 w-16" />
                <Bone className="h-5 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Primary chart */}
      <div className="glass rounded-2xl border border-dark-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Bone className="h-4 w-44" />
            <Bone className="h-3 w-64" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-7 w-20 rounded-lg" />
            <Bone className="h-7 w-20 rounded-lg" />
          </div>
        </div>
        <Bone className="h-60 w-full rounded-xl" />
      </div>

      {/* Two-column charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass rounded-2xl border border-dark-border p-5 space-y-4">
            <Bone className="h-4 w-36" />
            <Bone className="h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="glass rounded-2xl border border-dark-border p-5 space-y-4">
        <Bone className="h-4 w-40" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Bone className="h-7 w-7 rounded-full flex-shrink-0" />
              <Bone className="h-4 flex-1" />
              <Bone className="h-4 w-20" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
