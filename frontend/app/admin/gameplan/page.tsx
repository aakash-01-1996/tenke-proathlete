'use client'

import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { TableSkeleton } from '@/components/Skeleton'

const API = process.env.NEXT_PUBLIC_API_URL
const CATEGORIES = ['Training', 'Nutrition', 'Meal Plan', 'Recovery', 'Checklist']

const categoryColors: Record<string, string> = {
  'Training':   'bg-blue-100 text-blue-700',
  'Nutrition':  'bg-green-100 text-green-700',
  'Meal Plan':  'bg-teal-100 text-teal-700',
  'Recovery':   'bg-purple-100 text-purple-700',
  'Checklist':  'bg-orange-100 text-orange-700',
}

type PDF = {
  id: string
  title: string
  category: string
  description: string | null
  file_url: string
  created_at: string
}

const emptyForm = { title: '', category: CATEGORIES[0], description: '' }

export default function GameplanAdminPage() {
  const [pdfs, setPdfs] = useState<PDF[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PDF | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) setToken(await user.getIdToken())
    })
    return unsub
  }, [])

  const fetchPdfs = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`${API}/gameplan/`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) setPdfs(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchPdfs(token)
  }, [token, fetchPdfs])

  const handleSave = async () => {
    if (!token || !form.title || !selectedFile) return
    setSaving(true)
    setError('')
    try {
      // Upload PDF to Cloudinary as raw file
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('upload_preset', uploadPreset!)
      formData.append('folder', 'gameplan')
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const uploadData = await uploadRes.json()

      // Save to backend
      const res = await fetch(`${API}/gameplan/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          description: form.description || null,
          file_url: uploadData.secure_url,
          cloudinary_public_id: uploadData.public_id,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setShowModal(false)
      setForm(emptyForm)
      setSelectedFile(null)
      setFileName('')
      await fetchPdfs(token)
    } catch {
      setError('Failed to upload PDF. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`${API}/gameplan/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setDeleteTarget(null)
      await fetchPdfs(token)
    } finally {
      setDeleting(false)
    }
  }

  const displayed = filter === 'All' ? pdfs : pdfs.filter(p => p.category === filter)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gameplan</h2>
          <p className="text-sm text-gray-500">{pdfs.length} PDFs uploaded</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
          style={{ padding: '0.6rem 1.25rem' }}
        >
          + Upload PDF
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-xs font-medium rounded-xl transition ${
              filter === cat ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            style={{ padding: '0.4rem 1rem' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1.5rem' }}>Title</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Category</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1rem' }}>Date</th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '0.875rem 1.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((pdf, i) => (
                <tr key={pdf.id} className={`hover:bg-gray-50 transition ${i < displayed.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{pdf.title}</p>
                        {pdf.description && <p className="text-xs text-gray-400 mt-0.5">{pdf.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${categoryColors[pdf.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {pdf.category}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs" style={{ padding: '1rem' }}>{formatDate(pdf.created_at)}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div className="flex items-center gap-2">
                      <a
                        href={pdf.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        style={{ padding: '0.3rem 0.75rem' }}
                      >
                        View
                      </a>
                      <button
                        onClick={() => setDeleteTarget(pdf)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        style={{ padding: '0.3rem 0.75rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
                    No PDFs in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-6">Upload PDF</h3>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {error}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">PDF File</label>
                <label className="flex items-center gap-3 w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition" style={{ padding: '0.75rem 1rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm text-gray-500">{fileName || 'Choose a PDF file...'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setSelectedFile(f); setFileName(f.name) }
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Speed & Agility Training Program"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of what this PDF covers..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>
            </div>

            <div className="flex justify-end gap-3" style={{ marginTop: '1.75rem' }}>
              <button
                onClick={() => { setShowModal(false); setForm(emptyForm); setSelectedFile(null); setFileName(''); setError('') }}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title || !selectedFile || saving}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                {saving ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove PDF</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove <span className="font-semibold text-gray-900">{deleteTarget.title}</span>? It will be deleted from storage and no longer visible to members.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}>
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
