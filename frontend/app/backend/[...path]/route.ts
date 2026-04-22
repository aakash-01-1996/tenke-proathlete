import { NextRequest, NextResponse } from 'next/server'

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
    if (k !== 'host') headers[k] = v
  })

  const init: RequestInit = { method: req.method, headers, redirect: 'follow' }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  const upstream = await fetch(target.toString(), init)

  const resHeaders = new Headers()
  upstream.headers.forEach((v, k) => {
    if (!['transfer-encoding', 'connection'].includes(k)) resHeaders.set(k, v)
  })

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders })
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
