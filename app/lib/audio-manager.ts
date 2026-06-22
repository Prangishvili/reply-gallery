// Module-level singleton — survives client-side navigations.
// Initialized once when the user makes their sound choice on /intro.

let _ctx: AudioContext | null = null
let _audio: HTMLAudioElement | null = null
let _analyser: AnalyserNode | null = null
let _gain: GainNode | null = null
let _readyCallbacks: Array<(analyser: AnalyserNode) => void> = []

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
    const a = _analyser
    _readyCallbacks.forEach(cb => cb(a))
    _readyCallbacks = []
  } catch {}
}

// Calls cb immediately if analyser exists, otherwise queues it for when it's ready
export function onAudioReady(cb: (analyser: AnalyserNode) => void): () => void {
  if (_analyser) { cb(_analyser); return () => {} }
  _readyCallbacks.push(cb)
  return () => { _readyCallbacks = _readyCallbacks.filter(c => c !== cb) }
}

function lazyInit() {
  if (_ctx && _ctx.state !== 'closed') return
  try {
    const ctx = new AudioContext()
    initAudioManager(ctx)
    ctx.resume().catch(() => {})
  } catch {}
}

export function playAudio(url: string, onEnded: () => void) {
  lazyInit()
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
