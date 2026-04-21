import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MembersPage from '@/app/admin/members/page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/firebase', () => ({ app: {} }))
jest.mock('@/components/PreviewPanel', () => {
  const Mock = () => <div data-testid="preview-panel">Preview</div>
  Mock.displayName = 'MockPreviewPanel'
  return Mock
})
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { getIdToken: async () => 'tok' } })),
}))

global.fetch = jest.fn()

const mockMembers = [
  {
    id: 'mem1', display_id: 1, first_name: 'Alex', last_name: 'Turner',
    email: 'alex@test.com', phone: '555-1111', age: 20, weight: '180',
    height: '6\'0"', trainer_id: null, package: 'Basic', sessions_total: 10,
    sessions_left: 8, training_days: ['M', 'W'],
  },
  {
    id: 'mem2', display_id: 2, first_name: 'Maria', last_name: 'Garcia',
    email: 'maria@test.com', phone: '555-2222', age: 22, weight: '140',
    height: '5\'5"', trainer_id: 'tr1', package: 'Pro', sessions_total: 20,
    sessions_left: 15, training_days: ['T', 'Th'],
  },
]

const mockTrainers = [
  { id: 'tr1', first_name: 'Coach', last_name: 'Mike', email: 'mike@gym.com' },
]

async function setupPage() {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/members')) return Promise.resolve({ ok: true, json: async () => mockMembers })
    if (url.includes('/trainers')) return Promise.resolve({ ok: true, json: async () => mockTrainers })
    if (url.includes('/day-change-requests')) return Promise.resolve({ ok: true, json: async () => [] })
    return Promise.resolve({ ok: true, json: async () => [] })
  })
  render(<MembersPage />)
  await waitFor(() => screen.getByText('Alex Turner'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Admin Members Page', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders members table after loading', async () => {
    await setupPage()
    expect(screen.getByText('Alex Turner')).toBeInTheDocument()
    expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
  })

  it('shows member count', async () => {
    await setupPage()
    expect(screen.getByText(/2 total members/i)).toBeInTheDocument()
  })

  it('filters members by search text', async () => {
    await setupPage()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Maria')
    expect(screen.queryByText('Alex Turner')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
  })

  it('clears search and shows all members', async () => {
    await setupPage()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Maria')
    await userEvent.clear(screen.getByPlaceholderText(/search/i))
    expect(screen.getByText('Alex Turner')).toBeInTheDocument()
  })

  it('opens Add Member modal on button click', async () => {
    await setupPage()
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))
    expect(screen.getByText(/add new member/i)).toBeInTheDocument()
  })

  it('opens edit modal with member data pre-filled', async () => {
    await setupPage()
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alex')).toBeInTheDocument()
    })
  })

  it('shows delete confirmation on Remove click', async () => {
    await setupPage()
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    fireEvent.click(removeButtons[0])
    expect(screen.getByText(/remove member\?/i)).toBeInTheDocument()
  })

  it('advances to step 2 of delete confirmation', async () => {
    await setupPage()
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    fireEvent.click(removeButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('calls DELETE endpoint when removal confirmed', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string, opts: RequestInit) => {
      if (opts?.method === 'DELETE') return Promise.resolve({ ok: true })
      if (url.includes('/members')) return Promise.resolve({ ok: true, json: async () => mockMembers })
      if (url.includes('/trainers')) return Promise.resolve({ ok: true, json: async () => mockTrainers })
      if (url.includes('/day-change-requests')) return Promise.resolve({ ok: true, json: async () => [] })
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    render(<MembersPage />)
    await waitFor(() => screen.getByText('Alex Turner'))
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    fireEvent.click(removeButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, remove permanently/i }))
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.some(
        ([, opts]) => opts?.method === 'DELETE'
      )).toBeTruthy()
    })
  })

  it('shows Preview button and opens PreviewPanel', async () => {
    await setupPage()
    const previewButtons = screen.getAllByRole('button', { name: /preview/i })
    fireEvent.click(previewButtons[0])
    expect(screen.getByTestId('preview-panel')).toBeInTheDocument()
  })

  it('displays trainer name for members with trainer assigned', async () => {
    await setupPage()
    expect(screen.getByText('Coach Mike')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    render(<MembersPage />)
    await waitFor(() => {
      expect(screen.getByText(/connection problem/i)).toBeInTheDocument()
    })
  })
})
