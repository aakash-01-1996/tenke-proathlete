'use client'

import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

export default function SummerCampPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    childName: '',
    age: '',
    email: '',
    phone: '',
    hearAboutUs: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const ageNum = parseInt(form.age)
    if (!form.age || isNaN(ageNum) || ageNum < 1) {
      setError('Please enter a valid age (must be a positive number).')
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
          age: parseInt(form.age),
          email: form.email,
          phone: form.phone,
          hear_about_us: form.hearAboutUs || null,
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

  return (
    <div className="w-full min-h-screen bg-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen">

        {/* Left side - Info */}
        <div className="md:col-span-6 bg-gray-800 flex flex-col" style={{ minHeight: '100vh' }}>
          <div className="flex flex-col justify-center flex-1" style={{ padding: '2rem 3rem' }}>
            <h1 className="text-5xl font-bold text-white mb-6">🏕️ Summer Camp 2026</h1>
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              Give your child the ultimate athletic experience this summer. Our elite summer camp is designed to develop young athletes through structured training, nutrition education, and team building.
            </p>

            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📅</div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Dates</h4>
                  <p className="text-gray-400 text-sm">July 7 – July 25, 2026 (3 weeks)</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🏃</div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Who is it for?</h4>
                  <p className="text-gray-400 text-sm">Ages 8–16. All skill levels welcome — beginner to advanced.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">⭐</div>
                <div>
                  <h4 className="text-white font-semibold mb-1">What's included?</h4>
                  <p className="text-gray-400 text-sm">Daily drills, strength training, nutrition workshops, and 1-on-1 coaching sessions.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📍</div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Location</h4>
                  <p className="text-gray-400 text-sm">TBD — details will be shared upon registration confirmation.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block md:col-span-1 bg-gray-100">
          <div className="h-full w-px bg-gray-300 mx-auto"></div>
        </div>

        {/* Right side - Form */}
        <div className="md:col-span-5 flex flex-col justify-center items-center" style={{ padding: '4rem 3rem 4rem 2rem' }}>
          {submitted ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Inquiry Submitted!</h2>
              <p className="text-gray-500">Thank you! The coach will reach out to you shortly.</p>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Inquiry Form</h2>

              {error && (
                <div className="w-full mb-5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input name="firstName" value={form.firstName} onChange={handleChange} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input name="lastName" value={form.lastName} onChange={handleChange} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Child's Name</label>
                    <input name="childName" value={form.childName} onChange={handleChange} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input name="age" value={form.age} onChange={handleChange} required type="number" min="1" step="1"
                      onKeyDown={e => { if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault() }}
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" value={form.email} onChange={handleChange} required type="email"
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.65rem 1rem' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} required type="tel"
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.65rem 1rem' }} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">How did you hear about us?</label>
                  <select name="hearAboutUs" value={form.hearAboutUs} onChange={handleChange} required
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
