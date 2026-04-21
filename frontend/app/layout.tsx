import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'TENKE | Professional Athlete Tracking',
  description: 'Professional Athlete Tracking & Development Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen overflow-hidden bg-gray-100 text-gray-900">
        <Header />
        <main className="flex-1 overflow-y-auto w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
