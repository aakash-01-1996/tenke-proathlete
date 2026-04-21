import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from '@/app/auth/signin/page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
  useSearchParams: () => ({ get: (_: string) => null }),
}))

jest.mock('@/lib/firebase', () => ({ auth: {}, app: {} }))

const mockSignIn = jest.fn()
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
  onAuthStateChanged: (_: unknown, cb: (u: null) => void) => { cb(null); return () => {} },
  getAuth: jest.fn(() => ({})),
}))

global.fetch = jest.fn()

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SignIn Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders email and password inputs', () => {
    render(<SignInPage />)
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renders Sign In submit button', () => {
    render(<SignInPage />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('updates email field on input', async () => {
    render(<SignInPage />)
    const emailInput = screen.getByPlaceholderText('your@email.com')
    await userEvent.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('shows loading state while signing in', async () => {
    mockSignIn.mockReturnValue(new Promise(() => {}))
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })

  it('shows error for wrong password', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/wrong-password' })
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
    })
  })

  it('shows error for invalid credential', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' })
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
    })
  })

  it('shows rate limit error for too many requests', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/too-many-requests' })
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument()
    })
  })

  it('shows generic error for unknown firebase error', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/network-request-failed' })
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/failed to sign in/i)).toBeInTheDocument()
    })
  })

  it('redirects coach to /admin/members after login', async () => {
    const mockUser = { getIdToken: jest.fn().mockResolvedValue('tok') }
    mockSignIn.mockResolvedValue({ user: mockUser })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'coach', email: 'coach@test.com' }),
    })
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/members')
    })
  })

  it('redirects member to /metrics after login', async () => {
    const mockUser = { getIdToken: jest.fn().mockResolvedValue('tok') }
    mockSignIn.mockResolvedValue({ user: mockUser })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'member', email: 'member@test.com' }),
    })
    render(<SignInPage />)
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/metrics')
    })
  })
})
