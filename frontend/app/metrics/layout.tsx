import AuthGuard from '@/components/AuthGuard'

export default function MetricsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredRole="any">{children}</AuthGuard>
}
