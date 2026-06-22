// In-memory flag — resets on full page reload/new tab, persists across client-side navigations.
let _passed = false
export const markAudioGatePassed = () => { _passed = true }
export const hasPassedAudioGate = () => _passed
