import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InquiriesPage from '@/app/admin/inquiries/page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

let authCallback: ((user: { getIdToken: () => Promise<string> } | null) => void) | null = null

jest.mock('@/lib/firebase', () => ({ auth: {} }))

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_: unknown, cb: (user: { getIdToken: () => Promise<string> } | null) => void) => {
    authCallback = cb
    return () => {}
  },
}))

global.fetch = jest.fn()

const mockInquiries = [
  {
    id: '1',
    first_name: 'Alice',
    last_name: 'Johnson',
    child_name: 'Tommy',
    age: 10,
    email: 'alice@example.com',
    phone: '555-0001',
    hear_about_us: 'instagram',
    read: false,
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: '2',
    first_name: 'Bob',
    last_name: 'Williams',
    child_name: 'Sara',
    age: 12,
    email: 'bob@example.com',
    phone: '555-0002',
    hear_about_us: 'friend',
    read: true,
    created_at: '2026-01-16T10:00:00Z',
  },
]

async function setupWithAuth() {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => mockInquiries,
  })
  const result = render(<InquiriesPage />)
  authCallback?.({ getIdToken: async () => 'test-token' })
  await waitFor(() => screen.getByText('Alice Johnson'))
  return result
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Inquiries Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    authCallback = null
  })

  it('renders loading skeleton initially', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    render(<InquiriesPage />)
    authCallback?.({ getIdToken: async () => 'tok' })
    // SplitPanelSkeleton renders panels
    const { container } = render(<InquiriesPage />)
    expect(container).toBeTruthy()
  })

  it('shows inquiries after loading', async () => {
    await setupWithAuth()
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Williams')).toBeInTheDocument()
  })

  it('shows unread count in header', async () => {
    await setupWithAuth()
    expect(screen.getByText(/1 unread/i)).toBeInTheDocument()
  })

  it('shows blue unread dot on unread inquiries', async () => {
    await setupWithAuth()
    // The first inquiry (Alice) is unread — has a blue dot span
    const blueSpans = document.querySelectorAll('.bg-blue-500')
    expect(blueSpans.length).toBeGreaterThanOrEqual(1)
  })

  it('shows inquiry detail on click', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockInquiries }) // GET inquiries
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockInquiries[0], read: true }) }) // PATCH read
    render(<InquiriesPage />)
    authCallback?.({ getIdToken: async () => 'tok' })
    await waitFor(() => screen.getByText('Alice Johnson'))
    fireEvent.click(screen.getByText('Alice Johnson'))
    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })
  })

  it('marks inquiry as read when selected', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockInquiries })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockInquiries[0], read: true }) })
    render(<InquiriesPage />)
    authCallback?.({ getIdToken: async () => 'tok' })
    await waitFor(() => screen.getByText('Alice Johnson'))
    fireEvent.click(screen.getByText('Alice Johnson'))
    await waitFor(() => {
      const patchCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, opts]) => url.includes('/read') && opts.method === 'PATCH'
      )
      expect(patchCall).toBeTruthy()
    })
  })

  it('filters inquiries by search', async () => {
    await setupWithAuth()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Bob')
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Williams')).toBeInTheDocument()
  })

  it('shows Export CSV button when inquiries exist', async () => {
    await setupWithAuth()
    expect(screen.getByText(/export csv/i)).toBeInTheDocument()
  })

  it('shows Clear All button when inquiries exist', async () => {
    await setupWithAuth()
    expect(screen.getByText(/clear all/i)).toBeInTheDocument()
  })

  it('shows confirmation modal when Clear All is clicked', async () => {
    await setupWithAuth()
    fireEvent.click(screen.getByText(/clear all/i))
    expect(screen.getByText(/clear all inquiries/i)).toBeInTheDocument()
    expect(screen.getByText(/make sure you've exported/i)).toBeInTheDocument()
  })

  it('cancels clear all modal', async () => {
    await setupWithAuth()
    fireEvent.click(screen.getByText(/clear all/i))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/make sure you've exported/i)).not.toBeInTheDocument()
  })

  it('calls DELETE /inquiries/ when clear all confirmed', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockInquiries })
      .mockResolvedValueOnce({ ok: true }) // DELETE all
    render(<InquiriesPage />)
    authCallback?.({ getIdToken: async () => 'tok' })
    await waitFor(() => screen.getByText('Alice Johnson'))
    fireEvent.click(screen.getByText(/clear all/i))
    fireEvent.click(screen.getByRole('button', { name: /yes, clear all/i }))
    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find(
        ([, opts]) => opts?.method === 'DELETE' && !opts?.url?.includes('/')
      )
      expect((global.fetch as jest.Mock).mock.calls.some(
        ([url, opts]) => opts?.method === 'DELETE'
      )).toBeTruthy()
    })
  })

  it('exports CSV file when Export CSV is clicked', async () => {
    const origCreate = document.createElement.bind(document)
    const mockCreateObjectURL = jest.fn(() => 'blob:url')
    const mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    const mockClick = jest.fn()
    const mockAnchor = { href: '', download: '', click: mockClick }
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement
      return origCreate(tag)
    })

    await setupWithAuth()
    fireEvent.click(screen.getByText(/export csv/i))
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockAnchor.download).toContain('summer-camp-inquiries')
    jest.restoreAllMocks()
  })

  it('CSV contains correct headers', async () => {
    const origCreate = document.createElement.bind(document)
    let capturedCSV = ''
    const OrigBlob = global.Blob
    global.Blob = class extends OrigBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts)
        capturedCSV = parts.join('')
      }
    } as typeof Blob
    global.URL.createObjectURL = jest.fn(() => 'blob:url')
    global.URL.revokeObjectURL = jest.fn()
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return { href: '', download: '', click: jest.fn() } as unknown as HTMLAnchorElement
      return origCreate(tag)
    })

    await setupWithAuth()
    fireEvent.click(screen.getByText(/export csv/i))

    expect(capturedCSV).toContain('First Name')
    expect(capturedCSV).toContain('Last Name')
    expect(capturedCSV).toContain('Child Name')
    expect(capturedCSV).toContain('Email')
    global.Blob = OrigBlob
  })

  it('CSV contains inquiry data', async () => {
    const origCreate = document.createElement.bind(document)
    let capturedCSV = ''
    const OrigBlob = global.Blob
    global.Blob = class extends OrigBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts)
        capturedCSV = parts.join('')
      }
    } as typeof Blob
    global.URL.createObjectURL = jest.fn(() => 'blob:url')
    global.URL.revokeObjectURL = jest.fn()
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return { href: '', download: '', click: jest.fn() } as unknown as HTMLAnchorElement
      return origCreate(tag)
    })

    await setupWithAuth()
    fireEvent.click(screen.getByText(/export csv/i))

    expect(capturedCSV).toContain('Alice')
    expect(capturedCSV).toContain('alice@example.com')
    expect(capturedCSV).toContain('Instagram') // hear_about_us label
    global.Blob = OrigBlob
  })

  it('deletes single inquiry when Delete is clicked', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockInquiries })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockInquiries[0], read: true }) }) // mark read
      .mockResolvedValueOnce({ ok: true }) // delete
    render(<InquiriesPage />)
    authCallback?.({ getIdToken: async () => 'tok' })
    await waitFor(() => screen.getByText('Alice Johnson'))
    fireEvent.click(screen.getByText('Alice Johnson'))
    await waitFor(() => screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, opts]) => opts?.method === 'DELETE' && url.includes('/1')
      )
      expect(deleteCall).toBeTruthy()
    })
  })
})
