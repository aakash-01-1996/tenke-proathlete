'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { GameplanSkeleton } from '@/components/Skeleton'

const API = process.env.NEXT_PUBLIC_API_URL

type PDF = {
  id: string
  title: string
  category: string
  description: string | null
  file_url: string
  created_at: string
}

const categoryColors: Record<string, string> = {
  'Training':   'bg-blue-100 text-blue-700',
  'Nutrition':  'bg-green-100 text-green-700',
  'Meal Plan':  'bg-teal-100 text-teal-700',
  'Recovery':   'bg-purple-100 text-purple-700',
  'Checklist':  'bg-orange-100 text-orange-700',
}

function PDFCard({ pdf }: { pdf: PDF }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 flex flex-col" style={{ padding: '1.25rem' }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{pdf.title}</p>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${categoryColors[pdf.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {pdf.category}
          </span>
        </div>
      </div>

      {pdf.description && (
        <p className="text-xs text-gray-500 leading-relaxed mb-4 flex-1">{pdf.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-auto">
        <span className="text-xs text-gray-400">
          {new Date(pdf.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <a
          href={pdf.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition"
          style={{ padding: '0.35rem 0.875rem' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>
    </div>
  )
}

export default function GameplanPage() {
  const [pdfs, setPdfs] = useState<PDF[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      const token = await user.getIdToken()
      try {
        const res = await fetch(`${API}/gameplan/`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) setPdfs(await res.json())
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const training = pdfs.filter(p => p.category === 'Training' || p.category === 'Recovery' || p.category === 'Checklist')
  const nutrition = pdfs.filter(p => p.category === 'Nutrition' || p.category === 'Meal Plan')

  if (loading) {
    return (
      <div className="w-full min-h-full bg-gray-100" style={{ padding: '3rem' }}>
        <div className="w-full max-w-7xl mx-auto">
          <GameplanSkeleton />
        </div>
      </div>
    )
  }

  if (pdfs.length === 0) {
    return (
      <div className="w-full min-h-full bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 font-medium">No resources uploaded yet.</p>
          <p className="text-gray-400 text-sm mt-1">Check back soon — your coach will add training and nutrition plans here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-full bg-gray-100 flex items-center justify-center" style={{ padding: '3rem' }}>
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr]">

          {/* Left — Training */}
          <div style={{ padding: '3.5rem 3rem' }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Training</h2>
            {training.length > 0 ? (
              <div className="flex flex-col gap-3">
                {training.map(pdf => <PDFCard key={pdf.id} pdf={pdf} />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No training plans uploaded yet.</p>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block bg-gray-200 my-12" />

          {/* Right — Nutrition */}
          <div style={{ padding: '3.5rem 3rem' }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nutrition</h2>
            {nutrition.length > 0 ? (
              <div className="flex flex-col gap-3">
                {nutrition.map(pdf => <PDFCard key={pdf.id} pdf={pdf} />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No nutrition plans uploaded yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
