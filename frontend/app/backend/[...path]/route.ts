import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const RAILWAY = 'https://tenke-proathlete-production.up.railway.app'

async function proxy(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
) {
  const { path } = await params
  const target = new URL('/' + path.join('/'), RAILWAY)
  target.search = req.nextUrl.search

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    if (k !== 'host' && k !== 'accept-encoding') headers[k] = v
  })

  const init: RequestInit = {
    method: req.method,
    headers,
    // @ts-ignore
    cache: 'no-store',
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  // Fetch without following redirects so we can re-fetch with headers intact
  let upstream = await fetch(target.toString(), { ...init, redirect: 'manual' })

  // FastAPI redirects /members → /members/ — follow it server-side with auth header preserved
  if (upstream.status === 307 || upstream.status === 308 || upstream.status === 301 || upstream.status === 302) {
    const location = upstream.headers.get('location')
    if (location) {
      upstream = await fetch(location, { ...init, redirect: 'manual' })
    }
  }

  const resHeaders = new Headers()
  upstream.headers.forEach((v, k) => {
    if (!['transfer-encoding', 'connection', 'content-encoding'].includes(k)) {
      resHeaders.set(k, v)
    }
  })

  return new NextResponse(upstream.body ?? null, {
    status: upstream.status,
    headers: resHeaders,
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params)
}
