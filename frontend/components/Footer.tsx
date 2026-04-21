'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const pathname = usePathname()

  useEffect(() => {
    setCurrentYear(new Date().getFullYear())
  }, [])

  if (pathname.startsWith('/admin')) return null

  return (
    <footer className="w-full bg-gray-800 border-t border-gray-700 mt-auto">
      <div className="w-full py-4" style={{ paddingLeft: '6rem', paddingRight: '6rem' }}>
        <div className="flex items-center justify-between">
          {/* Copyright */}
          <div className="text-sm text-gray-300">
            © All Rights Reserved {currentYear}
          </div>

          {/* Social Links */}
          <div className="flex gap-4 items-center">
            <a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? '#'} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition" aria-label="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? ''}`} className="text-gray-300 hover:text-white transition" aria-label="Email">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <polyline points="2,4 12,13 22,4"/>
              </svg>
            </a>
          </div>

          {/* Links */}
          <div className="flex gap-6">
            <a href="/about" className="text-sm text-gray-300 hover:text-white transition">About</a>
            <a href="/contact" className="text-sm text-gray-300 hover:text-white transition">Contact Us</a>
            <a href="/faq" className="text-sm text-gray-300 hover:text-white transition">FAQ</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
