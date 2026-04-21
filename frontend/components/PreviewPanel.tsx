'use client'

import { useEffect, useRef } from 'react'

type ViewMode = 'mobile' | 'tablet' | 'desktop'

const viewWidths: Record<ViewMode, string> = {
  mobile:  '390px',
  tablet:  '768px',
  desktop: '100%',
}

const viewIcons: Record<ViewMode, string> = {
  mobile:  '📱',
  tablet:  '📟',
  desktop: '🖥️',
}

interface PreviewPanelProps {
  url: string
  title?: string
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onClose: () => void
}

export default function PreviewPanel({ url, title, viewMode, onViewModeChange, onClose }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 cursor-pointer"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="w-full max-w-4xl bg-gray-100 flex flex-col shadow-2xl" style={{ minWidth: '480px' }}>

        {/* Header */}
        <div className="flex items-center justify-between bg-gray-900 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Member Preview</span>
            {title && <span className="text-xs text-gray-300">— {title}</span>}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {(['mobile', 'tablet', 'desktop'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                title={mode}
                className={`text-sm rounded-md px-2 py-1 transition ${
                  viewMode === mode ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {viewIcons[mode]}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Browser chrome */}
        <div className="flex items-center gap-2 bg-gray-200 border-b border-gray-300 px-4 py-2 flex-shrink-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md text-xs text-gray-400 font-mono truncate" style={{ padding: '0.3rem 0.75rem' }}>
            {url}
          </div>
          <button
            onClick={() => iframeRef.current?.contentWindow?.location.reload()}
            className="text-gray-400 hover:text-gray-700 transition text-sm"
            title="Reload"
          >
            ↻
          </button>
        </div>

        {/* Iframe container */}
        <div className="flex-1 overflow-auto bg-gray-300 flex justify-center py-4">
          <div
            className="bg-white shadow-xl transition-all duration-300 overflow-hidden"
            style={{ width: viewWidths[viewMode], height: '100%', minHeight: '600px' }}
          >
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-none"
              title="Member Preview"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
