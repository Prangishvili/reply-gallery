'use client'

import { useEffect, useState } from 'react'
import { supabase, type VisitorPost } from '@/lib/supabase'

const IMAGE_W = 613
const IMAGE_H = 753
const INFO_H = 157

export default function GalleryPage() {
  const [posts, setPosts] = useState<VisitorPost[]>([])

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
    <div style={{ height: '100vh', overflowY: 'auto', background: '#fff', padding: '40px 40px 80px', fontFamily: 'var(--font-dm-mono)', cursor: 'default' }}>
      <style>{`*, *::before, *::after { cursor: default !important; } button, a { cursor: pointer !important; }`}</style>

      {/* Title */}
      <h1 style={{ textAlign: 'center', letterSpacing: '0.5em', fontWeight: 300, fontSize: 32, color: '#222', marginBottom: 48, marginTop: 8 }}>
        R E P L Y
      </h1>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
        {posts.map(post => (
          <div key={post.id}>

            {/* Image card */}
            <div style={{ aspectRatio: `${IMAGE_W} / ${IMAGE_H}`, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden' }}>
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
    </div>
  )
}
