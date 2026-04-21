import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOptimizedUrl } from '@/lib/cloudinary'

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

async function getEvent(slug: string): Promise<EventOut | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/events/${slug}`,
      { next: { revalidate: 60 } }
    )
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  } catch {
    return null
  }
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const event = await getEvent(params.slug)

  if (!event) {
    notFound()
  }

  return (
    <div className="w-full min-h-screen bg-gray-100" style={{ padding: '2rem' }}>
      <div className="max-w-3xl mx-auto">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-6 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        {/* Cover Image */}
        {event.cover_image_url && (
          <div className="w-full rounded-2xl overflow-hidden mb-6" style={{ height: '280px' }}>
            <img src={getOptimizedUrl(event.cover_image_url, { width: 1200 })} alt={event.title} loading="lazy" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm" style={{ padding: '2.5rem' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Upcoming Event</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>

          {event.description && (
            <p className="text-base text-gray-600 leading-relaxed mb-8">{event.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {event.dates && (
              <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem 1.25rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Dates</p>
                <p className="text-sm font-medium text-gray-800">{event.dates}</p>
              </div>
            )}
            {event.location && (
              <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem 1.25rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Location</p>
                <p className="text-sm font-medium text-gray-800">{event.location}</p>
              </div>
            )}
            {event.who_is_it_for && (
              <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem 1.25rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Who is it for</p>
                <p className="text-sm font-medium text-gray-800">{event.who_is_it_for}</p>
              </div>
            )}
            {event.whats_included && (
              <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem 1.25rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">What's included</p>
                <p className="text-sm font-medium text-gray-800">{event.whats_included}</p>
              </div>
            )}
          </div>

          <Link
            href="/book"
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            📅 Book a Session
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
