'use client'

import { useEffect, useState } from 'react'

type ErrorVariant = 'generic' | 'network' | 'offline'

interface ErrorStateProps {
  variant?: ErrorVariant
  message?: string
  onRetry?: () => void
}

// Detects whether the user is currently offline
function useIsOffline() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return offline
}

// ── Illustrations ─────────────────────────────────────────────────────────────

function OfflineIllustration() {
  return (
    <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-56 h-auto">
      {/* Cloud body */}
      <ellipse cx="120" cy="90" rx="58" ry="38" fill="#E5E7EB" />
      <ellipse cx="90" cy="100" rx="38" ry="28" fill="#E5E7EB" />
      <ellipse cx="152" cy="100" rx="32" ry="24" fill="#E5E7EB" />
      <ellipse cx="120" cy="72" rx="30" ry="26" fill="#E5E7EB" />
      <ellipse cx="96" cy="76" rx="24" ry="20" fill="#E5E7EB" />
      <ellipse cx="146" cy="78" rx="22" ry="18" fill="#E5E7EB" />

      {/* Wifi arcs — struck through */}
      <path d="M84 108 Q120 78 156 108" stroke="#9CA3AF" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M96 120 Q120 104 144 120" stroke="#9CA3AF" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="120" cy="132" r="5" fill="#9CA3AF" />

      {/* Strike-through line */}
      <line x1="72" y1="148" x2="168" y2="72" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" />

      {/* Rain drops */}
      <ellipse cx="100" cy="148" rx="3" ry="6" fill="#D1D5DB" />
      <ellipse cx="120" cy="155" rx="3" ry="6" fill="#D1D5DB" />
      <ellipse cx="140" cy="148" rx="3" ry="6" fill="#D1D5DB" />
    </svg>
  )
}

function NetworkErrorIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-56 h-auto">
      {/* Server stack */}
      <rect x="60" y="40" width="120" height="34" rx="8" fill="#E5E7EB" />
      <rect x="60" y="83" width="120" height="34" rx="8" fill="#E5E7EB" />
      <rect x="60" y="126" width="120" height="34" rx="8" fill="#E5E7EB" />

      {/* Server lights */}
      <circle cx="82" cy="57" r="5" fill="#6EE7B7" />
      <circle cx="82" cy="100" r="5" fill="#FCA5A5" />
      <circle cx="82" cy="143" r="5" fill="#FCA5A5" />

      {/* Horizontal lines on servers */}
      <rect x="96" y="53" width="60" height="7" rx="3" fill="#D1D5DB" />
      <rect x="96" y="96" width="40" height="7" rx="3" fill="#D1D5DB" />
      <rect x="96" y="139" width="50" height="7" rx="3" fill="#D1D5DB" />

      {/* Warning badge */}
      <circle cx="182" cy="46" r="22" fill="#FEF3C7" />
      <text x="182" y="53" textAnchor="middle" fontSize="22" fill="#D97706">!</text>
    </svg>
  )
}

function GenericErrorIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-56 h-auto">
      {/* Broken page */}
      <rect x="60" y="20" width="120" height="155" rx="10" fill="#F3F4F6" />
      <rect x="60" y="20" width="120" height="40" rx="10" fill="#E5E7EB" />
      <rect x="60" y="47" width="120" height="13" fill="#E5E7EB" />

      {/* Crack line */}
      <polyline points="120,60 108,90 128,105 112,175" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Content lines — left of crack */}
      <rect x="75" y="75" width="28" height="7" rx="3" fill="#D1D5DB" />
      <rect x="75" y="92" width="22" height="7" rx="3" fill="#D1D5DB" />
      <rect x="75" y="109" width="26" height="7" rx="3" fill="#D1D5DB" />
      <rect x="75" y="126" width="18" height="7" rx="3" fill="#D1D5DB" />

      {/* Content lines — right of crack */}
      <rect x="135" y="115" width="30" height="7" rx="3" fill="#D1D5DB" />
      <rect x="135" y="132" width="24" height="7" rx="3" fill="#D1D5DB" />
      <rect x="135" y="149" width="28" height="7" rx="3" fill="#D1D5DB" />

      {/* Face in top area */}
      <circle cx="95" cy="34" r="10" fill="#9CA3AF" />
      <circle cx="92" cy="32" r="1.5" fill="white" />
      <circle cx="98" cy="32" r="1.5" fill="white" />
      <path d="M91 37 Q95 34 99 37" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ErrorState({ variant, message, onRetry }: ErrorStateProps) {
  const offline = useIsOffline()

  // Auto-detect variant from environment if not provided
  const resolved: ErrorVariant = variant ?? (offline ? 'offline' : 'network')

  const config = {
    offline: {
      illustration: <OfflineIllustration />,
      title: "You're offline",
      body: message ?? "It looks like you've lost your internet connection. Check your Wi-Fi or mobile data and try again.",
    },
    network: {
      illustration: <NetworkErrorIllustration />,
      title: 'Connection problem',
      body: message ?? "We couldn't reach the server. This is usually temporary — please check your connection and try again.",
    },
    generic: {
      illustration: <GenericErrorIllustration />,
      title: 'Something went wrong',
      body: message ?? "An unexpected error occurred. Don't worry — your data is safe. Try refreshing the page.",
    },
  }[resolved]

  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '4rem 2rem', minHeight: '320px' }}>
      <div style={{ marginBottom: '1.5rem' }}>{config.illustration}</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{config.title}</h3>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{config.body}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 px-5 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
        >
          Try again
        </button>
      )}
    </div>
  )
}
