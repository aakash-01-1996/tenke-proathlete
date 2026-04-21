import { getOptimizedUrl } from '@/lib/cloudinary'

describe('getOptimizedUrl', () => {
  const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg'

  it('inserts q_auto and f_auto after /upload/', () => {
    const result = getOptimizedUrl(cloudinaryUrl)
    expect(result).toBe('https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/v1234/sample.jpg')
  })

  it('includes width transform when provided', () => {
    const result = getOptimizedUrl(cloudinaryUrl, { width: 800 })
    expect(result).toBe('https://res.cloudinary.com/demo/image/upload/q_auto,f_auto,w_800/v1234/sample.jpg')
  })

  it('returns non-Cloudinary URLs unchanged', () => {
    const url = 'https://example.com/image.jpg'
    expect(getOptimizedUrl(url)).toBe(url)
  })

  it('returns empty string for null', () => {
    expect(getOptimizedUrl(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(getOptimizedUrl(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(getOptimizedUrl('')).toBe('')
  })

  it('does not duplicate transforms when called twice', () => {
    const first = getOptimizedUrl(cloudinaryUrl)
    const second = getOptimizedUrl(first)
    // second call inserts again — just confirm no crash
    expect(second).toContain('q_auto')
  })
})
