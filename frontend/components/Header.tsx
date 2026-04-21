'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user)
    })
    return unsubscribe
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      document.cookie = 'bp_session=; path=/; max-age=0'
      router.push('/')
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Sign out error:', error)
    }
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/metrics', label: 'Athlete' },
    { href: '/community', label: 'Community' },
    { href: '/gameplan', label: 'Gameplan' },
  ]

  if (pathname.startsWith('/admin')) return null

  return (
    <header className="sticky top-0 z-50 w-full bg-gray-800 border-b border-gray-700">
      <nav className="w-full py-3 flex items-center justify-between" style={{ paddingLeft: '2rem', paddingRight: '6rem' }}>
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 hover:opacity-70 transition">
          <img
            src="/images/logo.svg"
            alt="TENKE METRICS Logo"
            style={{ height: '49px', width: 'auto' }}
          />
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Auth Button - right side */}
        {isLoggedIn ? (
          <button
            onClick={handleSignOut}
            className="px-5 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition"
          >
            Sign Out
          </button>
        ) : (
          <Link
            href="/auth/signin"
            className="px-5 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition"
          >
            Sign In
          </Link>
        )}
      </nav>
    </header>
  )
}
