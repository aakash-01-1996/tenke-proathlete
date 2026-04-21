'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', concern: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          concern: form.concern,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data?.detail
        if (Array.isArray(msg)) {
          setError(msg.map((e: any) => e.msg).join(', '))
        } else {
          setError(msg || 'Something went wrong. Please check your details and try again.')
        }
        return
      }
      setSubmitted(true)
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full min-h-full bg-gray-100 flex items-center justify-center" style={{ padding: '2rem' }}>
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Left — dark panel */}
          <div className="bg-gray-800 flex flex-col justify-center rounded-l-3xl" style={{ padding: '5rem 4.5rem' }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Contact</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              We're here<br />to help.
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed mb-8">
              Have a question or concern? Send us a message and we'll get back to you shortly.
            </p>

            <div className="flex flex-col gap-4">
              {[
                { icon: '⚡', title: 'Quick Response', body: 'We aim to respond within 24 hours.' },
                { icon: '🔒', title: 'Private & Secure', body: 'Your info is never shared with third parties.' },
                { icon: '💬', title: 'Real Conversations', body: "You're talking to the coaching team — not a bot." },
              ].map(({ icon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-base">{icon}</div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="flex flex-col justify-center" style={{ padding: '5rem 4.5rem' }}>
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center h-full gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Message received</h2>
                  <p className="text-sm text-gray-500">We'll get back to you as soon as possible.</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Send a message</h2>
                <p className="text-xs text-gray-400 mb-6">Fill out the form and we'll be in touch.</p>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">Name</label>
                    <input
                      name="name" type="text" required placeholder="Your full name"
                      value={form.name} onChange={handleChange}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.6rem 0.875rem' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">Email</label>
                      <input
                        name="email" type="email" required placeholder="your@email.com"
                        value={form.email} onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                        style={{ padding: '0.6rem 0.875rem' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">Phone <span className="normal-case font-normal text-gray-300">(opt)</span></label>
                      <input
                        name="phone" type="tel" placeholder="+1 (555) 000-0000"
                        value={form.phone} onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                        style={{ padding: '0.6rem 0.875rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">Issue / Concern</label>
                    <textarea
                      name="concern" required rows={5}
                      placeholder="Describe your issue or question..."
                      value={form.concern} onChange={handleChange}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                      style={{ padding: '0.6rem 0.875rem' }}
                    />
                  </div>

                  <button
                    type="submit" disabled={submitting}
                    className="w-full bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition"
                    style={{ padding: '0.7rem' }}
                  >
                    {submitting ? 'Sending...' : 'Submit'}
                  </button>
                </form>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
