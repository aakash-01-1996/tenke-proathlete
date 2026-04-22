'use client'

import { useState, useRef, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import PreviewPanel from '@/components/PreviewPanel'
import ErrorState from '@/components/ErrorState'

type Event = {
  id: string
  slug: string
  title: string
  description: string
  start_date: string
  end_date: string
  dates: string
  who_is_it_for: string
  whats_included: string
  location: string
  cover_image_url: string
}

type EventForm = {
  slug: string
  title: string
  description: string
  startDate: string
  endDate: string
  dates: string
  whoIsItFor: string
  whatsIncluded: string
  location: string
  coverImageUrl: string
}

const emptyForm: EventForm = {
  slug: '',
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  dates: '',
  whoIsItFor: '',
  whatsIncluded: '',
  location: '',
  coverImageUrl: '',
}

function formatDateDisplay(iso: string) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildDatesDisplay(start: string, end: string) {
  if (!start && !end) return ''
  if (start && !end) return formatDateDisplay(start)
  if (!start && end) return formatDateDisplay(end)
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${formatDateDisplay(end)}`
  }
  return `${formatDateDisplay(start)} – ${formatDateDisplay(end)}`
}

function isExpired(endDate: string) {
  if (!endDate) return false
  return new Date(endDate + 'T23:59:59') < new Date()
}

function eventToForm(e: Event): EventForm {
  return {
    slug: e.slug,
    title: e.title,
    description: e.description || '',
    startDate: e.start_date || '',
    endDate: e.end_date || '',
    dates: e.dates || '',
    whoIsItFor: e.who_is_it_for || '',
    whatsIncluded: e.whats_included || '',
    location: e.location || '',
    coverImageUrl: e.cover_image_url || '',
  }
}

async function getToken() {
  const auth = getAuth(app)
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Event | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null)
  const [previewMode, setPreviewMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [modalError, setModalError] = useState('')
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`${API}/events/`)
      if (!res.ok) throw new Error('Failed to load events')
      setEvents(await res.json())
    } catch {
      setLoadError('Failed to load events. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    setModalError('')

    // Show local preview immediately
    setCoverPreview(URL.createObjectURL(file))

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', uploadPreset!)
      formData.append('folder', 'events')

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      setForm(prev => ({ ...prev, coverImageUrl: data.secure_url }))
      setCoverPreview(data.secure_url)
    } catch {
      setModalError('Failed to upload image. Please try again.')
      setCoverPreview(null)
      setForm(prev => ({ ...prev, coverImageUrl: '' }))
    } finally {
      setUploadingCover(false)
    }
  }

  const updateDates = (start: string, end: string) => {
    setForm(prev => ({ ...prev, startDate: start, endDate: end, dates: buildDatesDisplay(start, end) }))
  }

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setCoverPreview(null)
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (e: Event) => {
    setEditTarget(e)
    setForm(eventToForm(e))
    setCoverPreview(e.cover_image_url || null)
    setModalError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title || !form.slug || !form.endDate) {
      setModalError('Title, slug, and end date are required.')
      return
    }
    setSaving(true)
    setModalError('')
    try {
      const token = await getToken()
      const body = {
        slug: form.slug,
        title: form.title,
        description: form.description || null,
        start_date: form.startDate || null,
        end_date: form.endDate,
        dates: form.dates || null,
        who_is_it_for: form.whoIsItFor || null,
        whats_included: form.whatsIncluded || null,
        location: form.location || null,
        cover_image_url: form.coverImageUrl || null,
      }

      let res: Response
      if (editTarget) {
        res = await fetch(`${API}/events/${editTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`${API}/events/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data?.detail
        if (Array.isArray(msg)) {
          setModalError(msg.map((e: any) => e.msg).join(', '))
        } else {
          setModalError(msg || 'Something went wrong. Please try again.')
        }
        return
      }

      await fetchEvents()
      setShowModal(false)
    } catch {
      setModalError('Unable to reach the server. Please check your connection.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/events/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204) {
        alert('Failed to remove event. Please try again.')
        return
      }
      await fetchEvents()
      setDeleteTarget(null)
    } catch {
      alert('Unable to reach the server. Please check your connection.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Events & Offers</h2>
          <p className="text-sm text-gray-500">{events.length} {events.length === 1 ? 'event' : 'events'} — active ones show on the homepage</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
          style={{ padding: '0.6rem 1.25rem' }}
        >
          + Add Event
        </button>
      </div>

      {loadError && <ErrorState variant="network" message={loadError} onRetry={fetchEvents} />}

      {loading ? (
        <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>Loading events...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-2xl shadow-sm" style={{ padding: '1.5rem' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 text-base">{event.title}</h3>
                  {isExpired(event.end_date) ? (
                    <span className="text-xs font-medium bg-red-50 text-red-500 rounded-lg" style={{ padding: '0.15rem 0.5rem' }}>Expired</span>
                  ) : (
                    <span className="text-xs font-medium bg-green-50 text-green-600 rounded-lg" style={{ padding: '0.15rem 0.5rem' }}>Active</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setPreviewEvent(event); setPreviewMode('desktop') }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    style={{ padding: '0.3rem 0.75rem' }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => openEdit(event)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                    style={{ padding: '0.3rem 0.75rem' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(event)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                    style={{ padding: '0.3rem 0.75rem' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-1">Slug: <span className="font-mono text-gray-500">/events/{event.slug}</span></p>
              {event.end_date && (
                <p className="text-xs text-gray-400 mb-3">Ends: {event.end_date}</p>
              )}
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{event.description}</p>
              <div className="grid grid-cols-2 gap-3">
                {event.dates && (
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Dates</p>
                    <p className="text-sm text-gray-700">{event.dates}</p>
                  </div>
                )}
                {event.who_is_it_for && (
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Who is it for</p>
                    <p className="text-sm text-gray-700">{event.who_is_it_for}</p>
                  </div>
                )}
                {event.whats_included && (
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">What's included</p>
                    <p className="text-sm text-gray-700">{event.whats_included}</p>
                  </div>
                )}
                {event.location && (
                  <div className="bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm text-gray-700">{event.location}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {events.length === 0 && !loadError && (
            <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
              No events yet. Add one to show it on the homepage.
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto" style={{ padding: '2rem', maxHeight: '90vh' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-6">{editTarget ? 'Edit Event' : 'Add New Event'}</h3>

            {modalError && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                {modalError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Summer Camp 2026"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Slug <span className="font-normal text-gray-300">(URL path, e.g. summer-camp-2026)</span></label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="summer-camp-2026"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
                {form.slug && <p className="text-xs text-gray-400 mt-1">Page will be at: /events/{form.slug}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description shown on the homepage..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                  <input value={form.startDate} onChange={e => updateDates(e.target.value, form.endDate)}
                    type="date"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Date <span className="text-red-400">*</span></label>
                  <input value={form.endDate} onChange={e => updateDates(form.startDate, e.target.value)}
                    type="date"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.6rem 0.875rem' }} />
                </div>
              </div>

              {form.dates && (
                <p className="text-xs text-gray-400 -mt-2">Display: <span className="text-gray-600 font-medium">{form.dates}</span></p>
              )}

              {/* Cover Photo */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Cover Photo</label>
                <div
                  onClick={() => !uploadingCover && coverInputRef.current?.click()}
                  className={`relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 transition flex items-center justify-center ${uploadingCover ? 'cursor-wait' : 'cursor-pointer hover:bg-gray-100'}`}
                  style={{ height: '140px' }}
                >
                  {uploadingCover ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span className="text-xs">Uploading...</span>
                    </div>
                  ) : coverPreview ? (
                    <>
                      <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-white text-xs font-medium bg-black/50 rounded-xl" style={{ padding: '0.3rem 0.75rem' }}>Change Photo</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">Click to upload cover photo</span>
                    </div>
                  )}
                  <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Who is it for?</label>
                <input value={form.whoIsItFor} onChange={e => setForm({ ...form, whoIsItFor: e.target.value })}
                  placeholder="e.g. Ages 8–16. All skill levels welcome."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">What's included?</label>
                <input value={form.whatsIncluded} onChange={e => setForm({ ...form, whatsIncluded: e.target.value })}
                  placeholder="e.g. Daily drills, strength training, nutrition workshops..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. TBD or specific address"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ padding: '0.6rem 0.875rem' }} />
              </div>
            </div>

            <div className="flex justify-end gap-3" style={{ marginTop: '1.75rem' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingCover}
                className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                {saving ? 'Saving...' : uploadingCover ? 'Uploading image...' : editTarget ? 'Save Changes' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Event</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove <span className="font-semibold text-gray-900">{deleteTarget.title}</span>? It will no longer appear on the homepage.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Panel */}
      {previewEvent && (
        <PreviewPanel
          url={`/events/${previewEvent.slug}`}
          title={previewEvent.title}
          viewMode={previewMode}
          onViewModeChange={setPreviewMode}
          onClose={() => setPreviewEvent(null)}
        />
      )}
    </div>
  )
}
