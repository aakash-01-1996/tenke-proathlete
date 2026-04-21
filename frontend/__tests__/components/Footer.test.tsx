import React from 'react'
import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'

let mockPathname = '/'

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

describe('Footer', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  it('renders copyright text with current year', () => {
    render(<Footer />)
    const year = new Date().getFullYear()
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument()
  })

  it('renders About, Contact Us, and FAQ links', () => {
    render(<Footer />)
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByText('Contact Us')).toBeInTheDocument()
    expect(screen.getByText('FAQ')).toBeInTheDocument()
  })

  it('Instagram link has target _blank and rel noopener', () => {
    render(<Footer />)
    const instagramLink = screen.getByLabelText('Instagram')
    expect(instagramLink).toHaveAttribute('target', '_blank')
    expect(instagramLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('email link uses mailto href', () => {
    render(<Footer />)
    const emailLink = screen.getByLabelText('Email')
    expect(emailLink).toHaveAttribute('href', expect.stringContaining('mailto:'))
  })

  it('does not render on admin routes', () => {
    mockPathname = '/admin/members'
    const { container } = render(<Footer />)
    expect(container.firstChild).toBeNull()
  })

  it('does render on public routes', () => {
    mockPathname = '/community'
    const { container } = render(<Footer />)
    expect(container.firstChild).not.toBeNull()
  })
})
