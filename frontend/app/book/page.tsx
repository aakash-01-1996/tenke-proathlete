'use client'

import { useState } from 'react'

export default function BookPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    age: '',
    goal: '',
    goalOther: '',
    experience: '',
    preferredDays: [] as string[],
    message: '',
  })

  const allDays = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(day)
        ? prev.preferredDays.filter(d => d !== day)
        : [...prev.preferredDays, day],
    }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          phone: form.phone || null,
          age: form.age ? Number(form.age) : null,
          experience: form.experience || null,
          goal: form.goal || null,
          goal_other: form.goalOther || null,
          preferred_days: form.preferredDays.length ? form.preferredDays : null,
          message: form.message || null,
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
    <div className="w-full min-h-screen bg-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen">

        {/* Left side - Info */}
        <div className="md:col-span-6 bg-gray-800 flex flex-col justify-center" style={{ padding: '4rem 3rem' }}>
          <h1 className="text-5xl font-bold text-white mb-6">Book a Session</h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            Ready to take your game to the next level? Fill out the form and the coach will reach out to set up your first session.
          </p>

          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🎯</div>
              <div>
                <h4 className="text-white font-semibold mb-1">Personalized Training</h4>
                <p className="text-gray-400 text-sm">Every session is tailored to your goals, fitness level, and schedule.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📊</div>
              <div>
                <h4 className="text-white font-semibold mb-1">Track Your Progress</h4>
                <p className="text-gray-400 text-sm">Get access to the athlete portal where you can see your metrics improve over time.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">⚡</div>
              <div>
                <h4 className="text-white font-semibold mb-1">Elite Coaching</h4>
                <p className="text-gray-400 text-sm">Work directly with Coach Tenke and experienced trainers who push you to perform your best.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">📅</div>
              <div>
                <h4 className="text-white font-semibold mb-1">Flexible Schedule</h4>
                <p className="text-gray-400 text-sm">Sessions available Monday through Sunday — morning and evening slots.</p>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Received!</h2>
              <p className="text-gray-500">The coach will review your info and reach out shortly to confirm your session.</p>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-6 self-start">Your Info</h2>

              {error && (
                <div className="w-full mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl" style={{ padding: '0.75rem 1rem' }}>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input name="age" value={form.age} onChange={handleChange} required type="number" min="1" step="1"
                      onKeyDown={e => { if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault() }}
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                    <select name="experience" value={form.experience} onChange={handleChange} required
                      className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.65rem 1rem' }}>
                      <option value="">Select</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="pro">Professional</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Goal</label>
                  <select name="goal" value={form.goal} onChange={handleChange} required
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ padding: '0.65rem 1rem' }}>
                    <option value="">Select a goal</option>
                    <option value="speed">Improve Speed</option>
                    <option value="strength">Build Strength</option>
                    <option value="agility">Agility & Conditioning</option>
                    <option value="vertical">Increase Vertical</option>
                    <option value="overall">Overall Athletic Performance</option>
                    <option value="other">Other</option>
                  </select>
                  {form.goal === 'other' && (
                    <textarea name="goalOther" value={(form as any).goalOther || ''} onChange={handleChange}
                      placeholder="Tell us what you're working towards..."
                      rows={3}
                      className="w-full mt-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                      style={{ padding: '0.65rem 1rem' }} />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Training Days</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {allDays.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`text-xs rounded-full transition flex items-center justify-center ${
                          form.preferredDays.includes(day)
                            ? 'bg-gray-800 text-white'
                            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                        style={{ width: '2rem', height: '2rem' }}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anything else you'd like us to know?</label>
                  <textarea name="message" value={form.message} onChange={handleChange}
                    placeholder="Injuries, specific goals, questions..."
                    rows={3}
                    className="w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                    style={{ padding: '0.65rem 1rem' }} />
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-50 transition"
                  style={{ padding: '0.85rem', marginTop: '0.5rem' }}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>

              </form>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
