'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type VisitorPost } from '@/lib/supabase'

const IMAGE_W = 613
const IMAGE_H = 753
const INFO_H = 157

export default function GalleryPage() {
  const [posts, setPosts] = useState<VisitorPost[]>([])
  const [preview, setPreview] = useState<VisitorPost | null>(null)

  const closePreview = useCallback(() => setPreview(null), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePreview() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePreview])

  useEffect(() => {
    supabase
      .from('visitor_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => { if (data) setPosts(data) })
  }, [])

  const handleShare = (post: VisitorPost) => {
    const url = `${window.location.origin}/gallery?post=${post.id}`
    navigator.share?.({ url }) ?? navigator.clipboard?.writeText(url)
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#fff', padding: '80px 20px 80px', fontFamily: 'var(--font-dm-mono)', cursor: 'default' }}>
      <style>{`*, *::before, *::after { cursor: default !important; } button, a, .clickable { cursor: pointer !important; }`}</style>

      {/* Logo — centered, same as CIRCLE */}
      <div style={{ position: 'fixed', top: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', userSelect: 'none' }}>
        <img src="/logo.svg" alt="Reply" style={{ height: 48, width: 'auto' }} />
      </div>

      {/* Left nav — ABOUT, same position as CIRCLE */}
      <a
        href="/"
        style={{ position: 'fixed', top: 24, left: 24, zIndex: 20, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', textDecoration: 'none', transition: 'color 0.15s' }}
      >
        about
      </a>

      {/* Right nav — MAKE, same position as ROOM/CIRCLE/SELF in CIRCLE */}
      <a
        href="/make"
        style={{ position: 'fixed', top: 24, right: 16, zIndex: 20, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)', textDecoration: 'none', transition: 'color 0.15s' }}
      >
        make
      </a>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {posts.map(post => (
          <div key={post.id}>

            {/* Image card */}
            <div onClick={() => setPreview(post)} style={{ aspectRatio: `${IMAGE_W} / ${IMAGE_H}`, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
              {/* Watermark */}
              <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', letterSpacing: '0.35em', fontSize: 11, color: 'rgba(0,0,0,0.12)', fontWeight: 400, pointerEvents: 'none', zIndex: 1 }}>
                R E P L Y &nbsp; G A L L E R Y
              </div>
              {post.image_url
                ? <img src={post.image_url} alt={post.visitor_name ?? ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ position: 'absolute', inset: 0, background: '#f9f9f9' }} />
              }
            </div>

            {/* Info section */}
            <div style={{ minHeight: INFO_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 0', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              {post.visitor_name && (
                <span style={{ fontSize: 11, letterSpacing: '0.15em', color: '#333', textTransform: 'uppercase' }}>
                  {post.visitor_name}
                </span>
              )}
              <button
                onClick={() => handleShare(post)}
                style={{ background: 'none', border: 'none', fontSize: 11, letterSpacing: '0.15em', color: '#555', cursor: 'pointer', textTransform: 'uppercase', padding: 0 }}
              >
                SHARE
              </button>
              <a
                href="/"
                style={{ fontSize: 11, letterSpacing: '0.15em', color: '#555', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                REPLY
              </a>
            </div>

          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <p style={{ textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: 11, letterSpacing: '0.2em', marginTop: 80 }}>
          NO ENTRIES YET
        </p>
      )}

      {/* Full-screen preview */}
      {preview && (
        <div
          onClick={closePreview}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, gap: 20 }}
        >
          <img
            src={preview.image_url}
            alt={preview.visitor_name ?? ''}
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '85vh', maxWidth: '90vw', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {preview.visitor_name && (
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                {preview.visitor_name}
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)' }}>
              ESC TO CLOSE
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
