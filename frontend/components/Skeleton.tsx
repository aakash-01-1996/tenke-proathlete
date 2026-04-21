import { CSSProperties } from 'react'

// ── Base shimmer block ────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  style?: CSSProperties
  rounded?: string
}

export function Skeleton({ width, height, className = '', style, rounded = 'rounded-lg' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 ${rounded} ${className}`}
      style={{ width, height, ...style }}
    />
  )
}

// ── Table skeleton ─────────────────────────────────────────────────────────
// Used by: admin/members, admin/metrics, admin/gameplan

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 6, cols = 6 }: TableSkeletonProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* header row */}
      <div className="flex gap-4 px-6 py-4 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} className="flex-1" />
        ))}
      </div>
      {/* data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex gap-4 px-6 py-4 ${r < rows - 1 ? 'border-b border-gray-50' : ''}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} className="flex-1" style={{ opacity: 1 - c * 0.05 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Card grid skeleton ─────────────────────────────────────────────────────
// Used by: admin/trainers (grid of cards), gameplan (PDF cards)

interface CardGridSkeletonProps {
  cards?: number
  cols?: number
}

export function CardGridSkeleton({ cards = 6, cols = 3 }: CardGridSkeletonProps) {
  const colClass = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-1'
  return (
    <div className={`grid ${colClass} gap-4`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton width={44} height={44} rounded="rounded-full" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton height={14} width="60%" />
              <Skeleton height={11} width="40%" />
            </div>
          </div>
          <Skeleton height={11} width="80%" />
          <Skeleton height={11} width="55%" />
        </div>
      ))}
    </div>
  )
}

// ── Feed skeleton ──────────────────────────────────────────────────────────
// Used by: community, admin/community, admin/requests

interface FeedSkeletonProps {
  items?: number
  withImage?: boolean
}

export function FeedSkeleton({ items = 4, withImage = false }: FeedSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton width={36} height={36} rounded="rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton height={13} width={120} />
              <Skeleton height={10} width={80} />
            </div>
          </div>
          <Skeleton height={13} width="90%" />
          <Skeleton height={13} width="75%" />
          <Skeleton height={13} width="60%" />
          {withImage && i % 2 === 0 && <Skeleton height={160} rounded="rounded-xl" className="w-full" />}
          <div className="flex gap-3 pt-1">
            <Skeleton height={11} width={60} />
            <Skeleton height={11} width={60} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Split panel skeleton ───────────────────────────────────────────────────
// Used by: admin/inquiries (list + detail)

export function SplitPanelSkeleton() {
  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 16rem)' }}>
      {/* left list */}
      <div className="w-80 flex-shrink-0 bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 pb-3 border-b border-gray-50">
            <div className="flex justify-between">
              <Skeleton height={13} width={130} />
              <Skeleton height={10} width={55} />
            </div>
            <Skeleton height={10} width={100} />
            <Skeleton height={18} width={110} rounded="rounded-lg" />
          </div>
        ))}
      </div>
      {/* right detail */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm p-8 flex flex-col gap-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-2">
            <Skeleton height={20} width={180} />
            <Skeleton height={11} width={120} />
          </div>
          <Skeleton height={30} width={70} rounded="rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
              <Skeleton height={10} width={80} />
              <Skeleton height={14} width={120} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Metrics skeleton ───────────────────────────────────────────────────────
// Used by: /metrics (member view), admin/preview

export function MetricsSkeleton() {
  return (
    <div className="flex gap-6">
      {/* left profile panel */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center gap-3">
          <Skeleton width={72} height={72} rounded="rounded-full" />
          <Skeleton height={16} width={140} />
          <Skeleton height={11} width={100} />
          <div className="w-full flex flex-col gap-2 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton height={11} width={80} />
                <Skeleton height={11} width={90} />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2">
          <Skeleton height={12} width={100} />
          <div className="flex flex-wrap gap-2 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={28} width={36} rounded="rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      {/* right metrics panel */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2">
              <Skeleton height={10} width="70%" />
              <Skeleton height={24} width="50%" />
              <Skeleton height={10} width="60%" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <Skeleton height={12} width={120} className="mb-4" />
          <Skeleton height={160} rounded="rounded-xl" className="w-full" />
        </div>
      </div>
    </div>
  )
}

// ── Gameplan PDF cards skeleton ────────────────────────────────────────────
// Used by: /gameplan (member view — two columns)

export function GameplanSkeleton() {
  return (
    <div className="flex gap-8">
      {[0, 1].map(col => (
        <div key={col} className="flex-1 flex flex-col gap-3">
          <Skeleton height={16} width={100} className="mb-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Skeleton width={36} height={36} rounded="rounded-lg" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton height={13} width="70%" />
                  <Skeleton height={10} width={60} rounded="rounded-full" />
                </div>
                <Skeleton height={30} width={80} rounded="rounded-lg" />
              </div>
              <Skeleton height={10} width="85%" />
              <Skeleton height={10} width={70} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
