'use client'

import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { FeedSkeleton } from '@/components/Skeleton'
import ErrorState from '@/components/ErrorState'

type RequestStatus = 'pending' | 'approved' | 'denied'

type TrainerRemovalRequest = {
  id: string
  trainer_id: string
  trainer_name: string
  requested_by: string
  reason: string | null
  status: RequestStatus
  created_at: string
}

type DayChangeRequest = {
  id: string
  member_id: string
  memberName: string
  currentDays: string[]
  requestedDays: string[]
  note: string | null
  status: RequestStatus
  created_at: string
}

type Member = {
  id: string
  first_name: string
  last_name: string
  display_id: number
  training_days: string[] | null
}

const API = process.env.NEXT_PUBLIC_API_URL

function DayBadges({ days }: { days: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {days.map((d) => (
        <span
          key={d}
          className="text-xs bg-gray-900 text-white rounded-full flex items-center justify-center"
          style={{ width: d === 'Th' ? '1.75rem' : '1.5rem', height: '1.5rem', fontSize: '0.65rem' }}
        >
          {d}
        </span>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const styles: Record<RequestStatus, string> = {
    pending:  'bg-yellow-50 text-yellow-700',
    approved: 'bg-green-50 text-green-700',
    denied:   'bg-red-50 text-red-600',
  }
  return (
    <span className={`text-xs font-medium rounded-lg capitalize ${styles[status]}`} style={{ padding: '0.2rem 0.6rem' }}>
      {status}
    </span>
  )
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<DayChangeRequest[]>([])
  const [filter, setFilter] = useState<'all' | RequestStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [removalRequests, setRemovalRequests] = useState<TrainerRemovalRequest[]>([])
  const [removalActing, setRemovalActing] = useState<string | null>(null)
  const [isPrivileged, setIsPrivileged] = useState(false)

  // Get auth token once
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tok = await user.getIdToken()
        setToken(tok)
        // Check if privileged (head coach / superuser)
        const meRes = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } })
        if (meRes.ok) {
          const me = await meRes.json()
          setIsPrivileged(me.is_privileged ?? false)
        }
      }
    })
    return unsub
  }, [])

  const fetchRequests = useCallback(async (tok: string, statusFilter: string) => {
    setLoading(true)
    setError('')
    try {
      const params = statusFilter === 'all' ? 'status_filter=all' : `status_filter=${statusFilter}`
      const [reqRes, membersRes, removalRes] = await Promise.all([
        fetch(`${API}/day-change-requests?${params}`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API}/members`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API}/trainers/removal-requests`, { headers: { Authorization: `Bearer ${tok}` } }),
      ])
      if (!reqRes.ok || !membersRes.ok) throw new Error('Failed to load data')

      const rawRequests = await reqRes.json()
      const members: Member[] = await membersRes.json()

      const memberMap = new Map(members.map((m) => [m.id, m]))

      const merged: DayChangeRequest[] = rawRequests.map((r: any) => {
        const member = memberMap.get(r.member_id)
        return {
          id: r.id,
          member_id: r.member_id,
          memberName: member
            ? `${member.first_name} ${member.last_name} (#${member.display_id})`
            : 'Unknown Member',
          currentDays: member?.training_days ?? [],
          requestedDays: r.requested_days,
          note: r.note,
          status: r.status,
          created_at: r.created_at.split('T')[0],
        }
      })
      setRequests(merged)

      if (removalRes.ok) {
        const rawRemovals = await removalRes.json()
        setRemovalRequests(rawRemovals.map((r: any) => ({
          ...r,
          created_at: r.created_at.split('T')[0],
        })))
      }
    } catch {
      setError('Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchRequests(token, filter)
  }, [token, filter, fetchRequests])

  const handleAction = async (id: string, action: 'approve' | 'deny') => {
    if (!token) return
    setActing(id)
    try {
      const res = await fetch(`${API}/day-change-requests/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      // Refresh list
      await fetchRequests(token, filter)
    } catch {
      setError(`Failed to ${action} request.`)
    } finally {
      setActing(null)
    }
  }

  const handleRemovalAction = async (id: string, action: 'approve' | 'deny') => {
    if (!token) return
    setRemovalActing(id)
    try {
      const res = await fetch(`${API}/trainers/removal-requests/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      await fetchRequests(token, filter)
    } catch {
      setError(`Failed to ${action} removal request.`)
    } finally {
      setRemovalActing(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const pendingRemovalCount = removalRequests.filter((r) => r.status === 'pending').length
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Requests</h2>
          <p className="text-sm text-gray-500">
            {pendingCount + pendingRemovalCount} pending · {requests.length + removalRequests.length} total
          </p>
        </div>
      </div>

      {error && <ErrorState variant="network" message={error} onRetry={() => token && fetchRequests(token, filter)} />}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5">
        {(['all', 'pending', 'approved', 'denied'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium rounded-xl capitalize transition ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
            style={{ padding: '0.4rem 0.875rem' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Section label */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Day Change Requests</h3>

      {loading ? (
        <FeedSkeleton items={4} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.25rem 1.5rem' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 flex flex-col gap-3">
                  {/* Member + status */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{req.memberName}</span>
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-gray-400 ml-auto">{req.created_at}</span>
                  </div>

                  {/* Days comparison */}
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Current Days</p>
                      {req.currentDays.length > 0 ? (
                        <DayBadges days={req.currentDays} />
                      ) : (
                        <span className="text-xs text-gray-400">None set</span>
                      )}
                    </div>
                    <span className="text-gray-300 text-lg mt-3">→</span>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Requested Days</p>
                      <DayBadges days={req.requestedDays} />
                    </div>
                  </div>

                  {/* Note */}
                  {req.note && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl" style={{ padding: '0.5rem 0.75rem' }}>
                      "{req.note}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                {req.status === 'pending' && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      disabled={acting === req.id}
                      className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                      style={{ padding: '0.45rem 1rem' }}
                    >
                      {acting === req.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'deny')}
                      disabled={acting === req.id}
                      className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50"
                      style={{ padding: '0.45rem 1rem' }}
                    >
                      {acting === req.id ? '...' : 'Deny'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
              No {filter === 'all' ? '' : filter} requests.
            </div>
          )}
        </div>
      )}

      {/* Trainer Removal Requests — visible to all coaches, actions only for privileged */}
      {removalRequests.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Trainer Removal Requests
          </h3>
          <div className="flex flex-col gap-3">
            {removalRequests
              .filter((r) => filter === 'all' || r.status === filter)
              .map((req) => (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.25rem 1.5rem' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">{req.trainer_name}</span>
                        <StatusBadge status={req.status} />
                        <span className="text-xs text-gray-400 ml-auto">{req.created_at}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Requested by <span className="font-medium">{req.requested_by}</span>
                      </p>
                      {req.reason && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl" style={{ padding: '0.5rem 0.75rem' }}>
                          "{req.reason}"
                        </p>
                      )}
                      {!isPrivileged && req.status === 'pending' && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl" style={{ padding: '0.4rem 0.75rem' }}>
                          Awaiting head coach approval
                        </p>
                      )}
                    </div>

                    {isPrivileged && req.status === 'pending' && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleRemovalAction(req.id, 'approve')}
                          disabled={removalActing === req.id}
                          className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                          style={{ padding: '0.45rem 1rem' }}
                        >
                          {removalActing === req.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRemovalAction(req.id, 'deny')}
                          disabled={removalActing === req.id}
                          className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50"
                          style={{ padding: '0.45rem 1rem' }}
                        >
                          {removalActing === req.id ? '...' : 'Deny'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
