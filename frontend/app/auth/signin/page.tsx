'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

async function redirectAfterSignIn(
  token: string,
  router: ReturnType<typeof useRouter>,
  next: string | null,
) {
  if (next && next.startsWith('/')) {
    router.push(next)
    return
  }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const { role, must_change_password } = await res.json()
      if (must_change_password) {
        router.push('/auth/change-password')
        return
      }
      if (role === 'coach' || role === 'trainer') {
        router.push('/admin/members')
      } else {
        router.push('/metrics')
      }
    } else if (res.status === 401 || res.status === 403) {
      // Not authorized — stay on signin
    } else {
      // Backend error (5xx) — still signed in, go to admin and let it handle
      router.push('/admin/members')
    }
  } catch {
    // Backend unreachable — go to admin and let it handle
    router.push('/admin/members')
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  // Redirect already-signed-in users
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken()
        await redirectAfterSignIn(token, router, next)
      }
    })
    return unsubscribe
  }, [router, next])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const token = await result.user.getIdToken()
      await redirectAfterSignIn(token, router, next)
    } catch (err: any) {
      const code = err.code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Incorrect email or password.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Failed to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-full bg-gray-100 flex items-center justify-center" style={{ padding: '2rem' }}>
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Left — dark panel */}
          <div className="bg-gray-800 flex flex-col justify-center rounded-l-3xl" style={{ padding: '4rem 3.5rem' }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Welcome back</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Sign in to<br />your account.
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed mb-8">
              Access your athlete dashboard, track your metrics, and connect with your coach.
            </p>

            <div className="flex flex-col gap-4">
              {[
                { icon: '📊', title: 'Your Metrics', body: 'See all your performance data in one place.' },
                { icon: '📅', title: 'Training Schedule', body: 'View and manage your training days.' },
                { icon: '💬', title: 'Community', body: 'Connect with athletes on the same journey.' },
              ].map(({ icon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-base">{icon}</div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="flex flex-col justify-center" style={{ padding: '4rem 3.5rem' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign In</h2>
            <p className="text-xs text-gray-400 mb-8">Enter your credentials to continue.</p>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1.5">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.65rem 1rem' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1.5">Password</label>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.65rem 1rem' }}
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition"
                style={{ padding: '0.75rem', marginTop: '0.5rem' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="text-center mt-4">
              <a href="/auth/forgot-password" className="text-sm text-gray-500 hover:text-gray-800 transition">
                Forgot password?
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center mt-8">
              Don't have an account? Your coach will set you up.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
