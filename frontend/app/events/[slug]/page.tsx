'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOptimizedUrl } from '@/lib/cloudinary'

const API = process.env.NEXT_PUBLIC_API_URL

type EventOut = {
  id: string
  slug: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string
  dates: string | null
  who_is_it_for: string | null
  whats_included: string | null
  location: string | null
  cover_image_url: string | null
}

const emptyForm = {
  firstName: '',
  lastName: '',
  childName: '',
  age: '',
  email: '',
  phone: '',
  hearAboutUs: '',
}

export default function EventPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<EventOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFoundState, setNotFoundState] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/events/${params.slug}`, { cache: 'no-store' })
      .then(res => {
        if (res.status === 404) { setNotFoundState(true); return null }
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => { if (data) setEvent(data) })
      .catch(() => setNotFoundState(true))
      .finally(() => setLoading(false))
  }, [params.slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const ageNum = parseInt(form.age)
    if (!form.age || isNaN(ageNum) || ageNum < 1) {
      setError('Please enter a valid age.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/inquiries/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          child_name: form.childName,
          age: ageNum,
          email: form.email,
          phone: form.phone,
          hear_about_us: form.hearAboutUs || null,
          source: event?.title ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  if (notFoundState || !event) {
    return (
      <div className="w-full min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4">
        <p className="text-2xl font-bold text-gray-900">Event not found</p>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition">← Back to Home</Link>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen">

        {/* Left — Event Details */}
        <div className="md:col-span-6 bg-gray-800 flex flex-col" style={{ minHeight: '100vh' }}>
          <div className="flex flex-col justify-center flex-1" style={{ padding: '2rem 3rem' }}>

            <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-8 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>

            {event.cover_image_url && (
              <div className="w-full rounded-2xl overflow-hidden mb-6" style={{ height: '200px' }}>
                <img
                  src={getOptimizedUrl(event.cover_image_url, { width: 800 })}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Upcoming Event</p>
            <h1 className="text-4xl font-bold text-white mb-4">{event.title}</h1>

            {event.description && (
              <p className="text-gray-300 text-base leading-relaxed mb-8">{event.description}</p>
            )}

            <div className="flex flex-col gap-5">
              {event.dates && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📅</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Dates</h4>
                    <p className="text-gray-400 text-sm">{event.dates}</p>
                  </div>
                </div>
              )}
              {event.who_is_it_for && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🏃</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Who is it for?</h4>
                    <p className="text-gray-400 text-sm">{event.who_is_it_for}</p>
                  </div>
                </div>
              )}
              {event.whats_included && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">⭐</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">What's included?</h4>
                    <p className="text-gray-400 text-sm">{event.whats_included}</p>
                  </div>
                </div>
              )}
              {event.location && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📍</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Location</h4>
                    <p className="text-gray-400 text-sm">{event.location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block md:col-span-1 bg-gray-100">
          <div className="h-full w-px bg-gray-300 mx-auto"></div>
        </div>

        {/* Right — Inquiry Form */}
        <div className="md:col-span-5 flex flex-col justify-center items-center" style={{ padding: '4rem 3rem 4rem 2rem' }}>
          {submitted ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Inquiry Submitted!</h2>
              <p className="text-gray-500">Thank you! The coach will reach out to you shortly.</p>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-8 w-full">Inquiry Form</h2>

              {error && (
                <div className="w-full mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input name="firstName" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input name="lastName" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Child's Name</label>
                    <input name="childName" value={form.childName} onChange={e => setForm({ ...form, childName: e.target.value })} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input name="age" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} required type="number" min="1" step="1"
                      onKeyDown={e => { if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault() }}
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required type="email"
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.65rem 1rem' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required type="tel"
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.65rem 1rem' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">How did you hear about us?</label>
                  <select name="hearAboutUs" value={form.hearAboutUs} onChange={e => setForm({ ...form, hearAboutUs: e.target.value })} required
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.65rem 1rem' }}>
                    <option value="">Select an option</option>
                    <option value="instagram">Instagram</option>
                    <option value="friend">Friend / Family</option>
                    <option value="google">Google</option>
                    <option value="flyer">Flyer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition"
                  style={{ padding: '0.85rem', marginTop: '0.5rem' }}>
                  {submitting ? 'Submitting...' : 'Submit Inquiry'}
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
