import React, { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import ToastContainer from '../alerts/ToastContainer'
import PageLoader from '../ui/PageLoader'
import ErrorBoundary from '../ui/ErrorBoundary'

export default function Layout() {
  // Changing the key on every route change re-mounts the div,
  // triggering animate-fade-in on each navigation.
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen bg-base-bg">

      {/* Ambient background — subtle tinted orbs for light theme depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-accent-blue/[0.04] blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full bg-accent-purple/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-72 h-72 rounded-full bg-accent-green/[0.03] blur-3xl" />
      </div>

      {/* Sidebar — persistent; unaffected by Suspense */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen min-w-0 relative z-10">
        {/* Navbar — persistent */}
        <Navbar />

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {/*
            ErrorBoundary  → catches render errors in any page component
            Suspense        → shows skeleton while lazy-loaded chunks fetch
            key={pathname}  → triggers fade-in animation on every route change
          */}
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <div key={pathname} className="animate-fade-in">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Global toast stack — outside the page flow */}
      <ToastContainer />
    </div>
  )
}
