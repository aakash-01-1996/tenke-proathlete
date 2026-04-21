import React from 'react'
import { render, screen } from '@testing-library/react'
import PageTitle from '@/components/PageTitle'

describe('PageTitle', () => {
  it('renders the title', () => {
    render(<PageTitle title="My Title" />)
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<PageTitle title="Title" subtitle="My Subtitle" />)
    expect(screen.getByText('My Subtitle')).toBeInTheDocument()
  })

  it('does not render subtitle element when not provided', () => {
    const { queryByText } = render(<PageTitle title="Title" />)
    expect(queryByText(/subtitle/i)).not.toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<PageTitle title="Title" description="Some description text" />)
    expect(screen.getByText('Some description text')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<PageTitle title="Title" />)
    // Only h1 + possibly subtitle wrapper should be there
    expect(container.querySelectorAll('p').length).toBe(0)
  })
})
