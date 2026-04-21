import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Header from '@/components/Header'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn()
let mockPathname = '/'
let authCallback: ((user: null | { uid: string }) => void) | null = null

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/firebase', () => ({ auth: {} }))

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_: unknown, cb: (user: null | { uid: string }) => void) => {
    authCallback = cb
    return () => {}
  },
  signOut: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('next/link', () => {
  const MockLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Header', () => {
  beforeEach(() => {
    mockPathname = '/'
    mockPush.mockClear()
    document.cookie = ''
  })

  it('renders logo image', () => {
    render(<Header />)
    expect(screen.getByAltText(/TENKE METRICS Logo/i)).toBeInTheDocument()
  })

  it('renders all nav links', () => {
    render(<Header />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Athlete')).toBeInTheDocument()
    expect(screen.getByText('Community')).toBeInTheDocument()
    expect(screen.getByText('Gameplan')).toBeInTheDocument()
  })

  it('shows Sign In link when user is logged out', () => {
    render(<Header />)
    authCallback?.(null)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('shows Sign Out button when user is logged in', async () => {
    render(<Header />)
    authCallback?.({ uid: 'user123' })
    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })
  })

  it('does not render on admin routes', () => {
    mockPathname = '/admin/members'
    const { container } = render(<Header />)
    expect(container.firstChild).toBeNull()
  })

  it('marks the active nav link based on pathname', () => {
    mockPathname = '/community'
    render(<Header />)
    const communityLink = screen.getByText('Community').closest('a')
    expect(communityLink?.className).toContain('bg-gray-600')
  })

  it('calls signOut and redirects on sign out click', async () => {
    const { signOut } = require('firebase/auth')
    render(<Header />)
    authCallback?.({ uid: 'user123' })
    await waitFor(() => screen.getByText('Sign Out'))
    fireEvent.click(screen.getByText('Sign Out'))
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
