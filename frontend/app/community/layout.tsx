import AuthGuard from '@/components/AuthGuard'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredRole="any">{children}</AuthGuard>
}
