'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

const PAGE_SIZE = 20

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [myEmail, setMyEmail] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)

  const [isEmpty, setIsEmpty] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [posting, setPosting] = useState(false)

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<{ [id: string]: string }>({})
  const [commentPosting, setCommentPosting] = useState<string | null>(null)
  const [deletingComment, setDeletingComment] = useState<string | null>(null)
  const [reportModal, setReportModal] = useState<{ type: 'post' | 'comment'; postId: string; commentId?: string } | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportSending, setReportSending] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tok = await user.getIdToken()
        setToken(tok)
        const meRes = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } })
        if (meRes.ok) {
          const me = await meRes.json()
          setMyEmail(me.email)
          setMyRole(me.role)
        }
      }
    })
    return unsub
  }, [])

  const fetchPosts = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`${API}/community/?skip=0&limit=${PAGE_SIZE}`, { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) {
        const data: Post[] = await res.json()
        setPosts(data)
        setHasMore(data.length === PAGE_SIZE)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = async () => {
    if (!token || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`${API}/community/?skip=${posts.length}&limit=${PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: Post[] = await res.json()
        setPosts(prev => [...prev, ...data])
        setHasMore(data.length === PAGE_SIZE)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (token) fetchPosts(token)
  }, [token, fetchPosts])

  const handleFormat = (command: string) => {
    document.execCommand(command, false)
    editorRef.current?.focus()
  }

  const handleInput = () => {
    setIsEmpty(!editorRef.current?.innerText?.trim())
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setSelectedImage(URL.createObjectURL(file))
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', uploadPreset!)
      formData.append('folder', 'community')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedImage(data.secure_url)
      }
    } catch { /* keep local preview */ } finally {
      setUploadingImage(false)
    }
  }

  const handlePost = async () => {
    if (!token) return
    const content = editorRef.current?.innerHTML?.trim()
    if (!content) return
    setPosting(true)
    try {
      const res = await fetch(`${API}/community/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, image_url: selectedImage }),
      })
      if (res.ok) {
        if (editorRef.current) editorRef.current.innerHTML = ''
        setSelectedImage(null)
        setIsEmpty(true)
        await fetchPosts(token)
      }
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!token) return
    setOpenMenuId(null)
    await fetch(`${API}/community/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchPosts(token)
  }

  const handleAddComment = async (postId: string) => {
    if (!token) return
    const text = commentInputs[postId]?.trim()
    if (!text) return
    setCommentPosting(postId)
    try {
      const res = await fetch(`${API}/community/${postId}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
        await fetchPosts(token)
      }
    } finally {
      setCommentPosting(null)
    }
  }

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!token) return
    setDeletingComment(commentId)
    try {
      await fetch(`${API}/community/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
      ))
    } finally {
      setDeletingComment(null)
    }
  }

  const canDelete = (post: Post) =>
    post.author_email === myEmail || myRole === 'coach' || myRole === 'trainer'

  const canDeleteComment = (comment: Comment) =>
    comment.author_email === myEmail || myRole === 'coach' || myRole === 'trainer'

  const openReport = (type: 'post' | 'comment', postId: string, commentId?: string) => {
    setReportReason('')
    setReportSent(false)
    setReportModal({ type, postId, commentId })
    setOpenMenuId(null)
  }

  const submitReport = async () => {
    if (!token || !reportModal) return
    setReportSending(true)
    try {
      const url = reportModal.type === 'post'
        ? `${API}/community/${reportModal.postId}/report`
        : `${API}/community/${reportModal.postId}/comments/${reportModal.commentId}/report`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason.trim() || null }),
      })
      if (res.status === 409) { setReportSent(true); return } // already reported — still show success
      if (res.ok) setReportSent(true)
    } finally {
      setReportSending(false)
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-3xl px-4" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>

        {/* Create Post Box */}
        <div className="bg-white rounded-2xl shadow-sm" style={{ padding: '1.25rem 1.5rem' }}>
          <div className="relative">
            {isEmpty && (
              <span className="absolute top-0 left-0 text-gray-400 text-sm pointer-events-none" style={{ padding: '0.75rem 1rem' }}>
                Share your fitness journey!
              </span>
            )}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              className="w-full bg-gray-100 rounded-xl text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 text-sm min-h-[6rem]"
              style={{ padding: '0.75rem 1rem' }}
              suppressContentEditableWarning
            />
          </div>

          {selectedImage && (
            <div className="relative mt-4">
              <img src={selectedImage} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
              <button onClick={() => setSelectedImage(null)} className="absolute top-2 right-2 bg-gray-800 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-gray-900 transition">✕</button>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-200" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Photo
              </button>
              <div className="w-px h-4 bg-gray-300" />
              <button onMouseDown={(e) => { e.preventDefault(); handleFormat('bold') }} className="w-7 h-7 flex items-center justify-center rounded-lg font-bold text-gray-600 hover:bg-gray-100 transition text-sm">B</button>
              <button onMouseDown={(e) => { e.preventDefault(); handleFormat('italic') }} className="w-7 h-7 flex items-center justify-center rounded-lg italic text-gray-600 hover:bg-gray-100 transition text-sm">I</button>
              <button onMouseDown={(e) => { e.preventDefault(); handleFormat('underline') }} className="w-7 h-7 flex items-center justify-center rounded-lg underline text-gray-600 hover:bg-gray-100 transition text-sm">U</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <button onClick={handlePost} disabled={isEmpty || uploadingImage || posting} className="bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition" style={{ padding: '0.6rem 2rem', fontSize: '0.95rem' }}>
              {uploadingImage ? 'Uploading...' : posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        <hr className="border-gray-300" style={{ marginTop: '2rem', marginBottom: '2.5rem' }} />

        {loading ? (
          <FeedSkeleton items={3} withImage />
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-400 text-sm" style={{ padding: '3rem' }}>No posts yet. Be the first to share!</div>
        ) : (
          <div className="flex flex-col gap-6" onClick={() => setOpenMenuId(null)}>
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm" style={{ padding: '1.5rem' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {post.author_name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{post.author_name}</p>
                      <p className="text-xs text-gray-400">{formatTime(post.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Report button — members only (coaches just delete directly) */}
                    {myRole === 'member' && post.author_email !== myEmail && (
                      <button
                        onClick={() => openReport('post', post.id)}
                        className="text-gray-300 hover:text-orange-400 transition p-1.5 rounded-lg hover:bg-gray-100"
                        title="Report post"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </button>
                    )}
                    {canDelete(post) && (
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100">
                          ···
                        </button>
                        {openMenuId === post.id && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[140px]">
                            <button onClick={() => handleDelete(post.id)} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gray-50 rounded-xl transition">
                              Delete Post
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-gray-800 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: post.content }} />

                {post.image_url && (
                  <img src={getOptimizedUrl(post.image_url, { width: 800 })} alt="Post" loading="lazy" className="mt-4 w-full max-h-96 object-cover rounded-xl" />
                )}

                <div className="mt-4 border-t border-gray-100" style={{ paddingTop: '1rem' }}>
                  {post.comments.length > 0 && (
                    <div className="flex flex-col gap-3 mb-4">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-2 group">
                          <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                            {comment.author_name[0].toUpperCase()}
                          </div>
                          <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800 flex-1">
                            <span className="font-semibold">{comment.author_name} </span>
                            {comment.content}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0 mt-1">
                            {myRole === 'member' && comment.author_email !== myEmail && (
                              <button
                                onClick={() => openReport('comment', post.id, comment.id)}
                                className="text-gray-300 hover:text-orange-400 transition"
                                title="Report comment"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                              </button>
                            )}
                            {canDeleteComment(comment) && (
                              <button
                                onClick={() => handleDeleteComment(post.id, comment.id)}
                                disabled={deletingComment === comment.id}
                                className="text-gray-300 hover:text-red-400 transition text-xs disabled:opacity-50"
                              >
                                {deletingComment === comment.id ? '...' : '✕'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                      {myEmail?.[0]?.toUpperCase() ?? 'Y'}
                    </div>
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentInputs[post.id] || ''}
                      onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                      className="flex-1 bg-gray-100 rounded-full text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
                      style={{ padding: '0.5rem 1rem' }}
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!commentInputs[post.id]?.trim() || commentPosting === post.id}
                      className="text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-40 transition"
                    >
                      {commentPosting === post.id ? '...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full text-sm font-medium text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-2xl transition disabled:opacity-50"
                style={{ padding: '0.875rem' }}
              >
                {loadingMore ? 'Loading...' : 'Load more posts'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ padding: '2rem' }}>
            {reportSent ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900">Report submitted</p>
                <p className="text-xs text-gray-400 text-center">Our team will review it shortly.</p>
                <button onClick={() => setReportModal(null)} className="mt-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition">Close</button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-gray-900 mb-1">Report {reportModal.type === 'post' ? 'Post' : 'Comment'}</h3>
                <p className="text-xs text-gray-400 mb-5">Let us know why this content is inappropriate. Our coaches will review it.</p>
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
                  <textarea
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    placeholder="e.g. Offensive language, spam, harassment..."
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setReportModal(null)} disabled={reportSending}
                    className="text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                    style={{ padding: '0.6rem 1.25rem' }}>
                    Cancel
                  </button>
                  <button onClick={submitReport} disabled={reportSending}
                    className="text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition disabled:opacity-50"
                    style={{ padding: '0.6rem 1.25rem' }}>
                    {reportSending ? 'Sending...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
