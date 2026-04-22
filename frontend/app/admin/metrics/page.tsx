'use client'

import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import { TableSkeleton } from '@/components/Skeleton'
import ErrorState from '@/components/ErrorState'

type Member = {
  id: string
  display_id: number
  first_name: string
  last_name: string
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

type MetricForm = {
  member_id: string
  recorded_at: string
  fly_10yd: string
  game_speed: string
  vertical: string
  broad_jump: string
  overall_progress: string
}

const emptyForm: MetricForm = {
  member_id: '', recorded_at: '', fly_10yd: '', game_speed: '',
  vertical: '', broad_jump: '', overall_progress: '',
}

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

function memberLabel(members: Member[], id: string) {
  const m = members.find(m => m.id === id)
  return m ? `#${m.display_id} ${m.first_name} ${m.last_name}` : id
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminMetricsPage() {
  const [entries, setEntries] = useState<MetricEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedMember, setSelectedMember] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<MetricEntry | null>(null)
  const [form, setForm] = useState<MetricForm>(emptyForm)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MetricEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setLoadError('')
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [mRes, eRes] = await Promise.all([
        fetch(`${API}/members/`, { headers }),
        fetch(`${API}/metrics/`, { headers }),
      ])
      if (!mRes.ok || !eRes.ok) throw new Error()
      setMembers(await mRes.json())
      setEntries(await eRes.json())
    } catch {
      setLoadError('Failed to load data. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = selectedMember === 'all'
    ? entries
    : entries.filter(e => e.member_id === selectedMember)

  const sorted = [...filtered].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...emptyForm, member_id: selectedMember !== 'all' ? selectedMember : (members[0]?.id ?? '') })
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (e: MetricEntry) => {
    setEditTarget(e)
    setForm({
      member_id: e.member_id,
      recorded_at: e.recorded_at,
      fly_10yd: e.fly_10yd != null ? String(e.fly_10yd) : '',
      game_speed: e.game_speed != null ? String(e.game_speed) : '',
      vertical: e.vertical != null ? String(e.vertical) : '',
      broad_jump: e.broad_jump != null ? String(e.broad_jump) : '',
      overall_progress: e.overall_progress != null ? String(e.overall_progress) : '',
    })
    setModalError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.member_id || !form.recorded_at) {
      setModalError('Member and date are required.')
      return
    }
    setSaving(true)
    setModalError('')
    try {
      const token = await getToken()
      const body = {
        member_id: form.member_id,
        recorded_at: form.recorded_at,
        fly_10yd: form.fly_10yd ? Number(form.fly_10yd) : null,
        game_speed: form.game_speed ? Number(form.game_speed) : null,
        vertical: form.vertical ? Number(form.vertical) : null,
        broad_jump: form.broad_jump ? Number(form.broad_jump) : null,
      }
      const url = editTarget ? `${API}/metrics/${editTarget.id}` : `${API}/metrics`
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
      await fetchAll()
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
      const res = await fetch(`${API}/metrics/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204) { alert('Failed to delete entry. Please try again.'); return }
      await fetchAll()
      setDeleteTarget(null)
    } catch {
      alert('Unable to reach the server.')
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
  const inputStyle = { padding: '0.6rem 0.875rem' }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Athlete Metrics</h2>
          <p className="text-sm text-gray-500">{entries.length} total entries</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
          style={{ padding: '0.6rem 1.25rem' }}>
          + Add Entry
        </button>
      </div>

      {loadError && <ErrorState variant="network" message={loadError} onRetry={fetchAll} />}

      {/* Member filter */}
      <div className="mb-4">
        <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:ring-2 focus:ring-gray-300"
          style={{ padding: '0.6rem 1rem' }}>
          <option value="all">All Members</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>#{m.display_id} {m.first_name} {m.last_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1.5rem' }}>Member</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Date</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>10YD Fly</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Game Speed</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Vertical</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Broad Jump</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Overall</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr key={e.id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${i === sorted.length - 1 ? 'border-b-0' : ''}`}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span className="font-medium text-gray-900">{memberLabel(members, e.member_id)}</span>
                  </td>
                  <td className="text-gray-600" style={{ padding: '1rem' }}>{formatDate(e.recorded_at)}</td>
                  <td className="text-gray-700 font-medium" style={{ padding: '1rem' }}>{e.fly_10yd != null ? `${e.fly_10yd}s` : '—'}</td>
                  <td className="text-gray-700 font-medium" style={{ padding: '1rem' }}>{e.game_speed != null ? `${e.game_speed} mph` : '—'}</td>
                  <td className="text-gray-700 font-medium" style={{ padding: '1rem' }}>{e.vertical != null ? `${e.vertical}"` : '—'}</td>
                  <td className="text-gray-700 font-medium" style={{ padding: '1rem' }}>{e.broad_jump != null ? `${e.broad_jump}"` : '—'}</td>
                  <td style={{ padding: '1rem' }}>
                    {e.overall_progress != null ? (
                      <span className="inline-block bg-gray-900 text-white text-xs font-semibold rounded-lg" style={{ padding: '0.2rem 0.6rem' }}>
                        {e.overall_progress}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(e)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        style={{ padding: '0.3rem 0.75rem' }}>
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(e)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        style={{ padding: '0.3rem 0.75rem' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>No entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              {editTarget ? 'Edit Metric Entry' : 'Add Metric Entry'}
            </h3>

            {modalError && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {modalError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Member</label>
                <select value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}
                  className={inputCls} style={inputStyle}>
                  <option value="">— Select member —</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>#{m.display_id} {m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input value={form.recorded_at} onChange={e => setForm({ ...form, recorded_at: e.target.value })}
                  type="date" className={inputCls} style={inputStyle} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">10YD Fly (seconds)</label>
                  <input value={form.fly_10yd} onChange={e => setForm({ ...form, fly_10yd: e.target.value })}
                    type="number" step="0.01" placeholder="1.42" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Game Speed (mph)</label>
                  <input value={form.game_speed} onChange={e => setForm({ ...form, game_speed: e.target.value })}
                    type="number" step="0.1" placeholder="17.5" className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Vertical (inches)</label>
                  <input value={form.vertical} onChange={e => setForm({ ...form, vertical: e.target.value })}
                    type="number" step="0.5" placeholder="30" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Broad Jump (inches)</label>
                  <input value={form.broad_jump} onChange={e => setForm({ ...form, broad_jump: e.target.value })}
                    type="number" step="0.5" placeholder="108" className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl text-xs text-gray-400 text-center" style={{ padding: '0.75rem' }}>
                Overall progress is calculated automatically from the metrics above.
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
                {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Entry</h3>
            <p className="text-sm text-gray-500 mb-6">
              Delete the entry for <span className="font-semibold text-gray-900">{memberLabel(members, deleteTarget.member_id)}</span> on{' '}
              <span className="font-semibold text-gray-900">{formatDate(deleteTarget.recorded_at)}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
