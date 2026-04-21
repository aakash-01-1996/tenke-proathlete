import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorState from '@/components/ErrorState'

// Mock navigator.onLine
const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value, writable: true, configurable: true })
}

describe('ErrorState', () => {
  beforeEach(() => {
    setOnline(true)
  })

  it('renders generic variant with correct title', () => {
    render(<ErrorState variant="generic" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders network variant with correct title', () => {
    render(<ErrorState variant="network" />)
    expect(screen.getByText('Connection problem')).toBeInTheDocument()
  })

  it('renders offline variant with correct title', () => {
    render(<ErrorState variant="offline" />)
    expect(screen.getByText("You're offline")).toBeInTheDocument()
  })

  it('shows custom message when provided', () => {
    render(<ErrorState variant="generic" message="Custom error text" />)
    expect(screen.getByText('Custom error text')).toBeInTheDocument()
  })

  it('renders Try again button when onRetry is provided', () => {
    render(<ErrorState variant="generic" onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState variant="generic" />)
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('calls onRetry when button is clicked', () => {
    const mockRetry = jest.fn()
    render(<ErrorState variant="generic" onRetry={mockRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  it('auto-detects offline when navigator.onLine is false and no variant provided', () => {
    setOnline(false)
    render(<ErrorState />)
    expect(screen.getByText("You're offline")).toBeInTheDocument()
  })

  it('defaults to network variant when online and no variant provided', () => {
    setOnline(true)
    render(<ErrorState />)
    expect(screen.getByText('Connection problem')).toBeInTheDocument()
  })
})
