export default function AboutPage() {
  const metrics = [
    { label: '10YD Fly', desc: 'Measure raw acceleration — the burst that separates good from elite.' },
    { label: 'Game Speed', desc: 'Track top-end velocity in real game conditions, not just a straight line.' },
    { label: 'Vertical Jump', desc: 'Quantify explosiveness. Watch the number grow as your training takes hold.' },
    { label: 'Broad Jump', desc: 'Power output, lower-body strength, and athleticism — all in one metric.' },
    { label: 'Overall Progress', desc: 'A holistic score that reflects your improvement across every dimension.' },
  ]

  return (
    <div className="w-full min-h-full bg-gray-100 flex items-center justify-center" style={{ padding: '3rem' }}>
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Left — dark panel */}
          <div className="bg-gray-800 flex flex-col justify-center rounded-l-3xl" style={{ padding: '5rem 4.5rem' }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">About</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Train Smarter.<br />Rise Higher.
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed mb-8">
              Most athletes work hard. The ones who make it work with data.
              TENKE gives every serious athlete the kind of insight that used
              to be reserved for professional franchises.
            </p>

            <div className="flex flex-col gap-4">
              {[
                { icon: '📊', title: 'Data-Driven Coaching', body: 'Every session is logged and trended so progress is always visible.' },
                { icon: '🎯', title: 'Personalized Plans', body: 'Built around your sport, your goals, and your schedule.' },
                { icon: '⚡', title: 'Elite Standards', body: 'Pro methodologies made accessible for every level.' },
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

          {/* Right */}
          <div className="flex flex-col justify-center" style={{ padding: '5rem 4.5rem' }}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">What We Track</h2>
            <p className="text-xs text-gray-400 mb-6">Five metrics. One complete picture of your athleticism.</p>

            <div className="flex flex-col gap-3 mb-8">
              {metrics.map(({ label, desc }) => (
                <div key={label} className="bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3" style={{ padding: '1rem 1.25rem' }}>
                  <div className="w-2 h-2 rounded-full bg-gray-800 flex-shrink-0" style={{ marginTop: '0.35rem' }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">{label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-10 mt-10 flex flex-col items-center text-center">
              <p className="text-sm font-bold text-gray-900 mb-1">Ready to start tracking?</p>
              <p className="text-xs text-gray-400 mb-4">Book a session and let's build your baseline together.</p>
              <a
                href="/book"
                className="inline-flex items-center bg-gray-800 text-white text-xs font-medium rounded-xl hover:bg-gray-700 transition"
                style={{ padding: '0.55rem 1.25rem' }}
              >
                📅 Book a Session
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
