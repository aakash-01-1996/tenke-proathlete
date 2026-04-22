'use client'

import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import { CardGridSkeleton, Skeleton } from '@/components/Skeleton'
import ErrorState from '@/components/ErrorState'

type Trainer = {
  id: string
  display_id: number | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  title: string | null
  specializations: string | null
  created_at: string
}

type TrainerForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  title: string
  specializations: string
}

const TITLES = ['Coach', 'Assistant Coach', 'Trainer', 'Advisor']

const titleColors: Record<string, string> = {
  'Coach':           'bg-gray-900 text-white',
  'Assistant Coach': 'bg-gray-700 text-white',
  'Trainer':         'bg-blue-100 text-blue-700',
  'Advisor':         'bg-purple-100 text-purple-700',
}

const emptyForm: TrainerForm = { first_name: '', last_name: '', email: '', phone: '', title: 'Trainer', specializations: '' }

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

type Coach = { id: string; email: string; first_name: string | null; last_name: string | null; created_at: string | null }
type CoachForm = { first_name: string; last_name: string; email: string }
type NewCoachCreds = { name: string; email: string; password: string }

export default function TrainersPage() {
  const [tab, setTab] = useState<'trainers' | 'coaches'>('trainers')

  // Trainer state
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Trainer | null>(null)
  const [form, setForm] = useState<TrainerForm>(emptyForm)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Trainer | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [removalRequestSent, setRemovalRequestSent] = useState(false)

  // Coach state
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState('')
  const [showCoachModal, setShowCoachModal] = useState(false)
  const [coachForm, setCoachForm] = useState<CoachForm>({ first_name: '', last_name: '', email: '' })
  const [coachModalError, setCoachModalError] = useState('')
  const [savingCoach, setSavingCoach] = useState(false)
  const [deleteCoachTarget, setDeleteCoachTarget] = useState<Coach | null>(null)
  const [deletingCoach, setDeletingCoach] = useState(false)
  const [newCoachCreds, setNewCoachCreds] = useState<NewCoachCreds | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [editNameTarget, setEditNameTarget] = useState<Coach | null>(null)
  const [nameForm, setNameForm] = useState({ first_name: '', last_name: '' })
  const [nameSaving, setNameSaving] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    fetchTrainers()
    setCurrentUserEmail(getAuth(app).currentUser?.email ?? null)
  }, [])
  useEffect(() => { if (tab === 'coaches') fetchCoaches() }, [tab])

  async function fetchTrainers() {
    setLoading(true)
    setLoadError('')
    try {
      const token = await getToken()
      const res = await fetch(`${API}/trainers/`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error()
      setTrainers(await res.json())
    } catch {
      setLoadError('Failed to load trainers. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCoaches() {
    setCoachLoading(true)
    setCoachError('')
    try {
      const token = await getToken()
      const res = await fetch(`${API}/coaches/`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error()
      setCoaches(await res.json())
    } catch {
      setCoachError('Failed to load coaches. Please refresh.')
    } finally {
      setCoachLoading(false)
    }
  }

  async function handleSaveCoach() {
    if (!coachForm.first_name || !coachForm.last_name || !coachForm.email) {
      setCoachModalError('All fields are required.')
      return
    }
    setSavingCoach(true)
    setCoachModalError('')
    try {
      const token = await getToken()
      const res = await fetch(`${API}/coaches/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(coachForm),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCoachModalError(data?.detail || 'Something went wrong.')
        return
      }
      const saved = await res.json()
      await fetchCoaches()
      setShowCoachModal(false)
      setCoachForm({ first_name: '', last_name: '', email: '' })
      setNewCoachCreds({ name: `${coachForm.first_name} ${coachForm.last_name}`, email: saved.email, password: saved.temp_password })
    } catch {
      setCoachModalError('Unable to reach the server.')
    } finally {
      setSavingCoach(false)
    }
  }

  async function handleSaveName() {
    if (!nameForm.first_name.trim() || !editNameTarget) return
    setNameSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(nameForm),
      })
      if (res.ok) {
        setCoaches(cs => cs.map(c => c.id === editNameTarget.id
          ? { ...c, first_name: nameForm.first_name.trim(), last_name: nameForm.last_name.trim() }
          : c
        ))
        setEditNameTarget(null)
      }
    } finally {
      setNameSaving(false)
    }
  }

  async function confirmDeleteCoach() {
    if (!deleteCoachTarget) return
    setDeletingCoach(true)
    try {
      const token = await getToken()
      await fetch(`${API}/coaches/${deleteCoachTarget.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      await fetchCoaches()
      setDeleteCoachTarget(null)
    } catch {
      setCoachError('Failed to remove coach.')
    } finally {
      setDeletingCoach(false)
    }
  }

  const filtered = trainers.filter(t =>
    `${t.first_name} ${t.last_name} ${t.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (t: Trainer) => {
    setEditTarget(t)
    setForm({
      first_name: t.first_name, last_name: t.last_name, email: t.email,
      phone: t.phone ?? '', title: t.title ?? 'Trainer',
      specializations: t.specializations ?? '',
    })
    setModalError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.first_name || !form.last_name || !form.email) {
      setModalError('First name, last name, and email are required.')
      return
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
        title: form.title || null,
        specializations: form.specializations || null,
      }
      const url = editTarget ? `${API}/trainers/${editTarget.id}` : `${API}/trainers`
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
      await fetchTrainers()
      setShowModal(false)
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
      const url = new URL(`${API}/trainers/${deleteTarget.id}`)
      if (deleteReason) url.searchParams.set('reason', deleteReason)
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 204) {
        // Direct delete (privileged)
        await fetchTrainers()
        setDeleteTarget(null)
        setDeleteReason('')
      } else if (res.status === 202) {
        // Removal request submitted
        setDeleteTarget(null)
        setDeleteReason('')
        setRemovalRequestSent(true)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.detail || 'Failed to remove trainer.')
      }
    } catch {
      alert('Unable to reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Staff</h2>
          <p className="text-sm text-gray-500">Manage coaches and trainers</p>
        </div>
        {tab === 'trainers' ? (
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
            style={{ padding: '0.6rem 1.25rem' }}>
            + Add Trainer
          </button>
        ) : (
          <button onClick={() => { setShowCoachModal(true); setCoachModalError('') }}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
            style={{ padding: '0.6rem 1.25rem' }}>
            + Add Coach
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        {(['trainers', 'coaches'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs font-medium rounded-xl capitalize transition ${
              tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
            style={{ padding: '0.4rem 0.875rem' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── COACHES TAB ── */}
      {tab === 'coaches' && (
        <div>
          {coachError && <ErrorState variant="network" message={coachError} onRetry={fetchCoaches} />}
          {coachLoading ? (
            <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={52} rounded="rounded-xl" />)}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {coaches.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 flex items-center justify-between" style={{ padding: '1rem 1.5rem' }}>
                  <div>
                    {(c.first_name || c.last_name) && (
                      <p className="text-sm font-semibold text-gray-900">{c.first_name} {c.last_name}</p>
                    )}
                    <p className="text-sm text-gray-500">{c.email}</p>
                    <p className="text-xs text-gray-400">Coach · Added {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.email === currentUserEmail && (
                      <button onClick={() => { setEditNameTarget(c); setNameForm({ first_name: c.first_name ?? '', last_name: c.last_name ?? '' }) }}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        style={{ padding: '0.3rem 0.75rem' }}>
                        Edit Name
                      </button>
                    )}
                    <button onClick={() => setDeleteCoachTarget(c)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                      style={{ padding: '0.3rem 0.75rem' }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {coaches.length === 0 && <p className="text-gray-400 text-sm text-center" style={{ padding: '3rem' }}>No coaches yet.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── TRAINERS TAB ── */}
      {tab === 'trainers' && <>

      {loadError && <ErrorState variant="network" message={loadError} onRetry={fetchTrainers} />}

      {/* Search */}
      <div style={{ marginBottom: '2rem' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-sm bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
          style={{ padding: '0.6rem 1rem' }} />
      </div>

      {loading ? (
        <CardGridSkeleton cards={6} cols={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm flex flex-col" style={{ padding: '1.5rem' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {t.first_name[0]}{t.last_name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{t.first_name} {t.last_name}</p>
                      {t.title && (
                        <span className={`text-xs font-semibold rounded-lg ${titleColors[t.title] ?? 'bg-gray-100 text-gray-600'}`} style={{ padding: '0.15rem 0.6rem' }}>
                          {t.title}
                        </span>
                      )}
                    </div>
                    {t.display_id != null && (
                      <p className="text-xs text-gray-400 mt-0.5">ID: <span className="font-semibold text-gray-600">{t.display_id}</span></p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(t)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                    style={{ padding: '0.3rem 0.75rem' }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleteTarget(t)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                    style={{ padding: '0.3rem 0.75rem' }}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-4">✉</span>
                  <span className="text-sm text-gray-600 break-all">{t.email}</span>
                </div>
                {t.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-4">📞</span>
                    <span className="text-sm text-gray-600">{t.phone}</span>
                  </div>
                )}
                {t.specializations && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Specializations</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{t.specializations}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && !loadError && (
            <div className="col-span-3 text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
              {trainers.length === 0 ? 'No trainers yet.' : 'No trainers match your search.'}
            </div>
          )}
        </div>
      )}
      </> /* end trainers tab */}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-6">{editTarget ? 'Edit Trainer' : 'Add New Trainer'}</h3>

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

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }}>
                  {TITLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Specializations</label>
                <textarea value={form.specializations} onChange={e => setForm({ ...form, specializations: e.target.value })}
                  placeholder="e.g. Strength & Conditioning, Sports Nutrition, Recovery..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  style={{ padding: '0.6rem 0.875rem' }} />
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
                {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Add Trainer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Trainer</h3>
            <p className="text-sm text-gray-500 mb-4">
              Request removal of <span className="font-semibold text-gray-900">{deleteTarget.first_name} {deleteTarget.last_name}</span>. The head coach will be notified to approve.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
              <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={2}
                placeholder="Why should this trainer be removed?"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                style={{ padding: '0.6rem 0.875rem' }} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteReason('') }} disabled={deleting}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {deleting ? 'Submitting...' : 'Request Removal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Removal Request Sent */}
      {removalRequestSent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm text-center" style={{ padding: '2rem' }}>
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mb-4 text-yellow-600 text-lg mx-auto">⏳</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Request Submitted</h3>
            <p className="text-sm text-gray-500 mb-6">Your removal request has been sent to the head coach for approval.</p>
            <button onClick={() => setRemovalRequestSent(false)}
              className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition"
              style={{ padding: '0.6rem 1.5rem' }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Add Coach Modal */}
      {showCoachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-6">Add Coach</h3>
            {coachModalError && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>{coachModalError}</div>
            )}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                  <input value={coachForm.first_name} onChange={e => setCoachForm({ ...coachForm, first_name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                  <input value={coachForm.last_name} onChange={e => setCoachForm({ ...coachForm, last_name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input value={coachForm.email} onChange={e => setCoachForm({ ...coachForm, email: e.target.value })} type="email"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: '1.75rem' }}>
              <button onClick={() => setShowCoachModal(false)} disabled={savingCoach}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={handleSaveCoach} disabled={savingCoach}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {savingCoach ? 'Creating...' : 'Add Coach'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Coach Confirmation */}
      {deleteCoachTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Coach</h3>
            <p className="text-sm text-gray-500 mb-6">
              Remove <span className="font-semibold text-gray-900">{deleteCoachTarget.email}</span>? They will lose admin access immediately.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteCoachTarget(null)} disabled={deletingCoach}
                className="text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={confirmDeleteCoach} disabled={deletingCoach}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {deletingCoach ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Coach Credentials Modal */}
      {newCoachCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-4 text-green-600 text-lg">✓</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Coach Added</h3>
            <p className="text-sm text-gray-500 mb-5">
              Share these credentials with <span className="font-semibold text-gray-800">{newCoachCreds.name}</span>.
            </p>
            <div className="bg-gray-50 rounded-xl flex flex-col gap-3" style={{ padding: '1rem' }}>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm font-mono text-gray-800">{newCoachCreds.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Temporary Password</p>
                <p className="text-sm font-mono font-semibold text-gray-900 tracking-wider">{newCoachCreds.password}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 mb-5">This password will not be shown again.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => navigator.clipboard.writeText(`Email: ${newCoachCreds.email}\nPassword: ${newCoachCreds.password}`)}
                className="text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}>
                Copy
              </button>
              <button onClick={() => setNewCoachCreds(null)}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Display Name Modal */}
      {editNameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Edit Display Name</h3>
            <p className="text-xs text-gray-400 mb-4">This name appears in the trainer dropdown and top bar.</p>
            <div className="flex flex-col gap-3">
              <input placeholder="First name" value={nameForm.first_name}
                onChange={e => setNameForm(f => ({ ...f, first_name: e.target.value }))}
                className="border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                style={{ padding: '0.65rem 1rem' }} />
              <input placeholder="Last name" value={nameForm.last_name}
                onChange={e => setNameForm(f => ({ ...f, last_name: e.target.value }))}
                className="border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                style={{ padding: '0.65rem 1rem' }} />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditNameTarget(null)} className="flex-1 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition" style={{ padding: '0.6rem' }}>Cancel</button>
              <button onClick={handleSaveName} disabled={nameSaving} className="flex-1 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50" style={{ padding: '0.6rem' }}>
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
