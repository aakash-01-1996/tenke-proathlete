'use client'

import { useState, useEffect, useRef } from 'react'
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
import { use } from 'react'
import { MetricsSkeleton } from '@/components/Skeleton'

type Member = {
  id: string
  display_id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  age: number | null
  weight: string | null
  height: string | null
  package: string | null
  sessions_total: number | null
  sessions_left: number | null
  training_days: string[] | null
}

type MetricEntry = {
  id: string
  member_id: string
  recorded_at: string
  fly_10yd: number | null
  game_speed: number | null
  vertical: number | null
  broad_jump: number | null
  overall_progress: number | null
}

async function getToken() {
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

function trend(curr: number | null, prev: number | null, lowerIsBetter = false): 'up' | 'down' | 'neutral' {
  if (curr == null || prev == null) return 'neutral'
  if (curr === prev) return 'neutral'
  return (lowerIsBetter ? curr < prev : curr > prev) ? 'up' : 'down'
}

function changeStr(curr: number | null, prev: number | null, unit: string, lowerIsBetter = false) {
  if (curr == null) return '—'
  if (prev == null) return 'First entry'
  const diff = curr - prev
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(diff % 1 === 0 ? 0 : 2)}${unit}`
}

function TrendArrow({ dir, lowerIsBetter }: { dir: 'up' | 'down' | 'neutral'; lowerIsBetter?: boolean }) {
  if (dir === 'neutral') return <span className="text-gray-300">—</span>
  const good = lowerIsBetter ? dir === 'down' : dir === 'up'
  return <span className={good ? 'text-green-500' : 'text-red-400'}>{dir === 'up' ? '↑' : '↓'}</span>
}

const METRIC_FIELDS = [
  { key: 'fly_10yd',         label: '10yd Fly',       unit: 's',   lowerIsBetter: true },
  { key: 'game_speed',       label: 'Game Speed',     unit: 'mph', lowerIsBetter: false },
  { key: 'vertical',         label: 'Vertical',       unit: '"',   lowerIsBetter: false },
  { key: 'broad_jump',       label: 'Broad Jump',     unit: '"',   lowerIsBetter: false },
  { key: 'overall_progress', label: 'Overall',        unit: '%',   lowerIsBetter: false },
]

const allDays = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']

export default function MemberPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const API = process.env.NEXT_PUBLIC_API_URL

  const [member, setMember] = useState<Member | null>(null)
  const [metrics, setMetrics] = useState<MetricEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const headers = { Authorization: `Bearer ${token}` }
        const [mRes, metricsRes] = await Promise.all([
          fetch(`${API}/members/${id}`, { headers }),
          fetch(`${API}/metrics/member/${id}`, { headers }),
        ])
        if (!mRes.ok) throw new Error('Member not found')
        setMember(await mRes.json())
        setMetrics(metricsRes.ok ? await metricsRes.json() : [])
      } catch {
        setError('Failed to load member preview.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-gray-50" style={{ padding: '2rem 6rem' }}>
      <MetricsSkeleton />
    </div>
  )

  if (error || !member) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-400 text-sm">{error || 'Member not found.'}</p>
    </div>
  )

  const sorted = [...metrics].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
  const latest = sorted[sorted.length - 1] ?? null
  const prev   = sorted[sorted.length - 2] ?? null
  const progressPoints = sorted.filter(m => m.overall_progress != null)

  // SVG graph
  const graphW = 340
  const graphH = 80
  const svgPoints = progressPoints.length > 1
    ? progressPoints.map((m, i) => {
        const x = (i / (progressPoints.length - 1)) * graphW
        const y = graphH - ((m.overall_progress! / 100) * graphH)
        return `${x},${y}`
      }).join(' ')
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview banner */}
      <div className="bg-yellow-400 text-gray-900 text-xs font-semibold text-center py-2 tracking-wide">
        PREVIEW MODE — This is how {member.first_name} sees their dashboard
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {member.first_name}</p>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-200 mb-5" style={{ padding: '1.5rem' }}>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center text-white text-xl font-bold">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{member.first_name} {member.last_name}</h2>
              <p className="text-sm text-gray-500">Member #{member.display_id}</p>
            </div>
            {member.package && (
              <span className="ml-auto text-xs font-semibold bg-gray-900 text-white rounded-full px-3 py-1">{member.package}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            {member.sessions_total != null && (
              <div className="bg-gray-50 rounded-xl py-3">
                <p className="text-lg font-bold text-gray-900">{member.sessions_total}</p>
                <p className="text-xs text-gray-400">Total Sessions</p>
              </div>
            )}
            {member.sessions_left != null && (
              <div className="bg-gray-50 rounded-xl py-3">
                <p className="text-lg font-bold text-gray-900">{member.sessions_left}</p>
                <p className="text-xs text-gray-400">Sessions Left</p>
              </div>
            )}
            {member.age && (
              <div className="bg-gray-50 rounded-xl py-3">
                <p className="text-lg font-bold text-gray-900">{member.age}</p>
                <p className="text-xs text-gray-400">Age</p>
              </div>
            )}
          </div>

          {member.training_days && member.training_days.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Training Days</p>
              <div className="flex gap-2">
                {allDays.map(d => (
                  <span key={d}
                    className={`text-xs rounded-full flex items-center justify-center font-medium ${
                      member.training_days!.includes(d) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'
                    }`}
                    style={{ width: d === 'Th' ? '2rem' : '1.75rem', height: '1.75rem' }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metric tiles */}
        {latest ? (
          <>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Latest Metrics</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {METRIC_FIELDS.map(({ key, label, unit, lowerIsBetter }) => {
                const val = latest[key as keyof MetricEntry] as number | null
                const prevVal = prev ? prev[key as keyof MetricEntry] as number | null : null
                const dir = trend(val, prevVal, lowerIsBetter)
                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1rem 1.25rem' }}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold text-gray-900">
                        {val != null ? `${val}${unit}` : '—'}
                      </p>
                      <div className="text-right">
                        <TrendArrow dir={dir} lowerIsBetter={lowerIsBetter} />
                        <p className="text-xs text-gray-400">{changeStr(val, prevVal, unit, lowerIsBetter)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Progress graph */}
            {svgPoints && (
              <div className="bg-white rounded-2xl border border-gray-200 mb-5" style={{ padding: '1.25rem 1.5rem' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Overall Progress</p>
                <svg width="100%" height={graphH} viewBox={`0 0 ${graphW} ${graphH}`} preserveAspectRatio="none">
                  <polyline points={svgPoints} fill="none" stroke="#111827" strokeWidth="2" strokeLinejoin="round" />
                  {progressPoints.map((m, i) => {
                    const x = (i / (progressPoints.length - 1)) * graphW
                    const y = graphH - ((m.overall_progress! / 100) * graphH)
                    return <circle key={i} cx={x} cy={y} r="3" fill="#111827" />
                  })}
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>
            No metrics recorded yet.
          </div>
        )}
      </div>
    </div>
  )
}
