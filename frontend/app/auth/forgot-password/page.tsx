'use client'

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [displayId, setDisplayId] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, display_id: parseInt(displayId, 10) }),
      })

      const data = res.ok ? await res.json() : null

      if (data?.valid) {
        // Identity verified — let Firebase send the reset email
        try {
          await sendPasswordResetEmail(auth, email)
        } catch {
          // Ignore — always show success to prevent enumeration
        }
      }

      // Always show success — never reveal whether email/ID matched
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center" style={{ padding: '2rem' }}>
      <div className="bg-white rounded-2xl shadow-sm w-full max-w-md" style={{ padding: '2.5rem' }}>
        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.43 2 2 0 0 1 3.58 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500 mb-6">
              If the details matched, a password reset link has been sent to{' '}
              <span className="font-medium text-gray-800">{email}</span>.
              Check your inbox and spam folder.
            </p>
            <Link href="/auth/signin" className="text-sm font-medium text-gray-900 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot password?</h1>
              <p className="text-sm text-gray-500">
                Enter your email and your Member/Coach ID. We'll send a reset link — your data won't be affected.
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.75rem 1rem' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your ID</label>
                <input
                  type="number"
                  value={displayId}
                  onChange={e => setDisplayId(e.target.value)}
                  required
                  placeholder="e.g. 101 for members, 11 for coaches"
                  min="1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.75rem 1rem' }}
                />
                <p className="text-xs text-gray-400 mt-1">This is the ID assigned to you when your account was created. Ask your coach if you don't know it.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
                style={{ padding: '0.85rem', marginTop: '0.5rem' }}
              >
                {loading ? 'Verifying...' : 'Send reset link'}
              </button>
            </form>

            <div className="text-center mt-5">
              <Link href="/auth/signin" className="text-sm text-gray-500 hover:text-gray-800 transition">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
