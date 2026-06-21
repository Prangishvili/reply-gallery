'use client'

import { useEffect, useState, useCallback } from 'react'
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
    <div style={{ height: '100vh', overflowY: 'auto', background: '#fff', padding: '140px 20px 80px', fontFamily: 'var(--font-dm-mono)', cursor: 'default' }}>
      <style>{`*, *::before, *::after { cursor: default !important; } button, a, .clickable { cursor: pointer !important; }`}</style>

      {/* Logo — centered, same as CIRCLE */}
      <div style={{ position: 'fixed', top: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', userSelect: 'none' }}>
        <img src="/logo.svg" alt="Reply" style={{ height: 48, width: 'auto' }} />
      </div>

      {/* Left nav — ABOUT */}
      <button
        onClick={() => setShowAbout(v => !v)}
        style={{ position: 'fixed', top: 24, left: 24, zIndex: 60, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5, padding: 0, border: 'none', background: 'transparent', textTransform: 'uppercase', cursor: 'pointer', color: 'rgb(0,0,0)', transition: 'color 0.15s' }}
      >
        {showAbout ? 'close' : 'about'}
      </button>

      {/* Right nav — MAKE */}
      <a
        href="/make"
        style={{ position: 'fixed', top: 24, right: 16, zIndex: 20, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5, padding: 0, border: 'none', background: 'transparent', textTransform: 'uppercase', textDecoration: 'none', color: 'rgba(0,0,0,0.3)', transition: 'color 0.15s' }}
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
        <p style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(0,0,0,0.3)', fontSize: 11, letterSpacing: '0.2em', margin: 0 }}>
          LOADING ARTWORKS
        </p>
      )}

      {/* About overlay */}
      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 40px' }}
        >
          <div onClick={e => e.stopPropagation()} className="about-scroll" style={{ maxWidth: 720, width: '100%', maxHeight: '100%', overflowY: 'auto', paddingRight: 28 }}>
            <p style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2, color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em', whiteSpace: 'pre-line' }}>{`"The action of being is so revolutionary that society rejects it and concerns itself exclusively with the action of becoming."

— Jiddu Krishnamurti

REPLY is a collaborative work by students of the Free University of Georgia, a meditation on digital identity, performed selfhood, and what gets lost in translation.

Every platform demands a different version of us. The visual self. The political self. The one who informs, the one who entertains. Collectively, they account for everything except the self that simply exists.

In search of the self, each student developed their own writing system, a personal visual language designed not for legibility, but for honesty. Something to be felt rather than decoded.

REPLY is a virtual art exhibition that abandons natural language as its framework, presenting each participant through a visual representation that resists performance and asks, instead, for presence.

Visitors are also invited to construct their own version, to reply, and in that act, to consider what genuine dialogue between selves might actually look like, to say what they truly feel, without being observed, evaluated, or judged. Only felt.`}</p>
            <img src="/credits.png" alt="Student signatures" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '32px auto', mixBlendMode: 'multiply' }} />
            <p style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2, color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em', whiteSpace: 'pre-line' }}>{`Students\nMariam Wulaia, Nodar Gogichaishvili, Dominika Davshrishovi, Salome Shalvashvili, Nutsa Kavtelishvili, Ketevan Lomiashvili, Mariam Qsovreli, Ana Mamniashvili, Bako Shengelia, Sergi Sarajevi, Natali Chixelidze\n\nLecturer\nOto Prangishvili`}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0 8px' }}>
              <img src="/FREEUNI.svg" alt="Free University of Georgia" style={{ height: 48, width: 'auto', display: 'block' }} />
              <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2, color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em' }}>Free University of Georgia</span>
            </div>
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
