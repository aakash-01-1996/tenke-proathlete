'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error(error)
  }, [error])

  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '3rem 2rem', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 1px 12px rgba(0,0,0,0.08)' }}>
          <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '120px', margin: '0 auto 1.5rem' }}>
            <rect x="15" y="10" width="90" height="78" rx="8" fill="#F3F4F6" />
            <rect x="15" y="10" width="90" height="28" rx="8" fill="#E5E7EB" />
            <rect x="15" y="28" width="90" height="10" fill="#E5E7EB" />
            <polyline points="60,38 52,58 64,66 55,88" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="22" y="48" width="24" height="5" rx="2" fill="#D1D5DB" />
            <rect x="22" y="58" width="18" height="5" rx="2" fill="#D1D5DB" />
            <rect x="22" y="68" width="20" height="5" rx="2" fill="#D1D5DB" />
            <rect x="70" y="72" width="22" height="5" rx="2" fill="#D1D5DB" />
            <rect x="70" y="82" width="16" height="5" rx="2" fill="#D1D5DB" />
          </svg>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem' }}>Something went wrong</h2>
          <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            An unexpected error occurred. Your data is safe — try refreshing the page.
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.6rem 1.5rem', background: '#111827', color: 'white', border: 'none', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
