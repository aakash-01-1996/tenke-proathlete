'use client'

import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import ErrorState from '@/components/ErrorState'

type Booking = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  age: number | null
  experience: string | null
  goal: string | null
  goal_other: string | null
  preferred_days: string[] | null
  message: string | null
  created_at: string
}

const experienceLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  pro: 'Professional',
}

const goalLabel: Record<string, string> = {
  speed: 'Improve Speed',
  strength: 'Build Strength',
  agility: 'Agility & Conditioning',
  vertical: 'Increase Vertical',
  overall: 'Overall Athletic Performance',
  other: 'Other',
}

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dismissTarget, setDismissTarget] = useState<Booking | null>(null)
  const [dismissing, setDismissing] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    fetchBookings()
  }, [])

  async function fetchBookings() {
    setLoading(true)
    setLoadError('')
    try {
      const token = await getToken()
      const res = await fetch(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setBookings(await res.json())
    } catch {
      setLoadError('Failed to load bookings. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDismiss() {
    if (!dismissTarget) return
    setDismissing(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/bookings/${dismissTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204) {
        alert('Failed to dismiss booking. Please try again.')
        return
      }
      setBookings(prev => prev.filter(b => b.id !== dismissTarget.id))
      setDismissTarget(null)
    } catch {
      alert('Unable to reach the server. Please check your connection.')
    } finally {
      setDismissing(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Session Bookings</h2>
          <p className="text-sm text-gray-500">{bookings.length} pending {bookings.length === 1 ? 'request' : 'requests'}</p>
        </div>
      </div>

      {loadError && <ErrorState variant="network" message={loadError} onRetry={fetchBookings} />}

      {loading ? (
        <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>Loading bookings...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.5rem' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">

                  {/* Name + date */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {b.first_name[0]}{b.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.first_name} {b.last_name}</p>
                      <p className="text-xs text-gray-400">{formatDate(b.created_at)}</p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                      <p className="text-sm text-gray-700">{b.email}</p>
                    </div>
                    {b.phone && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Phone</p>
                        <p className="text-sm text-gray-700">{b.phone}</p>
                      </div>
                    )}
                    {b.age && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Age</p>
                        <p className="text-sm text-gray-700">{b.age}</p>
                      </div>
                    )}
                    {b.experience && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Experience</p>
                        <p className="text-sm text-gray-700">{experienceLabel[b.experience] ?? b.experience}</p>
                      </div>
                    )}
                    {b.goal && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Goal</p>
                        <p className="text-sm text-gray-700">{goalLabel[b.goal] ?? b.goal}</p>
                        {b.goal === 'other' && b.goal_other && (
                          <p className="text-xs text-gray-500 mt-0.5">"{b.goal_other}"</p>
                        )}
                      </div>
                    )}
                    {b.preferred_days && b.preferred_days.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Preferred Days</p>
                        <div className="flex items-center gap-1">
                          {b.preferred_days.map(d => (
                            <span key={d} className="text-xs bg-gray-900 text-white rounded-full flex items-center justify-center"
                              style={{ width: '1.6rem', height: '1.6rem', fontSize: '0.65rem' }}>
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {b.message && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl" style={{ padding: '0.5rem 0.75rem' }}>
                      "{b.message}"
                    </p>
                  )}
                </div>

                {/* Action */}
                <button
                  onClick={() => setDismissTarget(b)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                  style={{ padding: '0.3rem 0.75rem' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}

          {bookings.length === 0 && !loadError && (
            <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
              No pending booking requests.
            </div>
          )}
        </div>
      )}

      {/* Dismiss confirm */}
      {dismissTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Dismiss Request</h3>
            <p className="text-sm text-gray-500 mb-6">
              Mark <span className="font-semibold text-gray-900">{dismissTarget.first_name} {dismissTarget.last_name}</span>'s booking as handled and remove it from the list?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDismissTarget(null)}
                disabled={dismissing}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDismiss}
                disabled={dismissing}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                {dismissing ? 'Dismissing...' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
