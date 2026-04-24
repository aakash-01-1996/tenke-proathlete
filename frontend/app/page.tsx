import Image from 'next/image'
import Link from 'next/link'

type EventOut = {
  id: string
  slug: string
  title: string
  end_date: string
}

async function getActiveEvents(): Promise<EventOut[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/events/?active_only=true`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function Home() {
  const activeEvents = await getActiveEvents()

  return (
    <div className="w-full min-h-screen bg-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-12 items-center min-h-screen">

        {/* Left side - Coach Image */}
        <div className="md:col-span-6 relative h-screen">
          <Image
            src="/images/profileImage.jpg"
            alt="Coach"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-top"
            priority
          />
        </div>

        {/* Divider line */}
        <div className="hidden md:block md:col-span-1 h-[500px] w-px bg-gradient-to-b from-blue-200 to-blue-300 mx-auto"></div>

        {/* Right side - Content */}
        <div className="md:col-span-5 flex flex-col gap-10 justify-start pt-16 pl-16 pr-8">
          <section>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Mission Statement</h2>
            <div className="text-lg text-slate-600 leading-relaxed space-y-3">
              <p>Our mission is to empower professional athletes with cutting-edge data analytics and personalized tracking tools.</p>
              <p>We believe that combining science-driven insights with dedicated coaching creates the pathway to peak performance.</p>
              <p>Every metric, every milestone, and every moment counts in your journey to athletic excellence.</p>
              <p>Together, we transform potential into performance.</p>
            </div>
          </section>

          <div>
            <Link
              href="/book"
              className="inline-flex items-center bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
              style={{ padding: '0.6rem 1.25rem' }}
            >
              📅 Book a Free Session
            </Link>
          </div>

          <section>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">About Coach</h3>
            <div className="text-base text-slate-600 leading-relaxed space-y-3">
              <p>With over a decade of experience in athletic development and performance optimization, your coach brings a wealth of knowledge to your training regimen.</p>
              <p>Specializing in individualized training programs, nutrition planning, and injury prevention, we focus on what matters most—your success.</p>
              <p>Every athlete is unique, and that's why we craft personalized strategies tailored to your specific goals and challenges.</p>
            </div>
          </section>

          {/* Offers / Upcoming Events */}
          <section>
            <h3 className="text-2xl font-bold text-slate-900 mb-5">New Offers & Upcoming Events</h3>
            {activeEvents.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {activeEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="inline-flex items-center gap-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
                    style={{ padding: '0.6rem 1.25rem' }}
                  >
                    {event.title}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/summercamp"
                  className="inline-flex items-center gap-2 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  🏕️ Summer Camp
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </section>

        </div>

      </div>
    </div>
  )
}
