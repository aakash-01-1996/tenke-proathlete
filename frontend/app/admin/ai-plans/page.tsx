'use client'

import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { FeedSkeleton } from '@/components/Skeleton'
import ErrorState from '@/components/ErrorState'

type Status = 'pending' | 'approved' | 'denied' | 'failed'

type WorkoutExercise = {
  id: string
  plan_day_id: string
  name: string
  sets: number | null
  reps: number | null
  duration: string | null
  is_rest: boolean
  rest_seconds: number | null
  ai_rationale: string | null
}

type WorkoutDay = {
  id: string
  request_id: string
  day_number: number
  label: string
  exercises: WorkoutExercise[]
}

type WorkoutRequest = {
  id: string
  member_id: string
  trigger_source: string
  status: Status
  error_message: string | null
  coach_notes: string | null
  created_at: string
  days: WorkoutDay[]
}

type NutritionMeal = {
  id: string
  request_id: string
  meal_order: number
  label: string
  food_items: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string | null
}

type NutritionRequest = {
  id: string
  member_id: string
  trigger_source: string
  status: Status
  error_message: string | null
  coach_notes: string | null
  daily_calories: number | null
  daily_protein_g: number | null
  daily_carbs_g: number | null
  daily_fat_g: number | null
  summary_notes: string | null
  created_at: string
  meals: NutritionMeal[]
}

type Member = { id: string; first_name: string; last_name: string; display_id: number }

const API = process.env.NEXT_PUBLIC_API_URL

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    approved: 'bg-green-50 text-green-700',
    denied: 'bg-red-50 text-red-600',
    failed: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs font-medium rounded-lg capitalize ${styles[status]}`} style={{ padding: '0.2rem 0.6rem' }}>
      {status}
    </span>
  )
}

export default function AIPlansPage() {
  const [token, setToken] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Status>('pending')
  const [members, setMembers] = useState<Member[]>([])
  const [workoutRequests, setWorkoutRequests] = useState<WorkoutRequest[]>([])
  const [nutritionRequests, setNutritionRequests] = useState<NutritionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [denyTarget, setDenyTarget] = useState<{ kind: 'workout' | 'nutrition'; id: string } | null>(null)
  const [denyNotes, setDenyNotes] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) setToken(await user.getIdToken())
    })
    return unsub
  }, [])

  const memberName = useCallback(
    (id: string) => {
      const m = members.find((mm) => mm.id === id)
      return m ? `${m.first_name} ${m.last_name} (#${m.display_id})` : 'Unknown Member'
    },
    [members]
  )

  const fetchAll = useCallback(async (tok: string, statusFilter: string) => {
    setLoading(true)
    setError('')
    try {
      const params = statusFilter === 'all' ? '' : `?status_filter=${statusFilter}`
      const [membersRes, wRes, nRes] = await Promise.all([
        fetch(`${API}/members/`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API}/ai-plans/workout-requests${params}`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`${API}/ai-plans/nutrition-requests${params}`, { headers: { Authorization: `Bearer ${tok}` } }),
      ])
      if (!membersRes.ok) throw new Error()
      setMembers(await membersRes.json())
      setWorkoutRequests(wRes.ok ? await wRes.json() : [])
      setNutritionRequests(nRes.ok ? await nRes.json() : [])
    } catch {
      setError('Failed to load AI plan requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchAll(token, filter)
  }, [token, filter, fetchAll])

  async function handleApprove(kind: 'workout' | 'nutrition', id: string) {
    if (!token) return
    setActing(id)
    try {
      const res = await fetch(`${API}/ai-plans/${kind}-requests/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      await fetchAll(token, filter)
    } catch {
      setError(`Failed to approve ${kind} plan.`)
    } finally {
      setActing(null)
    }
  }

  async function handleDeny() {
    if (!token || !denyTarget) return
    setActing(denyTarget.id)
    try {
      const res = await fetch(`${API}/ai-plans/${denyTarget.kind}-requests/${denyTarget.id}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ coach_notes: denyNotes || null }),
      })
      if (!res.ok) throw new Error()
      setDenyTarget(null)
      setDenyNotes('')
      await fetchAll(token, filter)
    } catch {
      setError(`Failed to deny ${denyTarget.kind} plan.`)
    } finally {
      setActing(null)
    }
  }

  const pendingCount = workoutRequests.filter((r) => r.status === 'pending').length + nutritionRequests.filter((r) => r.status === 'pending').length
  const totalCount = workoutRequests.length + nutritionRequests.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">AI Plans</h2>
          <p className="text-sm text-gray-500">{pendingCount} pending · {totalCount} total</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl mb-5" style={{ padding: '0.6rem 0.875rem' }}>
        AI-suggested — review and approve before anything takes effect for the athlete.
      </p>

      {error && <ErrorState variant="network" message={error} onRetry={() => token && fetchAll(token, filter)} />}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5">
        {(['all', 'pending', 'approved', 'denied', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium rounded-xl capitalize transition ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
            style={{ padding: '0.4rem 0.875rem' }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <FeedSkeleton items={4} />
      ) : (
        <>
          {/* Workout requests */}
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">AI Workout Plan Requests</h3>
          <div className="flex flex-col gap-3 mb-8">
            {workoutRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.25rem 1.5rem' }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{memberName(req.member_id)}</span>
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-gray-400">{req.created_at.split('T')[0]}</span>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove('workout', req.id)}
                        disabled={acting === req.id}
                        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                        style={{ padding: '0.45rem 1rem' }}
                      >
                        {acting === req.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setDenyTarget({ kind: 'workout', id: req.id }); setDenyNotes('') }}
                        disabled={acting === req.id}
                        className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50"
                        style={{ padding: '0.45rem 1rem' }}
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>

                {req.error_message && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-xl mb-2" style={{ padding: '0.5rem 0.75rem' }}>
                    {req.error_message}
                  </p>
                )}
                {req.coach_notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl mb-2" style={{ padding: '0.5rem 0.75rem' }}>
                    Coach notes: "{req.coach_notes}"
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {req.days.map((day) => (
                    <div key={day.id} className="bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Day {day.day_number} · {day.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {day.exercises.map((ex) => (
                          <div key={ex.id} className="bg-white border border-gray-200 rounded-lg text-xs" style={{ padding: '0.4rem 0.6rem' }}>
                            <span className="font-medium text-gray-800">{ex.name}</span>
                            <span className="text-gray-400 ml-1">
                              {ex.sets != null ? `${ex.sets} × ` : ''}
                              {ex.reps != null ? `${ex.reps} reps` : ex.duration ?? ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {workoutRequests.length === 0 && (
              <div className="text-center text-gray-400 text-sm" style={{ padding: '2rem' }}>No {filter === 'all' ? '' : filter} workout plan requests.</div>
            )}
          </div>

          {/* Nutrition requests */}
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">AI Nutrition Plan Requests</h3>
          <div className="flex flex-col gap-3">
            {nutritionRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.25rem 1.5rem' }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{memberName(req.member_id)}</span>
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-gray-400">{req.created_at.split('T')[0]}</span>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove('nutrition', req.id)}
                        disabled={acting === req.id}
                        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                        style={{ padding: '0.45rem 1rem' }}
                      >
                        {acting === req.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setDenyTarget({ kind: 'nutrition', id: req.id }); setDenyNotes('') }}
                        disabled={acting === req.id}
                        className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50"
                        style={{ padding: '0.45rem 1rem' }}
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>

                {req.error_message && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-xl mb-2" style={{ padding: '0.5rem 0.75rem' }}>
                    {req.error_message}
                  </p>
                )}
                {req.coach_notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl mb-2" style={{ padding: '0.5rem 0.75rem' }}>
                    Coach notes: "{req.coach_notes}"
                  </p>
                )}

                {(req.daily_calories || req.daily_protein_g || req.daily_carbs_g || req.daily_fat_g) && (
                  <div className="flex gap-4 mb-3 text-xs text-gray-500">
                    {req.daily_calories != null && <span>{req.daily_calories} kcal</span>}
                    {req.daily_protein_g != null && <span>{req.daily_protein_g}g protein</span>}
                    {req.daily_carbs_g != null && <span>{req.daily_carbs_g}g carbs</span>}
                    {req.daily_fat_g != null && <span>{req.daily_fat_g}g fat</span>}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {req.meals.map((meal) => (
                    <div key={meal.id} className="bg-gray-50 rounded-xl" style={{ padding: '0.6rem 0.875rem' }}>
                      <p className="text-xs font-semibold text-gray-700 mb-1">{meal.label}</p>
                      {meal.food_items && <p className="text-xs text-gray-500">{meal.food_items}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {nutritionRequests.length === 0 && (
              <div className="text-center text-gray-400 text-sm" style={{ padding: '2rem' }}>No {filter === 'all' ? '' : filter} nutrition plan requests.</div>
            )}
          </div>
        </>
      )}

      {/* Deny modal */}
      {denyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-base font-bold text-gray-900 mb-3">Deny AI Plan</h3>
            <p className="text-xs text-gray-400 mb-3">Optional note shown back to the athlete.</p>
            <textarea
              value={denyNotes}
              onChange={(e) => setDenyNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none mb-5"
              style={{ padding: '0.6rem 0.875rem' }}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setDenyTarget(null)} className="text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition" style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={handleDeny} disabled={acting === denyTarget.id} className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50" style={{ padding: '0.6rem 1.25rem' }}>
                {acting === denyTarget.id ? '...' : 'Deny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
