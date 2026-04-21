import AuthGuard from '@/components/AuthGuard'

export default function GameplanLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredRole="any">{children}</AuthGuard>
}
