'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setSharedAudioCtx } from '@/app/lib/shared-audio-ctx'
import { markAudioGatePassed } from '@/app/lib/audio-gate'

export default function IntroPage() {
  const router = useRouter()
  const [replyFrame, setReplyFrame] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const id = setInterval(() => setReplyFrame(f => (f + 1) % 3), 250)
    return () => clearInterval(id)
  }, [])

  function unlockAudioContext(sound: boolean) {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') return
    try {
      const ctx = new AudioContext()
      const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
      const audio = new Audio(SILENCE)
      audio.crossOrigin = 'anonymous'
      audio.volume = 0
      audio.play().catch(() => {})
      bgAudioRef.current = audio
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      const gain = ctx.createGain()
      gain.gain.value = sound ? 0.5 : 0
      source.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)
      audioCtxRef.current = ctx
      setSharedAudioCtx(ctx)
      ctx.resume().catch(() => {})
    } catch {}
  }

  function handleChoice(withSound: boolean) {
    try { sessionStorage.setItem('reply_sound', withSound ? 'true' : 'false') } catch {}
    markAudioGatePassed()
    unlockAudioContext(withSound)
    router.push('/')
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff' }}>
      {/* full-screen gradient blob */}
      <div style={{
        position: 'absolute', right: '2%', bottom: '10%',
        width: '50%', height: '70%',
        background: 'radial-gradient(ellipse at 60% 60%, rgba(210,155,165,0.45) 0%, rgba(185,145,175,0.25) 35%, transparent 68%)',
        filter: 'blur(55px)',
        pointerEvents: 'none',
      }} />
      {/* REPLY svg */}
      <div style={{ flex: 1, width: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={['/reply.svg', '/reply1.svg', '/reply2.svg'][replyFrame]} alt="REPLY" style={{ width: '88%', height: 'auto', position: 'relative' }} />
      </div>
      {/* buttons */}
      <div style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, textAlign: 'center', paddingLeft: 24, paddingRight: 24 }}>
        <p style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.12em', lineHeight: 1.8, color: 'rgba(0,0,0,0.55)', maxWidth: 420, margin: 0, textTransform: 'uppercase' }}>
          This is an interactive audio and visual experience, so we recommend keeping your sound on
        </p>
        <button
          onClick={() => handleChoice(true)}
          style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.75)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >START YOUR EXPERIENCE</button>
        <button
          onClick={() => handleChoice(false)}
          style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >SOUND OFF</button>
      </div>
    </div>
  )
}
