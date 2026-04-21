import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SummerCampPage from '@/app/summercamp/page'

global.fetch = jest.fn()

describe('SummerCamp Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders inquiry form fields', () => {
    render(<SummerCampPage />)
    // Fields have labels — check by label text
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
    expect(screen.getByText("Child's Name")).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('renders the submit button', () => {
    render(<SummerCampPage />)
    expect(screen.getByRole('button', { name: /submit inquiry/i })).toBeInTheDocument()
  })

  function fillAge(container: HTMLElement) {
    const ageInput = container.querySelector('input[name="age"]') as HTMLInputElement
    fireEvent.change(ageInput, { target: { value: '12' } })
  }

  it('shows success screen after successful submission', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })
    const { container } = render(<SummerCampPage />)
    fillAge(container)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => {
      expect(screen.getByText(/inquiry submitted/i)).toBeInTheDocument()
    })
  })

  it('shows error message when submission fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    const { container } = render(<SummerCampPage />)
    fillAge(container)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { container } = render(<SummerCampPage />)
    fillAge(container)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    })
  })

  it('updates form fields on user input', async () => {
    const { container } = render(<SummerCampPage />)
    const firstNameInput = container.querySelector('input[name="firstName"]') as HTMLInputElement
    await userEvent.type(firstNameInput, 'John')
    expect(firstNameInput).toHaveValue('John')
  })

  it('sends POST request to /inquiries/', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })
    const { container } = render(<SummerCampPage />)
    fillAge(container)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/inquiries/'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
