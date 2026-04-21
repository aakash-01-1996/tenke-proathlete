'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

type RequiredRole = 'any' | 'coach_or_trainer' | 'member'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: RequiredRole
}

/**
 * Wraps protected pages. Checks Firebase auth state and optionally verifies
 * the user's role via GET /auth/me before rendering children.
 *
 * - requiredRole='any'              → any signed-in user
 * - requiredRole='coach_or_trainer' → coach or trainer only
 * - requiredRole='member'           → member only
 */
export default function AuthGuard({ children, requiredRole = 'any' }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`)
        return
      }

      if (requiredRole === 'any') {
        setStatus('allowed')
        return
      }

      // Need to verify role — call /auth/me
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
          // Backend error — let them through rather than redirect loop
          setStatus('allowed')
          return
        }

        const { role } = await res.json()

        if (requiredRole === 'coach_or_trainer') {
          if (role === 'coach' || role === 'trainer') {
            setStatus('allowed')
          } else {
            // Member trying to access admin — send them to their page
            router.replace('/metrics')
          }
          return
        }

        if (requiredRole === 'member') {
          if (role === 'member') {
            setStatus('allowed')
          } else {
            // Coach/trainer trying to access member-only page
            router.replace('/admin/members')
          }
          return
        }
      } catch {
        // Network error — let them through rather than redirect loop
        setStatus('allowed')
      }
    })

    return unsubscribe
  }, [router, pathname, requiredRole])

  if (status === 'checking') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <span className="text-gray-400 text-sm">Verifying access...</span>
      </div>
    )
  }

  return <>{children}</>
}
