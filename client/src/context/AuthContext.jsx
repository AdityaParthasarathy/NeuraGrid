/**
 * NeuraGrid — Auth Context
 * Lightweight client-side auth backed by localStorage.
 * Supports register + login — no backend required.
 */
import React, { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const STORE_KEY   = 'neuragrid_users'
const SESSION_KEY = 'neuragrid_session'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') } catch { return [] }
}

function saveUsers(users) {
  localStorage.setItem(STORE_KEY, JSON.stringify(users))
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') } catch { return null }
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession())

  // ── Register ─────────────────────────────────────────────────────────────────
  const register = useCallback(({ name, email, password }) => {
    const users = loadUsers()

    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'An account with this email already exists.' }
    }

    const newUser = {
      id:        Date.now().toString(),
      name:      name.trim(),
      email:     email.toLowerCase().trim(),
      password,  // plain-text is fine for a demo/mock app
      createdAt: new Date().toISOString(),
      role:      'operator',
    }

    saveUsers([...users, newUser])

    // Auto-login after register
    const { password: _p, ...session } = newUser
    saveSession(session)
    setUser(session)
    return { ok: true }
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────────
  const login = useCallback(({ email, password }) => {
    const users = loadUsers()
    const match = users.find(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    )

    if (!match) {
      return { ok: false, error: 'Invalid email or password.' }
    }

    const { password: _p, ...session } = match
    saveSession(session)
    setUser(session)
    return { ok: true }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
