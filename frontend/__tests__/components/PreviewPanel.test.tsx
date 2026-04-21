import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PreviewPanel from '@/components/PreviewPanel'

const defaultProps = {
  url: 'https://example.com/member/123',
  title: 'Test Preview',
  viewMode: 'mobile' as const,
  onViewModeChange: jest.fn(),
  onClose: jest.fn(),
}

describe('PreviewPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders with iframe pointing to the correct URL', () => {
    const { container } = render(<PreviewPanel {...defaultProps} />)
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.src).toContain('example.com/member/123')
  })

  it('displays the title in the panel', () => {
    const { container } = render(<PreviewPanel {...defaultProps} />)
    expect(container.textContent).toContain('Test Preview')
  })

  it('calls onClose when ✕ close button is clicked', () => {
    render(<PreviewPanel {...defaultProps} />)
    fireEvent.click(screen.getByText('✕'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    render(<PreviewPanel {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onViewModeChange when mode buttons clicked', () => {
    const { container } = render(<PreviewPanel {...defaultProps} />)
    fireEvent.click(container.querySelector('button[title="tablet"]')!)
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('tablet')
    fireEvent.click(container.querySelector('button[title="desktop"]')!)
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('desktop')
    fireEvent.click(container.querySelector('button[title="mobile"]')!)
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('mobile')
  })

  it('applies correct width on the iframe wrapper div for mobile', () => {
    const { container } = render(<PreviewPanel {...defaultProps} viewMode="mobile" />)
    // Width is on the div directly wrapping the iframe (last element with a width style)
    const wrappers = container.querySelectorAll('[style*="width"]')
    const wrapper = Array.from(wrappers).find(el => (el as HTMLElement).style.width === '390px') as HTMLElement
    expect(wrapper).toBeTruthy()
  })

  it('applies correct width for tablet', () => {
    const { container } = render(<PreviewPanel {...defaultProps} viewMode="tablet" />)
    const wrappers = container.querySelectorAll('[style*="width"]')
    const wrapper = Array.from(wrappers).find(el => (el as HTMLElement).style.width === '768px') as HTMLElement
    expect(wrapper).toBeTruthy()
  })

  it('applies 100% width for desktop', () => {
    const { container } = render(<PreviewPanel {...defaultProps} viewMode="desktop" />)
    const wrappers = container.querySelectorAll('[style*="width"]')
    const wrapper = Array.from(wrappers).find(el => (el as HTMLElement).style.width === '100%') as HTMLElement
    expect(wrapper).toBeTruthy()
  })
})
