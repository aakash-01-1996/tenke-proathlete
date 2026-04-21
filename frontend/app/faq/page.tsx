'use client'

import { useState } from 'react'

const faqs = [
  { q: 'Who is this for?', a: 'Athletes of all levels who are serious about improving — from high school players chasing a college offer to adults training for competitive sport. If you want to measure and grow, this is for you.' },
  { q: 'What age groups do you work with?', a: 'We work with athletes from 14 and up. For athletes under 18, a parent or guardian is asked to be present for the first session.' },
  { q: 'How does a session work?', a: 'Each session is structured around your current goals and metrics. Your coach will test, train, and log your performance so you can track progress over time. Sessions typically run 60–90 minutes.' },
  { q: 'How often should I train?', a: 'Most athletes see the best results training 2–4 times per week. Your coach will recommend a schedule based on your sport, goals, and recovery.' },
  { q: 'What metrics are tracked?', a: '10YD Fly, Game Speed, Vertical Jump, Broad Jump, and Overall Progress. Together these give a complete picture of your athleticism and development over time.' },
  { q: 'Can I see my progress online?', a: "Yes. Once you're a member, you'll have access to your personal Athlete dashboard where all your metrics and trends are displayed." },
  { q: 'What if I need to change my training days?', a: 'You can submit a day change request directly from your Athlete page. Your coach or trainer will review and approve or adjust as needed.' },
  { q: 'How do I get started?', a: 'Just hit "Book a Session" — fill out the quick form and your coach will reach out to confirm your first session.' },
]

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="w-full min-h-full bg-gray-100 flex items-center justify-center" style={{ padding: '2rem' }}>
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Left — dark panel */}
          <div className="bg-gray-800 flex flex-col justify-center rounded-l-3xl" style={{ padding: '5rem 4.5rem' }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">FAQ</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Common<br />Questions.
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed mb-8">
              Everything you want to know before getting started. Can't find your answer? Reach out — we're happy to talk.
            </p>

            <div className="flex flex-col gap-4">
              {[
                { icon: '🏅', title: 'No Commitment Required', body: 'Start with a single session and see the value before committing.' },
                { icon: '📍', title: 'Transparent Process', body: 'No hidden fees, no surprises. You know exactly what to expect.' },
                { icon: '🤝', title: 'Athlete First', body: 'Every decision is driven by what\'s best for your development.' },
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

          {/* Right — accordion */}
          <div className="flex flex-col justify-center" style={{ padding: '5rem 4.5rem' }}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Got questions?</h2>
            <p className="text-xs text-gray-400 mb-6">We've got answers.</p>

            <div className="flex flex-col gap-2">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-900 hover:bg-gray-100 transition"
                    style={{ padding: '0.875rem 1rem' }}
                  >
                    {faq.q}
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`flex-shrink-0 text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {open === i && (
                    <div className="text-xs text-gray-500 leading-relaxed border-t border-gray-200" style={{ padding: '0.75rem 1rem' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 pt-10 border-t border-gray-100 flex flex-col items-center text-center">
              <p className="text-xs text-gray-400 mb-3">Still have questions?</p>
              <a
                href="/contact"
                className="inline-flex items-center bg-gray-800 text-white text-xs font-medium rounded-xl hover:bg-gray-700 transition"
                style={{ padding: '0.55rem 1.25rem' }}
              >
                Contact Us
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
