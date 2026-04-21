import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  Skeleton,
  TableSkeleton,
  CardGridSkeleton,
  FeedSkeleton,
  SplitPanelSkeleton,
  MetricsSkeleton,
  GameplanSkeleton,
} from '@/components/Skeleton'

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('applies custom width and height via style', () => {
    const { container } = render(<Skeleton width={120} height={20} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('120px')
    expect(el.style.height).toBe('20px')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="flex-1" />)
    expect(container.firstChild).toHaveClass('flex-1')
  })

  it('applies custom rounded class', () => {
    const { container } = render(<Skeleton rounded="rounded-full" />)
    expect(container.firstChild).toHaveClass('rounded-full')
  })

  it('defaults to rounded-lg', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('rounded-lg')
  })
})

describe('TableSkeleton', () => {
  it('renders header and data rows', () => {
    const { container } = render(<TableSkeleton rows={3} cols={4} />)
    // header + 3 rows = 4 rows total
    const rows = container.querySelectorAll('.flex.gap-4')
    expect(rows.length).toBe(4)
  })

  it('renders with default rows and cols', () => {
    const { container } = render(<TableSkeleton />)
    const rows = container.querySelectorAll('.flex.gap-4')
    expect(rows.length).toBe(7) // 1 header + 6 rows
  })

  it('applies correct number of columns per row', () => {
    const { container } = render(<TableSkeleton rows={1} cols={5} />)
    const rows = container.querySelectorAll('.flex.gap-4')
    const firstRow = rows[0]
    expect(firstRow.children.length).toBe(5)
  })
})

describe('CardGridSkeleton', () => {
  it('renders the correct number of cards', () => {
    const { container } = render(<CardGridSkeleton cards={4} cols={2} />)
    const cards = container.querySelectorAll('.bg-white.rounded-2xl')
    expect(cards.length).toBe(4)
  })

  it('renders default 6 cards', () => {
    const { container } = render(<CardGridSkeleton />)
    const cards = container.querySelectorAll('.bg-white.rounded-2xl')
    expect(cards.length).toBe(6)
  })

  it('applies grid-cols-2 class for cols=2', () => {
    const { container } = render(<CardGridSkeleton cols={2} />)
    expect(container.firstChild).toHaveClass('grid-cols-2')
  })

  it('applies grid-cols-3 class for cols=3', () => {
    const { container } = render(<CardGridSkeleton cols={3} />)
    expect(container.firstChild).toHaveClass('grid-cols-3')
  })
})

describe('FeedSkeleton', () => {
  it('renders the correct number of items', () => {
    const { container } = render(<FeedSkeleton items={3} />)
    const cards = container.querySelectorAll('.bg-white.rounded-2xl')
    expect(cards.length).toBe(3)
  })

  it('renders default 4 items', () => {
    const { container } = render(<FeedSkeleton />)
    const cards = container.querySelectorAll('.bg-white.rounded-2xl')
    expect(cards.length).toBe(4)
  })
})

describe('SplitPanelSkeleton', () => {
  it('renders left and right panels', () => {
    const { container } = render(<SplitPanelSkeleton />)
    const panels = container.querySelectorAll('.bg-white.rounded-2xl')
    expect(panels.length).toBeGreaterThanOrEqual(2)
  })
})

describe('MetricsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<MetricsSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameplanSkeleton', () => {
  it('renders two columns', () => {
    const { container } = render(<GameplanSkeleton />)
    // wrapper is .flex.gap-8 with exactly two direct column children
    const wrapper = container.querySelector('.flex.gap-8')
    expect(wrapper?.children.length).toBe(2)
  })
})
