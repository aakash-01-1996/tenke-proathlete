'use client'

import { useState, useEffect, useRef } from 'react'
import { getAuth, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { app } from '@/lib/firebase'
import { MetricsSkeleton } from '@/components/Skeleton'

// ── Types ────────────────────────────────────────────────────────────────────

type Me = { email: string; role: string; ref_id: string | null }

type Member = {
  id: string
  display_id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  age: number | null
  weight: string | null
  height: string | null
  trainer_id: string | null
  package: string | null
  sessions_total: number | null
  sessions_left: number | null
  training_days: string[] | null
  training_goal: string | null
}

type Exercise = {
  id: string
  member_id: string
  category: 'upper' | 'lower' | 'core'
  name: string
  sets: number | null
  reps: number | null
  duration: string | null
  created_at: string
}

type ExerciseForm = {
  name: string
  sets: string
  mode: 'reps' | 'duration'
  reps: string
  duration: string
}

type WeightLog = {
  id: string
  exercise_id: string
  weight: string
  logged_at: string
  created_at: string
}

type MetricEntry = {
  id: string
  member_id: string
  recorded_at: string
  fly_10yd: number | null
  game_speed: number | null
  vertical: number | null
  broad_jump: number | null
  overall_progress: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

function trend(curr: number | null, prev: number | null, lowerIsBetter = false): 'up' | 'down' | 'neutral' {
  if (curr == null || prev == null) return 'neutral'
  if (curr === prev) return 'neutral'
  const improved = lowerIsBetter ? curr < prev : curr > prev
  return improved ? 'up' : 'down'
}

function changeStr(curr: number | null, prev: number | null, unit: string, lowerIsBetter = false) {
  if (curr == null) return '—'
  if (prev == null) return 'First entry'
  const diff = curr - prev
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(diff % 1 === 0 ? 0 : 2)}${unit}`
}

function fmtVal(val: number | null, unit: string, decimals = 0) {
  if (val == null) return '—'
  return `${val.toFixed(decimals)}${unit}`
}

// ── SVG Progress Graph ───────────────────────────────────────────────────────

type GraphPoint = { label: string; score: number; entry: MetricEntry }

function ProgressGraph({ data }: { data: GraphPoint[] }) {
  const [active, setActive] = useState<GraphPoint | null>(null)

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-32 text-gray-300 text-sm">No progress data yet</div>
  )

  const width = 560
  const height = 220
  const padLeft = 44
  const padRight = 20
  const padTop = 20
  const padBottom = 36

  const scores = data.map(d => d.score)
  const minScore = Math.max(0, Math.min(...scores) - 10)
  const maxScore = Math.min(100, Math.max(...scores) + 10)
  const range = maxScore - minScore || 1

  const xStep = data.length > 1 ? (width - padLeft - padRight) / (data.length - 1) : 0
  const toX = (i: number) => data.length === 1 ? width / 2 : padLeft + i * xStep
  const toY = (score: number) => padTop + ((maxScore - score) / range) * (height - padTop - padBottom)

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.score)}`).join(' ')

  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const val = minScore + (range * i) / gridCount
    return { y: toY(val), label: Math.round(val) }
  })

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {gridLines.map(g => (
          <g key={g.label}>
            <line x1={padLeft} y1={g.y} x2={width - padRight} y2={g.y} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 3" />
            <text x={padLeft - 6} y={g.y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{g.label}</text>
          </g>
        ))}
        {data.length > 1 && (
          <path d={pathD} fill="none" stroke="#1f2937" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {data.map((d, i) => {
          const isActive = active?.entry.id === d.entry.id
          return (
            <g key={i} onClick={() => setActive(isActive ? null : d)} style={{ cursor: 'pointer' }}>
              {/* Invisible larger hit area */}
              <circle cx={toX(i)} cy={toY(d.score)} r={14} fill="transparent" />
              <circle cx={toX(i)} cy={toY(d.score)} r={isActive ? 7 : 5} fill="#1f2937" />
              <circle cx={toX(i)} cy={toY(d.score)} r={isActive ? 4 : 3} fill={isActive ? '#facc15' : 'white'} />
              <text x={toX(i)} y={toY(d.score) - 12} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={600}>{d.score}</text>
              <text x={toX(i)} y={height - padBottom + 16} textAnchor="middle" fontSize={11} fill="#6b7280">{d.label}</text>
            </g>
          )
        })}
      </svg>

      {/* Detail card — shown when a point is clicked */}
      {active && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-wrap gap-x-6 gap-y-2" style={{ padding: '0.875rem 1.25rem' }}>
          <div className="flex items-center gap-2 w-full justify-between">
            <p className="text-xs font-bold text-gray-700">{active.label}</p>
            <button onClick={() => setActive(null)} className="text-gray-300 hover:text-gray-500 text-sm">✕</button>
          </div>
          {active.entry.fly_10yd != null && <div><p className="text-xs text-gray-400 mb-0.5">10YD Fly</p><p className="text-sm font-semibold text-gray-800">{active.entry.fly_10yd}s</p></div>}
          {active.entry.game_speed != null && <div><p className="text-xs text-gray-400 mb-0.5">Game Speed</p><p className="text-sm font-semibold text-gray-800">{active.entry.game_speed} mph</p></div>}
          {active.entry.vertical != null && <div><p className="text-xs text-gray-400 mb-0.5">Vertical</p><p className="text-sm font-semibold text-gray-800">{active.entry.vertical}"</p></div>}
          {active.entry.broad_jump != null && <div><p className="text-xs text-gray-400 mb-0.5">Broad Jump</p><p className="text-sm font-semibold text-gray-800">{active.entry.broad_jump}"</p></div>}
          {active.entry.overall_progress != null && <div><p className="text-xs text-gray-400 mb-0.5">Overall</p><p className="text-sm font-bold text-gray-900">{active.entry.overall_progress}</p></div>}
        </div>
      )}
    </div>
  )
}

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  if (direction === 'up') return (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
    </svg>
  )
  if (direction === 'down') return (
    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
    </svg>
  )
}

const allDays = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AthletePage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [memberProfile, setMemberProfile] = useState<Member | null>(null)
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([])
  const [staff, setStaff] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [loadingMe, setLoadingMe] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')

  // Day change request
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestDays, setRequestDays] = useState<string[]>([])
  const [requestNote, setRequestNote] = useState('')
  const [requestSaving, setRequestSaving] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  // Password change
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [avatar, setAvatar] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Goal
  const goalRef = useRef<HTMLDivElement>(null)
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)

  // Workout
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseModal, setExerciseModal] = useState<{
    open: boolean
    category: 'upper' | 'lower' | 'core'
    editing: Exercise | null
  }>({ open: false, category: 'upper', editing: null })
  const [exForm, setExForm] = useState<ExerciseForm>({ name: '', sets: '', mode: 'reps', reps: '', duration: '' })
  const [exSaving, setExSaving] = useState(false)
  const [exDeleting, setExDeleting] = useState(false)

  // Weight logs
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [weightSaving, setWeightSaving] = useState(false)
  const [weightDeleting, setWeightDeleting] = useState<string | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL

  // ── Boot: get current user role ──────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(app), async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/auth/signin')
        return
      }
    async function boot() {
      try {
        const token = await firebaseUser!.getIdToken()
        const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error()
        const meData: Me = await res.json()
        setMe(meData)

        if (meData.role === 'member') {
          // Member: load their own profile + metrics + staff (for trainer name)
          const [, sRes] = await Promise.all([
            loadMemberData(meData.ref_id!, token, meData.role),
            fetch(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
          ])
          if (sRes.ok) setStaff(await sRes.json())
          setSelectedId(meData.ref_id!)
        } else {
          // Coach/trainer: load members list + staff
          const [mRes, sRes] = await Promise.all([
            fetch(`${API}/members/`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
          ])
          if (!mRes.ok) throw new Error()
          const memberList: Member[] = await mRes.json()
          if (sRes.ok) setStaff(await sRes.json())
          setMembers(memberList)
          if (memberList.length > 0) {
            setSelectedId(memberList[0].id)
            await loadMemberData(memberList[0].id, token)
          }
        }
      } catch {
        setError('Failed to load data. Please refresh the page.')
      } finally {
        setLoadingMe(false)
      }
    }
    boot()
    })
    return unsub
  }, [])

  async function loadMemberData(memberId: string, token?: string, roleOverride?: string) {
    setLoadingData(true)
    setError('')
    try {
      const tok = token ?? await getToken()
      const headers = { Authorization: `Bearer ${tok}` }
      const isMe = (roleOverride ?? me?.role) === 'member'

      const [profileRes, metricsRes, workoutRes] = await Promise.all([
        fetch(isMe ? `${API}/members/me` : `${API}/members/${memberId}`, { headers }),
        fetch(`${API}/metrics/member/${memberId}`, { headers }),
        fetch(`${API}/workout/${memberId}`, { headers }),
      ])

      if (!profileRes.ok) throw new Error()
      const profile = await profileRes.json()
      setMemberProfile(profile)
      setMetricEntries(metricsRes.ok ? await metricsRes.json() : [])
      setExercises(workoutRes.ok ? await workoutRes.json() : [])
      // Sync goal into contenteditable
      if (goalRef.current) {
        goalRef.current.innerHTML = profile.training_goal ?? ''
      }
      setAvatar(null)
    } catch {
      setError('Failed to load member data. Please try again.')
    } finally {
      setLoadingData(false)
    }
  }

  async function handleMemberChange(id: string) {
    setSelectedId(id)
    await loadMemberData(id)
  }

  // ── Day change request ───────────────────────────────────────────────────

  const openRequestModal = () => {
    setRequestDays(memberProfile?.training_days ?? [])
    setRequestNote('')
    setRequestSent(false)
    setShowRequestModal(true)
  }

  async function submitRequest() {
    if (requestDays.length === 0) return
    setRequestSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/day-change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requested_days: requestDays, note: requestNote || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.detail || 'Failed to submit request. Please try again.')
        return
      }
      setRequestSent(true)
      setTimeout(() => {
        setShowRequestModal(false)
        setRequestSent(false)
        setRequestDays([])
        setRequestNote('')
      }, 1800)
    } catch {
      alert('Unable to reach the server. Please check your connection.')
    } finally {
      setRequestSaving(false)
    }
  }

  async function handlePasswordChange() {
    if (!pwNew || !pwConfirm || !pwCurrent) { setPwError('All fields are required.'); return }
    if (pwNew !== pwConfirm) { setPwError('New passwords do not match.'); return }
    if (pwNew.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    setPwSaving(true)
    setPwError('')
    try {
      const authInstance = getAuth(app)
      const user = authInstance.currentUser
      if (!user || !user.email) throw new Error()
      const credential = EmailAuthProvider.credential(user.email, pwCurrent)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, pwNew)
      setPwSuccess(true)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setTimeout(() => { setShowPasswordModal(false); setPwSuccess(false) }, 1800)
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.')
      } else {
        setPwError('Failed to update password. Please try again.')
      }
    } finally {
      setPwSaving(false)
    }
  }

  // ── Goal ────────────────────────────────────────────────────────────────

  async function saveGoal() {
    if (!m) return
    setGoalSaving(true)
    try {
      const token = await getToken()
      await fetch(`${API}/members/${m.id}/goal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ training_goal: goalRef.current?.innerHTML?.trim() || null }),
      })
      setGoalEditing(false)
    } finally {
      setGoalSaving(false)
    }
  }

  function applyFormat(cmd: string) {
    document.execCommand(cmd, false)
    goalRef.current?.focus()
  }

  // ── Workout ─────────────────────────────────────────────────────────────

  function openAddExercise(category: 'upper' | 'lower' | 'core') {
    setExForm({ name: '', sets: '', mode: 'reps', reps: '', duration: '' })
    setWeightLogs([])
    setWeightInput('')
    setExerciseModal({ open: true, category, editing: null })
  }

  async function openEditExercise(ex: Exercise) {
    setExForm({
      name: ex.name,
      sets: ex.sets != null ? String(ex.sets) : '',
      mode: ex.duration ? 'duration' : 'reps',
      reps: ex.reps != null ? String(ex.reps) : '',
      duration: ex.duration ?? '',
    })
    setWeightInput('')
    setExerciseModal({ open: true, category: ex.category, editing: ex })
    // Fetch weight history
    try {
      const token = await getToken()
      const res = await fetch(`${API}/workout/${ex.member_id}/${ex.id}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setWeightLogs(res.ok ? await res.json() : [])
    } catch {
      setWeightLogs([])
    }
  }

  async function logWeight() {
    if (!m || !exerciseModal.editing || !weightInput.trim()) return
    setWeightSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/workout/${m.id}/${exerciseModal.editing.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weight: weightInput.trim() }),
      })
      if (res.ok) {
        const newLog: WeightLog = await res.json()
        setWeightLogs(prev => [newLog, ...prev])
        setWeightInput('')
      }
    } finally {
      setWeightSaving(false)
    }
  }

  async function deleteWeightLog(logId: string) {
    if (!m || !exerciseModal.editing) return
    setWeightDeleting(logId)
    try {
      const token = await getToken()
      await fetch(`${API}/workout/${m.id}/${exerciseModal.editing.id}/logs/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setWeightLogs(prev => prev.filter(l => l.id !== logId))
    } finally {
      setWeightDeleting(null)
    }
  }

  async function saveExercise() {
    if (!m || !exForm.name.trim()) return
    setExSaving(true)
    try {
      const token = await getToken()
      const body = {
        category: exerciseModal.category,
        name: exForm.name.trim(),
        sets: exForm.sets ? parseInt(exForm.sets) : null,
        reps: exForm.mode === 'reps' && exForm.reps ? parseInt(exForm.reps) : null,
        duration: exForm.mode === 'duration' && exForm.duration ? exForm.duration.trim() : null,
      }
      const url = exerciseModal.editing
        ? `${API}/workout/${m.id}/${exerciseModal.editing.id}`
        : `${API}/workout/${m.id}`
      const method = exerciseModal.editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      const saved: Exercise = await res.json()
      if (exerciseModal.editing) {
        setExercises(prev => prev.map(e => e.id === saved.id ? saved : e))
      } else {
        setExercises(prev => [...prev, saved])
      }
      setExerciseModal({ open: false, category: 'upper', editing: null })
    } finally {
      setExSaving(false)
    }
  }

  async function deleteExercise(ex: Exercise) {
    if (!m) return
    setExDeleting(true)
    try {
      const token = await getToken()
      await fetch(`${API}/workout/${m.id}/${ex.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setExercises(prev => prev.filter(e => e.id !== ex.id))
      setExerciseModal({ open: false, category: 'upper', editing: null })
    } finally {
      setExDeleting(false)
    }
  }

  // ── Derived metric display ───────────────────────────────────────────────

  // entries are ordered oldest→newest from the API
  const sorted = [...metricEntries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  const latest = sorted[sorted.length - 1] ?? null
  const prev = sorted[sorted.length - 2] ?? null

  const tiles = latest ? [
    {
      label: '10YD Fly', note: 'lower is better',
      value: fmtVal(latest.fly_10yd, 's', 2),
      change: changeStr(latest.fly_10yd, prev?.fly_10yd ?? null, 's', true),
      direction: trend(latest.fly_10yd, prev?.fly_10yd ?? null, true),
    },
    {
      label: 'Game Speed', note: null,
      value: fmtVal(latest.game_speed, ' mph', 1),
      change: changeStr(latest.game_speed, prev?.game_speed ?? null, ' mph'),
      direction: trend(latest.game_speed, prev?.game_speed ?? null),
    },
    {
      label: 'Vertical', note: null,
      value: fmtVal(latest.vertical, '"'),
      change: changeStr(latest.vertical, prev?.vertical ?? null, '"'),
      direction: trend(latest.vertical, prev?.vertical ?? null),
    },
    {
      label: 'Broad Jump', note: null,
      value: fmtVal(latest.broad_jump, '"'),
      change: changeStr(latest.broad_jump, prev?.broad_jump ?? null, '"'),
      direction: trend(latest.broad_jump, prev?.broad_jump ?? null),
    },
    {
      label: 'Overall Progress', note: 'out of 100',
      value: fmtVal(latest.overall_progress, ''),
      change: changeStr(latest.overall_progress, prev?.overall_progress ?? null, ''),
      direction: trend(latest.overall_progress, prev?.overall_progress ?? null),
    },
  ] : []

  const graphData = sorted
    .filter(e => e.overall_progress != null)
    .map(e => ({
      label: new Date(e.recorded_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: e.overall_progress!,
      entry: e,
    }))

  const isCoach = me?.role === 'coach' || me?.role === 'trainer'
  const m = memberProfile

  if (loadingMe) {
    return (
      <div className="w-full bg-gray-100" style={{ padding: '2rem 6rem' }}>
        <MetricsSkeleton />
      </div>
    )
  }

  if (error && !m) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 flex">

      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center overflow-y-auto" style={{ padding: '2rem' }}>

        {/* Member picker — coach/trainer only */}
        {isCoach && members.length > 0 && (
          <div className="w-full mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Select Member</p>
            <select
              value={selectedId}
              onChange={e => handleMemberChange(e.target.value)}
              className="w-full bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-gray-300"
              style={{ padding: '0.6rem 0.75rem' }}
            >
              {members.map(mem => (
                <option key={mem.id} value={mem.id}>
                  #{mem.display_id} — {mem.first_name} {mem.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loadingData ? (
          <div className="flex-1 flex flex-col gap-4 p-4">
            <MetricsSkeleton />
          </div>
        ) : m ? (
          <>
            {/* Avatar */}
            <div className="relative mb-6" style={{ marginTop: isCoach ? '1.5rem' : '1.5rem' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer overflow-hidden hover:opacity-90 transition"
              >
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-3xl font-bold">{m.first_name[0]}{m.last_name[0]}</span>
                )}
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = ev => setAvatar(ev.target?.result as string)
                  reader.readAsDataURL(file)
                }
              }} className="hidden" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 text-center mb-10">{m.first_name} {m.last_name}</h2>

            <div className="w-full flex flex-col gap-4">
              {m.age != null && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Age</p>
                  <p className="text-sm font-medium text-gray-800">{m.age}</p>
                </div>
              )}
              {m.weight && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Weight</p>
                  <p className="text-sm font-medium text-gray-800">{m.weight}</p>
                </div>
              )}
              {m.height && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Height</p>
                  <p className="text-sm font-medium text-gray-800">{m.height}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 break-all">{m.email}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(m.email); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition"
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {m.phone && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-sm font-medium text-gray-800">{m.phone}</p>
                </div>
              )}

              <hr className="border-gray-200 my-2" />

              {m.trainer_id && (() => {
                const t = staff.find(s => s.id === m.trainer_id)
                return t ? (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Trainer</p>
                    <p className="text-sm font-medium text-gray-800">{t.first_name} {t.last_name}</p>
                  </div>
                ) : null
              })()}

              <hr className="border-gray-200 my-2" />

              {m.sessions_total != null && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Sessions</p>
                  <p className="text-sm font-medium text-gray-800">{m.sessions_total}</p>
                </div>
              )}
              {m.sessions_left != null && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sessions Left</p>
                  <p className={`text-sm font-medium ${m.sessions_left < 5 ? 'text-red-600' : m.sessions_left <= 10 ? 'text-yellow-500' : 'text-gray-800'}`}>
                    {m.sessions_left}
                  </p>
                </div>
              )}
              {m.package && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Package</p>
                  <p className="text-sm font-medium text-gray-800">{m.package}</p>
                </div>
              )}

              {m.training_days && m.training_days.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Training Days</p>
                  <div className="flex items-center gap-1.5">
                    {[...m.training_days].sort((a, b) => allDays.indexOf(a) - allDays.indexOf(b)).map(day => (
                      <span key={day} className="text-xs font-normal rounded-full bg-gray-900 text-white flex items-center justify-center"
                        style={{ width: day === 'Th' ? '2rem' : '1.75rem', height: '1.75rem' }}>
                        {day}
                      </span>
                    ))}
                  </div>
                  {/* Only members can request a change */}
                  {!isCoach && (
                    <div className="flex flex-col gap-2 mt-3">
                      <button
                        onClick={openRequestModal}
                        className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition text-left"
                      >
                        Request a change
                      </button>
                      <button
                        onClick={() => { setPwError(''); setPwSuccess(false); setShowPasswordModal(true) }}
                        className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition text-left"
                      >
                        Change password
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '2rem' }}>
        {loadingData ? (
          <MetricsSkeleton />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Athlete Metrics</h1>
              {m && <p className="text-sm text-gray-400 mt-1">{m.first_name} {m.last_name} · #{m.display_id}</p>}
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {error}
              </div>
            )}

            {/* ── Goal Box ── */}
            {m && (
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Goal</p>
                {goalEditing ? (
                  /* Edit mode */
                  <div className="bg-white border border-gray-200 rounded-2xl" style={{ padding: '1rem 1.25rem' }}>
                    {/* Formatting toolbar */}
                    <div className="flex items-center gap-1 mb-3">
                      <button onMouseDown={e => { e.preventDefault(); applyFormat('bold') }}
                        className="w-7 h-7 flex items-center justify-center text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition">B</button>
                      <button onMouseDown={e => { e.preventDefault(); applyFormat('italic') }}
                        className="w-7 h-7 flex items-center justify-center text-xs italic text-gray-700 hover:bg-gray-100 rounded-lg transition">I</button>
                      <button onMouseDown={e => { e.preventDefault(); applyFormat('underline') }}
                        className="w-7 h-7 flex items-center justify-center text-xs underline text-gray-700 hover:bg-gray-100 rounded-lg transition">U</button>
                      <div className="w-px h-4 bg-gray-200 mx-1" />
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { document.execCommand('insertText', false, '😊'); goalRef.current?.focus() }}
                        className="w-7 h-7 flex items-center justify-center text-xs hover:bg-gray-100 rounded-lg transition">😊</button>
                      <div className="flex-1" />
                      <button
                        onClick={() => setGoalEditing(false)}
                        className="text-xs font-medium text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        style={{ padding: '0.3rem 0.75rem' }}>
                        Cancel
                      </button>
                      <button
                        onClick={saveGoal}
                        disabled={goalSaving}
                        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition disabled:opacity-50 ml-2"
                        style={{ padding: '0.3rem 0.875rem' }}>
                        {goalSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    <div
                      ref={goalRef}
                      contentEditable
                      suppressContentEditableWarning
                      autoFocus
                      data-placeholder="No goal set..."
                      className="outline-none text-sm text-gray-800 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 min-h-[1.5rem]"
                    />
                  </div>
                ) : (
                  /* View mode — full-width bar with pencil inside */
                  <div className="bg-white border border-gray-200 rounded-2xl flex items-center gap-3" style={{ padding: '0.875rem 1.25rem' }}>
                    <div
                      className="flex-1 text-sm text-gray-800"
                      dangerouslySetInnerHTML={{ __html: m.training_goal || '<span style="color:#d1d5db">No goal set...</span>' }}
                    />
                    <button
                      onClick={() => {
                        setGoalEditing(true)
                        setTimeout(() => {
                          if (goalRef.current) {
                            goalRef.current.innerHTML = m.training_goal ?? ''
                            goalRef.current.focus()
                            const range = document.createRange()
                            range.selectNodeContents(goalRef.current)
                            range.collapse(false)
                            window.getSelection()?.removeAllRanges()
                            window.getSelection()?.addRange(range)
                          }
                        }, 0)
                      }}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Metrics ── */}
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Metrics</p>
              {tiles.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 flex" style={{ minHeight: '260px' }}>
                  {/* Left: metric tiles stacked */}
                  <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: '240px', padding: '1.25rem' }}>
                    {tiles.map(tile => (
                      <div key={tile.label} className="bg-gray-50 rounded-xl" style={{ padding: '0.875rem 1rem' }}>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">{tile.label}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-gray-900">{tile.value}</p>
                          <div className="flex items-center gap-1">
                            <TrendArrow direction={tile.direction} />
                            <span className="text-xs text-gray-400">{tile.change}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Divider */}
                  <div className="w-px bg-gray-100 flex-shrink-0 my-4" />
                  {/* Right: graph */}
                  <div className="flex-1" style={{ padding: '1.25rem' }}>
                    {graphData.length > 0 ? (
                      <>
                        <p className="text-xs font-semibold text-gray-500 mb-3">Overall Progress over time</p>
                        <ProgressGraph data={graphData} />
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300 text-sm">No graph data yet</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-center" style={{ padding: '4rem 2rem' }}>
                  <p className="text-gray-400 font-medium mb-1">No metrics recorded yet</p>
                  {isCoach ? (
                    <p className="text-sm text-gray-300">Add entries from the Metrics admin panel.</p>
                  ) : (
                    <p className="text-sm text-gray-300">Your coach will add your metrics after each session.</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Workout ── */}
            {m && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Workout</p>
                {(['upper', 'lower', 'core'] as const).map(cat => {
                  const catExercises = exercises.filter(e => e.category === cat)
                  const label = cat === 'upper' ? 'Upper Body' : cat === 'lower' ? 'Lower Body' : 'Core'
                  return (
                    <div key={cat} className="mb-6">
                      <p className="text-xs font-semibold text-gray-500 mb-3">{label}</p>
                      <div className="flex flex-wrap gap-3">
                        {catExercises.map(ex => {
                          // Find latest weight for this exercise from all logs — not loaded here,
                          // so we store them per exercise after opening. For tile display we
                          // keep a lightweight map updated on log actions.
                          return (
                            <button
                              key={ex.id}
                              onClick={() => openEditExercise(ex)}
                              className="bg-white border border-gray-200 rounded-2xl text-left hover:border-gray-400 hover:shadow-sm transition"
                              style={{ padding: '0.875rem 1.1rem', minWidth: '120px' }}
                            >
                              <p className="text-sm font-semibold text-gray-900 mb-0.5">{ex.name}</p>
                              <p className="text-xs text-gray-400">
                                {ex.sets != null ? `${ex.sets} × ` : ''}
                                {ex.reps != null ? `${ex.reps} reps` : ex.duration ?? '—'}
                              </p>
                            </button>
                          )
                        })}
                        {/* Add button */}
                        <button
                          onClick={() => openAddExercise(cat)}
                          className="w-14 h-14 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-gray-400 hover:text-gray-500 transition text-2xl font-light flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Exercise Modal */}
      {exerciseModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-base font-bold text-gray-900 mb-5">
              {exerciseModal.editing ? 'Edit Exercise' : `Add Exercise · ${exerciseModal.category === 'upper' ? 'Upper Body' : exerciseModal.category === 'lower' ? 'Lower Body' : 'Core'}`}
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Exercise Name</label>
                <input
                  value={exForm.name}
                  onChange={e => setExForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Bench Press"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sets</label>
                <input
                  value={exForm.sets}
                  onChange={e => setExForm(f => ({ ...f, sets: e.target.value }))}
                  type="number" min="1" placeholder="e.g. 3"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }}
                />
              </div>
              {/* Reps / Duration toggle */}
              <div>
                <div className="flex gap-2 mb-2">
                  {(['reps', 'duration'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setExForm(f => ({ ...f, mode }))}
                      className={`text-xs font-medium rounded-lg px-3 py-1 transition capitalize ${exForm.mode === mode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {exForm.mode === 'reps' ? (
                  <input
                    value={exForm.reps}
                    onChange={e => setExForm(f => ({ ...f, reps: e.target.value }))}
                    type="number" min="1" placeholder="e.g. 10"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                ) : (
                  <input
                    value={exForm.duration}
                    onChange={e => setExForm(f => ({ ...f, duration: e.target.value }))}
                    placeholder="e.g. 30 sec, 20 min"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                )}
              </div>
            </div>
            {/* ── Weight Log Section — only when editing ── */}
            {exerciseModal.editing && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="w-full h-px bg-gray-100 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Weight History</p>

                {/* Log new weight */}
                <div className="flex gap-2 mb-3">
                  <input
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && logWeight()}
                    placeholder="e.g. 45 lbs, 20 kg"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.5rem 0.875rem' }}
                  />
                  <button
                    onClick={logWeight}
                    disabled={weightSaving || !weightInput.trim()}
                    className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50 flex-shrink-0"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {weightSaving ? '...' : 'Log'}
                  </button>
                </div>

                {/* History list */}
                {weightLogs.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {weightLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between bg-gray-50 rounded-xl" style={{ padding: '0.4rem 0.75rem' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-800">{log.weight}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.logged_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteWeightLog(log.id)}
                          disabled={weightDeleting === log.id}
                          className="text-gray-300 hover:text-red-400 transition text-xs disabled:opacity-50"
                        >
                          {weightDeleting === log.id ? '...' : '✕'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 text-center" style={{ padding: '0.5rem 0' }}>No weight logged yet</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between" style={{ marginTop: '1.75rem' }}>
              {/* Delete — only when editing */}
              {exerciseModal.editing ? (
                <button
                  onClick={() => exerciseModal.editing && deleteExercise(exerciseModal.editing)}
                  disabled={exDeleting}
                  className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                  style={{ padding: '0.4rem 0.875rem' }}
                >
                  {exDeleting ? 'Deleting...' : 'Delete'}
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button
                  onClick={() => setExerciseModal({ open: false, category: 'upper', editing: null })}
                  disabled={exSaving}
                  className="text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveExercise}
                  disabled={exSaving || !exForm.name.trim()}
                  className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  {exSaving ? 'Saving...' : exerciseModal.editing ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Change Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            {requestSent ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900">Request sent!</p>
                <p className="text-xs text-gray-400 text-center">Your trainer will review and confirm the change.</p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-gray-900 mb-1">Request Day Change</h3>
                <p className="text-xs text-gray-400 mb-5">Select your preferred training days. Your trainer will approve or adjust.</p>

                <div className="mb-5">
                  <p className="text-xs text-gray-500 font-medium mb-2">Preferred Days</p>
                  <div className="flex items-center gap-2">
                    {allDays.map(day => (
                      <button key={day} type="button"
                        onClick={() => setRequestDays(prev =>
                          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                        )}
                        className={`text-xs rounded-full transition flex items-center justify-center ${
                          requestDays.includes(day) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        style={{ width: day === 'Th' ? '2rem' : '1.75rem', height: '1.75rem' }}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs text-gray-500 font-medium mb-2">Note (optional)</p>
                  <textarea
                    value={requestNote}
                    onChange={e => setRequestNote(e.target.value)}
                    placeholder="Let your trainer know why you need this change..."
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowRequestModal(false)} disabled={requestSaving}
                    className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                    style={{ padding: '0.6rem 1.25rem' }}>
                    Cancel
                  </button>
                  <button onClick={submitRequest} disabled={requestDays.length === 0 || requestSaving}
                    className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-40"
                    style={{ padding: '0.6rem 1.25rem' }}>
                    {requestSaving ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            {pwSuccess ? (
              <div className="text-center" style={{ padding: '1rem 0' }}>
                <div className="text-4xl mb-3">✅</div>
                <p className="font-semibold text-gray-900">Password updated!</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-5">Change Password</h3>
                {pwError && (
                  <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    {pwError}
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
                    <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                      autoComplete="current-password"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.6rem 0.875rem' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                    <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.6rem 0.875rem' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
                    <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.6rem 0.875rem' }} />
                  </div>
                </div>
                <div className="flex justify-end gap-3" style={{ marginTop: '1.5rem' }}>
                  <button
                    onClick={() => { setShowPasswordModal(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('') }}
                    className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                    style={{ padding: '0.6rem 1.25rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    disabled={pwSaving}
                    className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                    style={{ padding: '0.6rem 1.25rem' }}
                  >
                    {pwSaving ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
