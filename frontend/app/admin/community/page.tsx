'use client'

import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getOptimizedUrl } from '@/lib/cloudinary'
import { FeedSkeleton } from '@/components/Skeleton'

const API = process.env.NEXT_PUBLIC_API_URL

interface Comment {
  id: string
  post_id: string
  author_email: string
  author_name: string
  content: string
  created_at: string
}

interface Post {
  id: string
  author_email: string
  author_name: string
  content: string
  image_url?: string | null
  created_at: string
  comments: Comment[]
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CommunityModerationPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'comment'; postId: string; commentId?: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) setToken(await user.getIdToken())
    })
    return unsub
  }, [])

  const fetchPosts = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`${API}/community/`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) setPosts(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchPosts(token)
  }, [token, fetchPosts])

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'post') {
        await fetch(`${API}/community/${deleteTarget.postId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        await fetch(`${API}/community/${deleteTarget.postId}/comments/${deleteTarget.commentId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      setDeleteTarget(null)
      await fetchPosts(token)
    } finally {
      setDeleting(false)
    }
  }

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      next.has(postId) ? next.delete(postId) : next.add(postId)
      return next
    })
  }

  const filtered = posts.filter(p =>
    `${p.author_name} ${p.content}`.toLowerCase().includes(search.toLowerCase())
  )
  const totalComments = posts.reduce((acc, p) => acc + p.comments.length, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Community</h2>
          <p className="text-sm text-gray-500">{posts.length} posts · {totalComments} comments</p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search posts by author or content..."
          className="w-full max-w-sm bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
          style={{ padding: '0.6rem 1rem' }}
        />
      </div>

      {loading ? (
        <FeedSkeleton items={3} withImage />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(post => (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm" style={{ padding: '1.5rem' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {getInitials(post.author_name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{post.author_name}</p>
                    <p className="text-xs text-gray-400">{formatTime(post.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget({ type: 'post', postId: post.id, label: `post by ${post.author_name}` })}
                  className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition flex-shrink-0"
                  style={{ padding: '0.3rem 0.75rem' }}
                >
                  Delete Post
                </button>
              </div>

              <div className="text-sm text-gray-700 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: post.content }} />

              {post.image_url && (
                <img src={getOptimizedUrl(post.image_url, { width: 600 })} alt="Post" loading="lazy" className="rounded-xl w-full object-cover mb-3" style={{ maxHeight: '240px' }} />
              )}

              <div className="border-t border-gray-100" style={{ paddingTop: '0.875rem' }}>
                <button onClick={() => toggleComments(post.id)} className="text-xs font-medium text-gray-500 hover:text-gray-800 transition">
                  {expandedComments.has(post.id) ? 'Hide comments' : `${post.comments.length === 0 ? 'No' : post.comments.length} comment${post.comments.length !== 1 ? 's' : ''}`}
                </button>

                {expandedComments.has(post.id) && (
                  <div className="flex flex-col gap-3" style={{ marginTop: '0.875rem' }}>
                    {post.comments.length === 0 && <p className="text-xs text-gray-400">No comments yet.</p>}
                    {post.comments.map(comment => (
                      <div key={comment.id} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold flex-shrink-0">
                            {getInitials(comment.author_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-gray-800">{comment.author_name}</span>
                              <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteTarget({ type: 'comment', postId: post.id, commentId: comment.id, label: `comment by ${comment.author_name}` })}
                          className="text-xs font-medium text-red-400 hover:text-red-600 flex-shrink-0 transition"
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>No posts found.</div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Content</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this <span className="font-semibold text-gray-900">{deleteTarget.label}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition" style={{ padding: '0.6rem 1.25rem' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50" style={{ padding: '0.6rem 1.25rem' }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
