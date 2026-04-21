'use client'

import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import ErrorState from '@/components/ErrorState'

type ContactMessage = {
  id: string
  name: string
  email: string
  phone: string | null
  concern: string
  created_at: string
}

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

export default function ContactsPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dismissTarget, setDismissTarget] = useState<ContactMessage | null>(null)
  const [dismissing, setDismissing] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    fetchMessages()
  }, [])

  async function fetchMessages() {
    setLoading(true)
    setLoadError('')
    try {
      const token = await getToken()
      const res = await fetch(`${API}/contact-messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setMessages(await res.json())
    } catch {
      setLoadError('Failed to load messages. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDismiss() {
    if (!dismissTarget) return
    setDismissing(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/contact-messages/${dismissTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204) {
        alert('Failed to dismiss message. Please try again.')
        return
      }
      setMessages(prev => prev.filter(m => m.id !== dismissTarget.id))
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
          <h2 className="text-xl font-bold text-gray-900">Contact Messages</h2>
          <p className="text-sm text-gray-500">{messages.length} unread {messages.length === 1 ? 'message' : 'messages'}</p>
        </div>
      </div>

      {loadError && <ErrorState variant="network" message={loadError} onRetry={fetchMessages} />}

      {loading ? (
        <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>Loading messages...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.5rem' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">

                  {/* Name + date */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {m.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(m.created_at)}</p>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                      <p className="text-sm text-gray-700">{m.email}</p>
                    </div>
                    {m.phone && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Phone</p>
                        <p className="text-sm text-gray-700">{m.phone}</p>
                      </div>
                    )}
                  </div>

                  {/* Concern */}
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl" style={{ padding: '0.5rem 0.75rem' }}>
                    "{m.concern}"
                  </p>
                </div>

                <button
                  onClick={() => setDismissTarget(m)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                  style={{ padding: '0.3rem 0.75rem' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}

          {messages.length === 0 && !loadError && (
            <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
              No contact messages.
            </div>
          )}
        </div>
      )}

      {/* Dismiss confirm */}
      {dismissTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Dismiss Message</h3>
            <p className="text-sm text-gray-500 mb-6">
              Mark <span className="font-semibold text-gray-900">{dismissTarget.name}</span>'s message as handled and remove it?
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
