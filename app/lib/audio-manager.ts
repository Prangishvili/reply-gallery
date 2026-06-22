// Module-level singleton — survives client-side navigations.
// Initialized once when the user makes their sound choice on /intro.

let _ctx: AudioContext | null = null
let _audio: HTMLAudioElement | null = null
let _analyser: AnalyserNode | null = null
let _gain: GainNode | null = null

export function initAudioManager(ctx: AudioContext) {
  if (_ctx && _ctx.state !== 'closed') return
  _ctx = ctx
  try {
    _audio = new Audio()
    _audio.crossOrigin = 'anonymous'
    const source = ctx.createMediaElementSource(_audio)
    _analyser = ctx.createAnalyser()
    _analyser.fftSize = 256
    _analyser.smoothingTimeConstant = 0.8
    _gain = ctx.createGain()
    _gain.gain.value = 0.7
    source.connect(_analyser)
    _analyser.connect(_gain)
    _gain.connect(ctx.destination)
  } catch {}
}

export function playAudio(url: string, onEnded: () => void) {
  if (!_audio || !_ctx) return
  _audio.onended = onEnded
  if (_audio.src !== url) _audio.src = url
  _ctx.resume().then(() => _audio!.play().catch(() => {})).catch(() => {})
}

export function pauseAudio() {
  _audio?.pause()
}

export function getAudioAnalyser(): AnalyserNode | null {
  return _analyser
}

export function isAudioManagerReady(): boolean {
  return !!_ctx && _ctx.state !== 'closed'
}
