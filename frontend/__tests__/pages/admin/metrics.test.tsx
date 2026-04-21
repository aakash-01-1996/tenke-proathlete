import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminMetricsPage from '@/app/admin/metrics/page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/firebase', () => ({ app: {} }))
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { getIdToken: async () => 'tok' } })),
}))

global.fetch = jest.fn()

const mockMembers = [
  { id: 'mem1', display_id: 1, first_name: 'Alex', last_name: 'Turner' },
  { id: 'mem2', display_id: 2, first_name: 'Maria', last_name: 'Garcia' },
]

const mockEntries = [
  {
    id: 'e1', member_id: 'mem1', recorded_at: '2026-01-15T00:00:00Z',
    fly_10yd: 1.5, game_speed: 15.2, vertical: 30, broad_jump: 96, overall_progress: 75,
  },
  {
    id: 'e2', member_id: 'mem2', recorded_at: '2026-01-16T00:00:00Z',
    fly_10yd: 1.6, game_speed: 14.8, vertical: 28, broad_jump: 92, overall_progress: 65,
  },
]

async function setupPage() {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/members')) return Promise.resolve({ ok: true, json: async () => mockMembers })
    if (url.includes('/metrics')) return Promise.resolve({ ok: true, json: async () => mockEntries })
    return Promise.resolve({ ok: true, json: async () => [] })
  })
  render(<AdminMetricsPage />)
  await waitFor(() => screen.getAllByText(/#1 Alex Turner/i)[0])
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Admin Metrics Page', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders metrics entries after loading', async () => {
    await setupPage()
    expect(screen.getAllByText(/#1 Alex Turner/i)[0]).toBeInTheDocument()
  })

  it('shows entry count', async () => {
    await setupPage()
    expect(screen.getByText(/2 total entries/i)).toBeInTheDocument()
  })

  it('renders metric values in table', async () => {
    await setupPage()
    expect(screen.getByText('1.5s')).toBeInTheDocument()
    expect(screen.getByText('30"')).toBeInTheDocument()
  })

  it('opens Add Entry modal', async () => {
    await setupPage()
    fireEvent.click(screen.getByRole('button', { name: /add entry/i }))
    expect(screen.getByText(/add metric entry/i)).toBeInTheDocument()
  })

  it('filters by member in dropdown', async () => {
    await setupPage()
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'mem1' } })
    // Maria Garcia should not appear in table rows (may still appear as an option)
    const mariaInTable = screen.queryAllByText(/#2 Maria Garcia/i).filter(el => el.tagName !== 'OPTION')
    expect(mariaInTable.length).toBe(0)
    expect(screen.getAllByText(/#1 Alex Turner/i)[0]).toBeInTheDocument()
  })

  it('opens delete confirmation on Delete click', async () => {
    await setupPage()
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText(/delete entry/i)).toBeInTheDocument()
  })

  it('calls DELETE endpoint when confirmed', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string, opts: RequestInit) => {
      if (opts?.method === 'DELETE') return Promise.resolve({ ok: true })
      if (url.includes('/members')) return Promise.resolve({ ok: true, json: async () => mockMembers })
      if (url.includes('/metrics')) return Promise.resolve({ ok: true, json: async () => mockEntries })
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    render(<AdminMetricsPage />)
    await waitFor(() => screen.getAllByText(/#1 Alex Turner/i)[0])
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    // last Delete button is the modal confirm
    const allDelete = screen.getAllByRole('button', { name: /^delete$/i })
    fireEvent.click(allDelete[allDelete.length - 1])
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.some(
        ([, opts]) => opts?.method === 'DELETE'
      )).toBeTruthy()
    })
  })

  it('shows error state when API fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network'))
    render(<AdminMetricsPage />)
    await waitFor(() => {
      expect(screen.getByText(/connection problem/i)).toBeInTheDocument()
    })
  })
})
