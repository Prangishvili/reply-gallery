export type SavedCircleCam = { x: number; y: number; z: number; zoom: number }
let _state: SavedCircleCam | null = null
export const saveCircleCam = (s: SavedCircleCam) => { _state = s }
export const getCircleCam = (): SavedCircleCam | null => _state
