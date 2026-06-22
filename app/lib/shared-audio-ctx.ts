// Module-level singleton so an AudioContext unlocked on /intro survives
// client-side navigation and can be reused by the gallery.

let _ctx: AudioContext | null = null

export function setSharedAudioCtx(ctx: AudioContext) {
  _ctx = ctx
}

export function getSharedAudioCtx(): AudioContext | null {
  return _ctx && _ctx.state !== 'closed' ? _ctx : null
}
