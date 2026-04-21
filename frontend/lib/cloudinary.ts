/**
 * Transform a Cloudinary URL to serve an auto-compressed, auto-formatted image.
 * Inserts q_auto,f_auto (and optional width) after /upload/.
 * Non-Cloudinary URLs are returned unchanged.
 */
export function getOptimizedUrl(
  url: string | null | undefined,
  options: { width?: number } = {},
): string {
  if (!url || !url.includes('res.cloudinary.com')) return url ?? ''

  const transforms = ['q_auto', 'f_auto']
  if (options.width) transforms.push(`w_${options.width}`)

  return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}
