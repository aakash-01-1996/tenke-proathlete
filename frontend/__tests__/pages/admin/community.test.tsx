import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommunityAdminPage from '@/app/admin/community/page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

let authCallback: ((user: { getIdToken: () => Promise<string> } | null) => void) | null = null

jest.mock('@/lib/firebase', () => ({ auth: {} }))
jest.mock('@/lib/cloudinary', () => ({ getOptimizedUrl: (url: string) => url }))
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_: unknown, cb: (user: { getIdToken: () => Promise<string> } | null) => void) => {
    authCallback = cb
    return () => {}
  },
}))

global.fetch = jest.fn()

const mockPosts = [
  {
    id: 'p1',
    author_email: 'coach@gym.com',
    author_name: 'Coach Mike',
    content: '<p>Great session today!</p>',
    image_url: null,
    created_at: '2026-01-15T10:00:00Z',
    comments: [
      { id: 'c1', author_name: 'Alex Turner', content: 'Thanks coach!', created_at: '2026-01-15T11:00:00Z' },
    ],
  },
  {
    id: 'p2',
    author_email: 'member@gym.com',
    author_name: 'Maria Garcia',
    content: '<p>Feeling strong!</p>',
    image_url: null,
    created_at: '2026-01-16T10:00:00Z',
    comments: [],
  },
]

async function setup() {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockPosts })
  render(<CommunityAdminPage />)
  authCallback?.({ getIdToken: async () => 'tok' })
  await waitFor(() => screen.getByText('Coach Mike'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Admin Community Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    authCallback = null
  })

  it('renders posts after loading', async () => {
    await setup()
    expect(screen.getByText('Coach Mike')).toBeInTheDocument()
    expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
  })

  it('shows post and comment counts', async () => {
    await setup()
    expect(screen.getByText(/2 posts/i)).toBeInTheDocument()
    // stats bar shows "1 comments"; toggle button shows "1 comment" — at least one match
    expect(screen.getAllByText(/1 comment/i).length).toBeGreaterThan(0)
  })

  it('filters posts by author name', async () => {
    await setup()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Coach')
    expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument()
    expect(screen.getByText('Coach Mike')).toBeInTheDocument()
  })

  it('shows comment count toggle button', async () => {
    await setup()
    // toggle button for post with 1 comment
    expect(screen.getAllByText(/1 comment/i).length).toBeGreaterThan(0)
  })

  it('expands comments when toggle is clicked', async () => {
    await setup()
    // click the toggle button (last element with "1 comment" text, which is the button)
    const toggleBtn = screen.getAllByText(/1 comment/i).find(el => el.tagName === 'BUTTON')!
    fireEvent.click(toggleBtn)
    expect(screen.getByText('Thanks coach!')).toBeInTheDocument()
  })

  it('hides comments after toggling again', async () => {
    await setup()
    const toggleBtn = screen.getAllByText(/1 comment/i).find(el => el.tagName === 'BUTTON')!
    fireEvent.click(toggleBtn)
    fireEvent.click(screen.getByText(/hide comments/i))
    expect(screen.queryByText('Thanks coach!')).not.toBeInTheDocument()
  })

  it('shows delete confirmation when Delete Post is clicked', async () => {
    await setup()
    fireEvent.click(screen.getAllByRole('button', { name: /delete post/i })[0])
    // modal heading is "Delete Content"
    expect(screen.getByText(/delete content/i)).toBeInTheDocument()
  })

  it('calls DELETE endpoint when post deletion confirmed', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockPosts })
      .mockResolvedValueOnce({ ok: true }) // delete
    render(<CommunityAdminPage />)
    authCallback?.({ getIdToken: async () => 'tok' })
    await waitFor(() => screen.getByText('Coach Mike'))
    fireEvent.click(screen.getAllByRole('button', { name: /delete post/i })[0])
    // confirm button says "Delete"
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.some(
        ([url, opts]) => opts?.method === 'DELETE' && url.includes('/p1')
      )).toBeTruthy()
    })
  })
})
