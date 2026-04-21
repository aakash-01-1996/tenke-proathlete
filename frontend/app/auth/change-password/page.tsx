'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/auth/signin')
      } else {
        setChecking(false)
      }
    })
    return unsubscribe
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const user = auth.currentUser!
      // Reauthenticate first (required by Firebase for sensitive operations)
      const credential = EmailAuthProvider.credential(user.email!, currentPassword)
      await reauthenticateWithCredential(user, credential)
      // Update password
      await updatePassword(user, newPassword)
      // Tell our backend the flag is cleared
      const token = await user.getIdToken(true) // force refresh
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/mark-password-changed`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      // Redirect based on role
      const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (meRes.ok) {
        const { role } = await meRes.json()
        router.push(role === 'coach' || role === 'trainer' ? '/admin/members' : '/metrics')
      } else {
        router.push('/admin/members')
      }
    } catch (err: any) {
      const code = err.code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.')
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 8 characters.')
      } else {
        setError('Failed to change password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center" style={{ padding: '2rem' }}>
      <div className="bg-white rounded-2xl shadow-sm w-full max-w-md" style={{ padding: '2.5rem' }}>
        <div className="mb-8">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Set Your Password</h1>
          <p className="text-sm text-gray-500">You must set a personal password before continuing. Enter your temporary password to confirm your identity.</p>
        </div>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current (temporary) password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              placeholder="Your temporary password"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
              style={{ padding: '0.75rem 1rem' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
              style={{ padding: '0.75rem 1rem' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
              style={{ padding: '0.75rem 1rem' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
            style={{ padding: '0.85rem', marginTop: '0.5rem' }}
          >
            {loading ? 'Updating...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
