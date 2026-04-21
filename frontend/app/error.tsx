'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ErrorState'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-sm" style={{ padding: '2rem', maxWidth: '480px', width: '100%' }}>
        <ErrorState variant="generic" onRetry={reset} />
      </div>
    </div>
  )
}
