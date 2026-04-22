'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const navItems = [
  { href: '/admin/members',   label: 'Members',   icon: '👥' },
  { href: '/admin/trainers',  label: 'Trainers',  icon: '🏋️' },
  { href: '/admin/requests',  label: 'Requests',  icon: '🔔' },
  { href: '/admin/community', label: 'Community', icon: '💬' },
  { href: '/admin/gameplan',  label: 'Gameplan',  icon: '📋' },
  { href: '/admin/events',    label: 'Events',    icon: '📅' },
  { href: '/admin/inquiries', label: 'Inquiries', icon: '📬' },
  { href: '/admin/metrics',   label: 'Metrics',   icon: '📊' },
  { href: '/admin/bookings',  label: 'Bookings',  icon: '📅' },
  { href: '/admin/contacts',  label: 'Contacts',  icon: '✉️' },
]

type AdminUser = { email: string; role: string; name: string | null }

export default function BreakpointLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  async function handleSignOut() {
    await signOut(auth)
    router.replace('/auth/signin')
  }


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`)
        return
      }

      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401 || res.status === 403) {
          router.replace('/auth/signin')
          return
        }
        if (!res.ok) {
          // Backend error (e.g. 500) — don't redirect to signin or we'll loop
          setChecking(false)
          return
        }

        const { email, role, name } = await res.json()

        if (role !== 'coach' && role !== 'trainer') {
          // Member trying to access admin panel
          router.replace('/metrics')
          return
        }

        setAdminUser({ email, role, name: name ?? null })
        setChecking(false)

        // Fetch pending request count for badge (best-effort)
        try {
          const reqRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/day-change-requests?status_filter=pending`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (reqRes.ok) {
            const reqs = await reqRes.json()
            setPendingCount(reqs.length)
          }
        } catch { /* ignore */ }
      } catch {
        // Network or unexpected error — don't redirect, let them stay and retry
        setChecking(false)
      }
    })

    return unsubscribe
  }, [router, pathname])

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <span className="text-gray-400 text-sm">Verifying access...</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">

      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-gray-900 flex flex-col">

        {/* Brand */}
        <div className="flex items-center gap-2 border-b border-gray-700" style={{ padding: '1.25rem 1.5rem' }}>
          <span className="text-yellow-400 text-lg">⚡</span>
          <span className="text-white font-bold text-base tracking-wide">BREAKPOINT</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1" style={{ padding: '1rem 0.75rem' }}>
          {navItems.map(({ href, label, icon }) => {
            const isActive = pathname.startsWith(href)
            const showBadge = href === '/admin/requests' && pendingCount > 0
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
                style={{ padding: '0.6rem 0.875rem' }}
              >
                <span className="text-base">{icon}</span>
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span className="text-xs font-bold bg-yellow-400 text-gray-900 rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom — back to site + sign out */}
        <div className="border-t border-gray-700 flex flex-col gap-1" style={{ padding: '1rem 0.75rem' }}>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition"
            style={{ padding: '0.6rem 0.875rem' }}
          >
            <span className="text-base">←</span>
            Back to Site
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-900 hover:text-red-300 transition w-full text-left"
            style={{ padding: '0.6rem 0.875rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between" style={{ padding: '0.875rem 2rem' }}>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              {navItems.find(n => pathname.startsWith(n.href))?.label ?? 'Breakpoint'}
            </h1>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50 transition">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(adminUser?.name ?? adminUser?.email)?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {adminUser?.name ? `Hi, ${adminUser.name.split(' ')[0]}` : adminUser?.email ?? ''}
                </p>
                <p className="text-xs text-gray-400 capitalize leading-tight">{adminUser?.role ?? ''}</p>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-900 truncate">{adminUser?.name ?? adminUser?.email}</p>
                <p className="text-xs text-gray-400 truncate">{adminUser?.email}</p>
              </div>
<button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition rounded-b-xl"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '2rem' }}>
          {children}
        </main>
      </div>

</div>
  )
}
