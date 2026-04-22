'use client'

import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import PreviewPanel from '@/components/PreviewPanel'
import { TableSkeleton } from '@/components/Skeleton'
import ErrorState from '@/components/ErrorState'

type Trainer = {
  id: string
  first_name: string
  last_name: string
  role?: string
}

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
  created_at: string
  last_active_at?: string | null
}

type DayRequest = {
  id: string
  member_id: string
  requested_days: string[]
  note: string | null
  status: string
}

type MemberForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  age: string
  weight: string
  height: string
  trainer_id: string
  package: string
  sessions_total: string
  sessions_left: string
  training_days: string[]
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function isInactive(member: Member): boolean {
  const activeDays = daysSince(member.last_active_at)
  if (activeDays === null) {
    const createdDays = daysSince(member.created_at)
    return createdDays !== null && createdDays > 60
  }
  return activeDays > 60
}

const allDays = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']

const emptyForm: MemberForm = {
  first_name: '', last_name: '', email: '', phone: '',
  age: '', weight: '', height: '', trainer_id: '',
  package: '', sessions_total: '', sessions_left: '', training_days: [],
}

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

function trainerName(trainers: Trainer[], id: string | null) {
  if (!id) return '—'
  const t = trainers.find(t => t.id === id)
  return t ? `${t.first_name} ${t.last_name}` : '—'
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [dayRequests, setDayRequests] = useState<DayRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [form, setForm] = useState<MemberForm>(emptyForm)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleting, setDeleting] = useState(false)
  const [dayEditTarget, setDayEditTarget] = useState<Member | null>(null)
  const [dayEditSelection, setDayEditSelection] = useState<string[]>([])
  const [dayEditSaving, setDayEditSaving] = useState(false)
  const [reviewRequest, setReviewRequest] = useState<DayRequest | null>(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [newMemberCreds, setNewMemberCreds] = useState<{ name: string; email: string; password: string } | null>(null)
  const [attendingId, setAttendingId] = useState<string | null>(null)
  const [previewMember, setPreviewMember] = useState<Member | null>(null)
  const [previewMode, setPreviewMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile')
  const [showInactiveOnly, setShowInactiveOnly] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setLoadError('')
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [mRes, tRes, rRes] = await Promise.all([
        fetch(`${API}/members/`, { headers }),
        fetch(`${API}/staff`, { headers }),
        fetch(`${API}/day-change-requests/?status_filter=pending`, { headers }),
      ])
      if (!mRes.ok || !tRes.ok) throw new Error()
      setMembers(await mRes.json())
      setTrainers(await tRes.json())
      setDayRequests(rRes.ok ? await rRes.json() : [])
    } catch {
      setLoadError('Failed to load members. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const inactiveCount = members.filter(isInactive).length

  const filtered = members
    .filter(m => `${m.first_name} ${m.last_name} ${m.display_id} ${m.email}`.toLowerCase().includes(search.toLowerCase()))
    .filter(m => !showInactiveOnly || isInactive(m))

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...emptyForm, trainer_id: trainers[0]?.id ?? '' })
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (m: Member) => {
    setEditTarget(m)
    setForm({
      first_name: m.first_name, last_name: m.last_name, email: m.email,
      phone: m.phone ?? '', age: m.age ? String(m.age) : '',
      weight: m.weight ?? '', height: m.height ?? '',
      trainer_id: m.trainer_id ?? '', package: m.package ?? '',
      sessions_total: m.sessions_total ? String(m.sessions_total) : '',
      sessions_left: m.sessions_left ? String(m.sessions_left) : '',
      training_days: m.training_days ?? [],
    })
    setModalError('')
    setShowModal(true)
  }

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      training_days: prev.training_days.includes(day)
        ? prev.training_days.filter(d => d !== day)
        : [...prev.training_days, day],
    }))
  }

  async function handleSave() {
    if (!form.first_name || !form.last_name || !form.email) {
      setModalError('First name, last name, and email are required.')
      return
    }
    if (form.age) {
      const ageNum = Number(form.age)
      if (isNaN(ageNum) || ageNum < 1 || !Number.isInteger(ageNum)) {
        setModalError('Please enter a valid age (must be a positive whole number).')
        return
      }
    }
    setSaving(true)
    setModalError('')
    try {
      const token = await getToken()
      const body = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        age: form.age ? Number(form.age) : null,
        weight: form.weight || null,
        height: form.height || null,
        trainer_id: form.trainer_id || null,
        package: form.package || null,
        sessions_total: form.sessions_total ? Number(form.sessions_total) : null,
        sessions_left: form.sessions_left ? Number(form.sessions_left) : null,
        training_days: form.training_days.length ? form.training_days : null,
      }
      const url = editTarget ? `${API}/members/${editTarget.id}` : `${API}/members`
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data?.detail
        setModalError(Array.isArray(msg) ? msg.map((e: any) => e.msg).join(', ') : msg || 'Something went wrong.')
        return
      }
      const saved = await res.json()
      await fetchAll()
      setShowModal(false)
      if (!editTarget && saved.temp_password) {
        setNewMemberCreds({
          name: `${form.first_name} ${form.last_name}`,
          email: form.email,
          password: saved.temp_password,
        })
      }
    } catch {
      setModalError('Unable to reach the server. Please check your connection.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/members/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204) { alert('Failed to remove member. Please try again.'); return }
      await fetchAll()
      setDeleteTarget(null)
      setDeleteStep(1)
    } catch {
      alert('Unable to reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAttend(m: Member) {
    setAttendingId(m.id)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/members/${m.id}/attend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.detail ?? 'Failed to mark attendance.')
        return
      }
      const updated = await res.json()
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, sessions_left: updated.sessions_left } : x))
    } catch {
      alert('Failed to mark attendance.')
    } finally {
      setAttendingId(null)
    }
  }

  const openDayEdit = (m: Member) => {
    setDayEditTarget(m)
    setDayEditSelection(m.training_days ?? [])
  }

  async function saveDays() {
    if (!dayEditTarget) return
    setDayEditSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/members/${dayEditTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ training_days: dayEditSelection }),
      })
      if (!res.ok) { alert('Failed to save days. Please try again.'); return }
      await fetchAll()
      setDayEditTarget(null)
    } catch {
      alert('Unable to reach the server.')
    } finally {
      setDayEditSaving(false)
    }
  }

  async function handleReview(action: 'approve' | 'deny') {
    if (!reviewRequest) return
    setReviewSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/day-change-requests/${reviewRequest.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { alert(`Failed to ${action} request. Please try again.`); return }
      await fetchAll()
      setReviewRequest(null)
    } catch {
      alert('Unable to reach the server.')
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Members</h2>
          <p className="text-sm text-gray-500">{members.length} total members</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
          style={{ padding: '0.6rem 1.25rem' }}
        >
          + Add Member
        </button>
      </div>

      {loadError && <ErrorState variant="network" message={loadError} onRetry={fetchAll} />}

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ID, or email..."
          className="w-full max-w-sm bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
          style={{ padding: '0.6rem 1rem' }}
        />
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactiveOnly(v => !v)}
            className={`text-xs font-medium rounded-xl transition ${showInactiveOnly ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            style={{ padding: '0.4rem 0.875rem' }}
          >
            {showInactiveOnly ? `Showing ${inactiveCount} inactive` : `${inactiveCount} inactive`}
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={7} cols={7} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1.5rem' }}>ID</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Name</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Email</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Phone</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Age</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Trainer</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const pending = dayRequests.find(r => r.member_id === m.id)
                return (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg" style={{ padding: '0.2rem 0.6rem' }}>{m.display_id}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{m.first_name} {m.last_name}</span>
                          {pending && (
                            <span className="text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full" style={{ padding: '0.1rem 0.5rem' }}>Request</span>
                          )}
                          {isInactive(m) && (
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-lg" style={{ padding: '0.2rem 0.5rem' }}>
                              Inactive 60+ days
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-gray-600" style={{ padding: '1rem' }}>{m.email}</td>
                    <td className="text-gray-600" style={{ padding: '1rem' }}>{m.phone ?? '—'}</td>
                    <td className="text-gray-600" style={{ padding: '1rem' }}>{m.age ?? '—'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium rounded-lg" style={{ padding: '0.2rem 0.6rem' }}>
                        {trainerName(trainers, m.trainer_id)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div className="flex items-center gap-2">
                        {pending && (
                          <button
                            onClick={() => setReviewRequest(pending)}
                            className="text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition"
                            style={{ padding: '0.3rem 0.75rem' }}
                          >
                            Review
                          </button>
                        )}
                        <button onClick={() => { setPreviewMember(m); setPreviewMode('mobile') }}
                          className="text-xs font-medium text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                          style={{ padding: '0.3rem 0.75rem' }}>
                          Preview
                        </button>
                        {m.sessions_left != null && m.sessions_left > 0 && (
                          <button
                            onClick={() => handleAttend(m)}
                            disabled={attendingId === m.id}
                            className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                            style={{ padding: '0.3rem 0.75rem' }}>
                            {attendingId === m.id ? '...' : '✓ Attended'}
                          </button>
                        )}
                        <button onClick={() => openEdit(m)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                          style={{ padding: '0.3rem 0.75rem' }}>
                          Edit
                        </button>
                        <button onClick={() => openDayEdit(m)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          style={{ padding: '0.3rem 0.75rem' }}>
                          Days
                        </button>
                        <button onClick={() => { setDeleteTarget(m); setDeleteStep(1) }}
                          className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                          style={{ padding: '0.3rem 0.75rem' }}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
                    {members.length === 0 ? 'No members yet.' : 'No members match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto" style={{ padding: '2rem', maxHeight: '90vh' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-6">{editTarget ? 'Edit Member' : 'Add New Member'}</h3>

            {modalError && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {modalError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                  <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                  <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Age</label>
                  <input value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} type="number"
                    min="1" step="1"
                    onKeyDown={e => { if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault() }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Weight</label>
                  <input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="185 lbs"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
                  <input value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} placeholder={`6'1"`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Assign Trainer</label>
                <select value={form.trainer_id} onChange={e => setForm({ ...form, trainer_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }}>
                  <option value="">— No trainer —</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}{t.role === 'coach' ? ' (Coach)' : ''}</option>)}
                </select>
              </div>

              <hr className="border-gray-100" />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Package</label>
                <input value={form.package} onChange={e => setForm({ ...form, package: e.target.value })} placeholder="Elite Performance"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Total Sessions</label>
                  <input value={form.sessions_total} onChange={e => setForm({ ...form, sessions_total: e.target.value })} type="number" placeholder="22"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sessions Left</label>
                  <input value={form.sessions_left} onChange={e => setForm({ ...form, sessions_left: e.target.value })} type="number" placeholder="8"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Training Days</label>
                <div className="flex items-center gap-2">
                  {allDays.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`text-xs font-medium rounded-full transition flex items-center justify-center ${
                        form.training_days.includes(day) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      style={{ width: day === 'Th' ? '2rem' : '1.75rem', height: '1.75rem' }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3" style={{ marginTop: '1.75rem' }}>
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete — Step 1 */}
      {deleteTarget && deleteStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Member?</h3>
            <p className="text-sm text-gray-500 mb-6">
              You are about to remove <span className="font-semibold text-gray-900">{deleteTarget.first_name} {deleteTarget.last_name}</span>. All their data including metrics will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteStep(1) }}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={() => setDeleteStep(2)}
                className="text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete — Step 2 */}
      {deleteTarget && deleteStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-red-600 mb-2">This cannot be undone</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you absolutely sure you want to permanently remove <span className="font-semibold text-gray-900">{deleteTarget.first_name} {deleteTarget.last_name}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteStep(1) }} disabled={deleting}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {deleting ? 'Removing...' : 'Yes, Remove Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Day Edit Modal */}
      {dayEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Change Training Days</h3>
            <p className="text-sm text-gray-500 mb-6">{dayEditTarget.first_name} {dayEditTarget.last_name}</p>
            <div className="mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Select Days</p>
              <div className="flex items-center gap-2 flex-wrap">
                {allDays.map(day => (
                  <button key={day} type="button"
                    onClick={() => setDayEditSelection(prev =>
                      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                    )}
                    className={`text-xs rounded-full transition flex items-center justify-center ${
                      dayEditSelection.includes(day) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    style={{ width: '2rem', height: '2rem' }}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDayEditTarget(null)} disabled={dayEditSaving}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={saveDays} disabled={dayEditSaving || dayEditSelection.length === 0}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-40"
                style={{ padding: '0.6rem 1.25rem' }}>
                {dayEditSaving ? 'Saving...' : 'Save Days'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Change Request Review Modal */}
      {reviewRequest && (() => {
        const member = members.find(m => m.id === reviewRequest.member_id)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Day Change Request</h3>
              <p className="text-sm text-gray-500 mb-5">{member?.first_name} {member?.last_name}</p>

              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Current</p>
                  <div className="flex items-center gap-1">
                    {(member?.training_days ?? []).map(d => (
                      <span key={d} className="text-xs bg-gray-200 text-gray-600 rounded-full flex items-center justify-center" style={{ width: '1.75rem', height: '1.75rem' }}>{d}</span>
                    ))}
                  </div>
                </div>
                <span className="text-gray-300 text-lg">→</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Requested</p>
                  <div className="flex items-center gap-1">
                    {reviewRequest.requested_days.map(d => (
                      <span key={d} className="text-xs bg-gray-900 text-white rounded-full flex items-center justify-center" style={{ width: '1.75rem', height: '1.75rem' }}>{d}</span>
                    ))}
                  </div>
                </div>
              </div>

              {reviewRequest.note && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-xl mb-5" style={{ padding: '0.5rem 0.75rem' }}>
                  "{reviewRequest.note}"
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => handleReview('deny')} disabled={reviewSaving}
                  className="text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50"
                  style={{ padding: '0.6rem 1.25rem' }}>
                  {reviewSaving ? '...' : 'Deny'}
                </button>
                <button onClick={() => handleReview('approve')} disabled={reviewSaving}
                  className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                  style={{ padding: '0.6rem 1.25rem' }}>
                  {reviewSaving ? '...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* New Member Credentials Modal */}
      {newMemberCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-4 text-green-600 text-lg">✓</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Member Added</h3>
            <p className="text-sm text-gray-500 mb-5">
              Share these login credentials with <span className="font-semibold text-gray-800">{newMemberCreds.name}</span>. They can change their password after signing in.
            </p>

            <div className="bg-gray-50 rounded-xl flex flex-col gap-3" style={{ padding: '1rem' }}>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm font-mono text-gray-800">{newMemberCreds.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Temporary Password</p>
                <p className="text-sm font-mono font-semibold text-gray-900 tracking-wider">{newMemberCreds.password}</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3 mb-5">This password will not be shown again.</p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Email: ${newMemberCreds.email}\nPassword: ${newMemberCreds.password}`)
                }}
                className="text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Copy
              </button>
              <button
                onClick={() => setNewMemberCreds(null)}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Preview Panel */}
      {previewMember && (
        <PreviewPanel
          url={`/admin/preview/member/${previewMember.id}`}
          title={`${previewMember.first_name} ${previewMember.last_name}`}
          viewMode={previewMode}
          onViewModeChange={setPreviewMode}
          onClose={() => setPreviewMember(null)}
        />
      )}
    </div>
  )
}
