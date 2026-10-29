/**
 * NeuraGrid — Currency Context
 *
 * Provides a global INR / USD toggle.
 * Default: INR (₹).  All stored values in the app are in INR;
 * switching to USD divides by USD_TO_INR at display time.
 */
import React, { createContext, useContext, useState, useCallback } from 'react'
import { USD_TO_INR } from '../utils/currencyINR'

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('INR') // 'INR' | 'USD'

  const toggle = useCallback(
    () => setCurrency(c => (c === 'INR' ? 'USD' : 'INR')),
    []
  )

  /**
   * format(inrValue)
   * Takes a value **already in INR** and formats it for the active currency.
   * Optionally pass decimals for fractional display.
   */
  const format = useCallback(
    (inrValue, decimals = 0) => {
      if (currency === 'USD') {
        const usd = inrValue / USD_TO_INR
        return (
          '$' +
          new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(
            decimals ? +usd.toFixed(decimals) : Math.round(usd)
          )
        )
      }
      return (
        '₹' +
        new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals }).format(
          decimals ? +inrValue.toFixed(decimals) : Math.round(inrValue)
        )
      )
    },
    [currency]
  )

  /**
   * formatRate(inrPerKwh)
   * Formats a per-kWh rate in the active currency.
   */
  const formatRate = useCallback(
    inrPerKwh => {
      if (currency === 'USD') {
        return `$${(inrPerKwh / USD_TO_INR).toFixed(3)}/kWh`
      }
      return `₹${inrPerKwh.toFixed(2)}/kWh`
    },
    [currency]
  )

  /**
   * formatShort(inrValue)
   * Compact form for chart axes — ₹50K / ₹1.2L / ₹1.5Cr  |  $600 / $1.2K / $18K
   */
  const formatShort = useCallback(
    inrValue => {
      if (currency === 'USD') {
        const usd = Math.round(inrValue / USD_TO_INR)
        if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
        if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(0)}K`
        return `$${usd}`
      }
      const v = Math.round(inrValue)
      if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`
      if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(1)}L`
      if (v >= 1_000)       return `₹${(v / 1_000).toFixed(0)}K`
      return `₹${v}`
    },
    [currency]
  )

  const symbol = currency === 'INR' ? '₹' : '$'

  return (
    <CurrencyContext.Provider value={{ currency, toggle, format, formatRate, formatShort, symbol }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider')
  return ctx
}
