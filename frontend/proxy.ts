import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  if (isAdminRoute) {
    // Developer superuser — localhost bypasses auth entirely
    const host = request.headers.get('host') || ''
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    if (isLocalhost) return NextResponse.next()

    // Production — must have a valid session cookie
    const session = request.cookies.get('bp_session')
    if (!session?.value) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/signin'
      url.searchParams.set('from', 'breakpoint')
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
