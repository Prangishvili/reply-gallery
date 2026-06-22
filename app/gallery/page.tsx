'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, type VisitorPost } from '@/lib/supabase'

const IMAGE_W = 613
const IMAGE_H = 753
const INFO_H = 157

export default function GalleryPage() {
  const [posts, setPosts] = useState<VisitorPost[]>([])
  const [preview, setPreview] = useState<VisitorPost | null>(null)
  const [showAbout, setShowAbout] = useState(false)

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
    <div style={{ height: '100vh', overflowY: 'auto', background: '#fff', padding: '70px 20px 120px', fontFamily: 'var(--font-dm-mono)', cursor: 'default', scrollbarWidth: 'none' }}>
      <style>{`*, *::before, *::after { cursor: default !important; } button, a, .clickable { cursor: pointer !important; } ::-webkit-scrollbar { display: none; }`}</style>

      {/* Logo — bottom center */}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', userSelect: 'none' }}>
        <img src="/logo.svg" alt="Reply" style={{ height: 64, width: 'auto' }} />
      </div>

      {/* Top left nav — REPLY, GALLERY, ARTISTS */}
      <div style={{ position: 'fixed', top: 24, left: 24, zIndex: 60, display: 'flex', gap: 24 }}>
        {([['REPLY', '/circle'], ['GALLERY', '/gallery'], ['ARTISTS', '/room'], ['CREATE', '/make']] as const).map(([label, href]) => (
          <Link
            key={label}
            href={href}
            style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none', color: 'rgba(0,0,0,0.75)', transition: 'color 0.15s' }}
          >{label}</Link>
        ))}
      </div>

      {/* Top right — ABOUT */}
      <button
        onClick={() => setShowAbout(v => !v)}
        style={{ position: 'fixed', top: 24, right: 20, zIndex: 60, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5, padding: 0, border: 'none', background: 'transparent', textTransform: 'uppercase', cursor: 'pointer', color: 'rgb(0,0,0)', transition: 'color 0.15s' }}
      >
        {showAbout ? 'close' : 'about'}
      </button>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {posts.map(post => (
          <div key={post.id}>

            {/* Image card */}
            <div onClick={() => setPreview(post)} style={{ aspectRatio: `${IMAGE_W} / ${IMAGE_H}`, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
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
              <Link
                href="/circle"
                style={{ fontSize: 11, letterSpacing: '0.15em', color: '#555', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                REPLY
              </Link>
            </div>

          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <p style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(0,0,0,0.3)', fontSize: 11, letterSpacing: '0.2em', margin: 0 }}>
          LOADING ARTWORKS
        </p>
      )}

      {/* About overlay */}
      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div onClick={e => e.stopPropagation()} className="about-scroll" style={{ maxWidth: 800, width: '100%', maxHeight: '100%', overflowY: 'auto', paddingRight: 28 }}>
            <p style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2, color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em', whiteSpace: 'pre-line', textTransform: 'uppercase' }}>{`REPLY is a collaborative work by 12 artists, a meditation on digital identity, the selves we perform, and what gets lost along the way.

There are no words here. Instead, each person is shown through a visual code, each shaped from the artist's own understanding of language, not to be read, but to be seen and be felt.

Visitors are invited to make their own version, to REPLY and to explore the idea of visual dialogue, testing the limits of natural language, and watching the concept through the act itself.

Artists
Mariam Wulaia, Nodar Gogichaishvili, Dominika Davrishovi, Salome Shalvashvili, Nutsa Kavtelishvili, Ketevan Lomiashvili, Mariam Qsovreli, Ana Mamniashvili, Bako Shengelia, Sergi Sarajevi, and Natali Chikhelidze`}</p>
            <p style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2, color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em', whiteSpace: 'pre-line', textTransform: 'uppercase', marginTop: 24 }}>{`VA[A]DS — Visual Art, Architecture, and Design School

Free University of Georgia

Music by Chris Zabriskie

Project Lead by Oto Prangishvili`}</p>
            <img src="/credits.png" alt="Artist signatures" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '32px 0', mixBlendMode: 'multiply' }} />
            <p style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2, color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em', whiteSpace: 'pre-line', textTransform: 'uppercase', marginTop: 8 }}><a href="mailto:o.prangishvili@freeuni.edu.ge" style={{ color: 'rgba(0,0,0,0.75)', textDecoration: 'underline' }}>CONTACT US</a></p>
          </div>
        </div>
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
