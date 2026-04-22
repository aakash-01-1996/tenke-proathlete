'use client'

import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { SplitPanelSkeleton } from '@/components/Skeleton'

const API = process.env.NEXT_PUBLIC_API_URL

type Inquiry = {
  id: string
  first_name: string
  last_name: string
  child_name: string
  age: number
  email: string
  phone: string
  hear_about_us: string | null
  source: string | null
  read: boolean
  created_at: string
}

const hearAboutUsLabels: Record<string, string> = {
  instagram: 'Instagram',
  friend:    'Friend / Family',
  google:    'Google',
  flyer:     'Flyer',
  other:     'Other',
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) setToken(await user.getIdToken())
    })
    return unsub
  }, [])

  const fetchInquiries = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`${API}/inquiries/`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) setInquiries(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchInquiries(token)
  }, [token, fetchInquiries])

  const handleSelect = async (inquiry: Inquiry) => {
    setSelected(inquiry)
    if (!inquiry.read && token) {
      await fetch(`${API}/inquiries/${inquiry.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, read: true } : i))
    }
  }

  const handleExportCSV = () => {
    if (inquiries.length === 0) return
    const hearLabels: Record<string, string> = {
      instagram: 'Instagram', friend: 'Friend / Family',
      google: 'Google', flyer: 'Flyer', other: 'Other',
    }
    const headers = ['First Name', 'Last Name', 'Child Name', 'Age', 'Email', 'Phone', 'How They Heard', 'Submitted At']
    const rows = inquiries.map(i => [
      i.first_name, i.last_name, i.child_name, i.age,
      i.email, i.phone,
      hearLabels[i.hear_about_us ?? ''] ?? i.hear_about_us ?? '',
      new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `summer-camp-inquiries-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearAll = async () => {
    if (!token) return
    setClearing(true)
    try {
      await fetch(`${API}/inquiries/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setInquiries([])
      setSelected(null)
      setShowClearConfirm(false)
    } finally {
      setClearing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) return
    setDeleting(true)
    try {
      await fetch(`${API}/inquiries/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setInquiries(prev => prev.filter(i => i.id !== id))
      if (selected?.id === id) setSelected(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = inquiries.filter(i =>
    `${i.first_name} ${i.last_name} ${i.child_name} ${i.email}`.toLowerCase().includes(search.toLowerCase())
  )
  const unreadCount = inquiries.filter(i => !i.read).length

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inquiries</h2>
          <p className="text-sm text-gray-500">
            {inquiries.length} total ·{' '}
            {unreadCount > 0
              ? <span className="text-blue-600 font-medium">{unreadCount} unread</span>
              : 'all read'}
          </p>
        </div>
        {inquiries.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition"
              style={{ padding: '0.5rem 1rem' }}
            >
              ↓ Export CSV
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
              style={{ padding: '0.5rem 1rem' }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3" style={{ marginBottom: '1.5rem' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null) }}
          placeholder="Search by name, child, or email..."
          className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
          style={{ padding: '0.6rem 1rem', width: '280px' }}
        />
        {search && (
          <button onClick={() => { setSearch(''); setSelected(null) }} className="text-xs font-medium text-gray-400 hover:text-gray-700 transition">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <SplitPanelSkeleton />
      ) : (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 16rem)' }}>
          {/* Left — list */}
          <div className="w-80 flex-shrink-0 bg-white rounded-2xl shadow-sm overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center" style={{ padding: '3rem' }}>No inquiries found.</p>
            )}
            {filtered.map((inquiry, i) => (
              <button
                key={inquiry.id}
                onClick={() => handleSelect(inquiry)}
                className={`w-full text-left transition ${
                  selected?.id === inquiry.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                } ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
                style={{ padding: '1rem 1.25rem' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {!inquiry.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-gray-900">{inquiry.first_name} {inquiry.last_name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(inquiry.created_at)}</span>
                </div>
                <p className="text-xs text-gray-500">Child: {inquiry.child_name}, Age {inquiry.age}</p>
                <span className="inline-block bg-gray-100 text-gray-500 text-xs rounded-lg" style={{ padding: '0.1rem 0.5rem', marginTop: '0.35rem' }}>
                  {inquiry.source ?? 'Summer Camp 2026'}
                </span>
              </button>
            ))}
          </div>

          {/* Right — detail */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-y-auto">
            {!selected ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Select an inquiry to view details</p>
              </div>
            ) : (
              <div style={{ padding: '2rem' }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selected.first_name} {selected.last_name}</h3>
                    <div className="flex items-center gap-2" style={{ marginTop: '0.35rem' }}>
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium rounded-lg" style={{ padding: '0.15rem 0.6rem' }}>
                        {selected.source ?? 'Summer Camp 2026'}
                      </span>
                      <p className="text-xs text-gray-400">Submitted {formatDate(selected.created_at)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    disabled={deleting}
                    className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                    style={{ padding: '0.3rem 0.75rem' }}
                  >
                    {deleting ? '...' : 'Delete'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Child's Name</p>
                    <p className="text-sm font-medium text-gray-900">{selected.child_name}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Child's Age</p>
                    <p className="text-sm font-medium text-gray-900">{selected.age}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Parent Email</p>
                    <p className="text-sm font-medium text-gray-900">{selected.email}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{selected.phone}</p>
                  </div>
                  {selected.hear_about_us && (
                    <div className="bg-gray-50 rounded-xl col-span-2" style={{ padding: '1rem' }}>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">How they heard about us</p>
                      <p className="text-sm font-medium text-gray-900">{hearAboutUsLabels[selected.hear_about_us] ?? selected.hear_about_us}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear All Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Clear All Inquiries</h3>
            <p className="text-sm text-gray-500 mb-2">
              This will permanently delete all <span className="font-semibold text-gray-900">{inquiries.length} inquiries</span> from the database.
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl mb-6" style={{ padding: '0.65rem 0.875rem' }}>
              Make sure you've exported the CSV before clearing.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                {clearing ? 'Clearing...' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
