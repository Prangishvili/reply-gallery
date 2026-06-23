'use client'

import { useEffect, useRef } from 'react'
import { getAudioAnalyser } from '@/app/lib/audio-manager'

const BAR_COUNT = 5
const BELL = [0.45, 0.72, 1.0, 0.72, 0.45]
const PHASES = [0, 1.4, 2.8, 4.2, 5.6]

export function AudioBars({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sync = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
    }

    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    sync()

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, w * dpr, h * dpr)
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#000'

      // bar width ~18% of total width, gaps fill the rest
      const barW = w * 0.035
      const gap = (w - barW * BAR_COUNT) / (BAR_COUNT - 1)
      const analyser = getAudioAnalyser()

      for (let i = 0; i < BAR_COUNT; i++) {
        let frac: number

        if (!playing) {
          frac = BELL[i] * 0.25
        } else if (analyser) {
          const data = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(data)
          const maxBin = Math.floor(analyser.frequencyBinCount * 0.25)
          const bin = Math.floor((i / BAR_COUNT) * maxBin)
          // blend real data with bell shape so it stays visually balanced
          frac = BELL[i] * Math.max(0.15, data[bin] / 255)
        } else {
          const t = Date.now() / 450
          frac = BELL[i] * (0.3 + 0.5 * Math.abs(Math.sin(t + PHASES[i])))
        }

        const bh = Math.max(2, frac * h)
        const x = i * (barW + gap)
        const y = (h - bh) / 2
        ctx.fillRect(x, y, barW, bh)
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [playing])

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
}
