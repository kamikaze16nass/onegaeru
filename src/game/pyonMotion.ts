import type { Lane } from './pyon'

export type Motion = 'idle' | 'jump' | 'land' | 'advance' | 'fall' | 'sink'
export const JUMP_MS = 300
export const ADVANCE_MS = 180
export const LAND_MS = 45
export const FALL_MS = 180
export const jumpDirection = (from: Lane, to: Lane) => from === to ? 'straight' : to === 0 ? 'left' : 'right'

/** Same projection for pads and frog, so landing and camera travel stay aligned. */
export const CAMERA = { sizeRatio: 0.70, sizeDepthPower: 1.2, laneRatio: 0.60, depthRatio: 0.54, horizon: 10, nearY: 82, laneSpread: 25, farLift: 1, farShrink: 0.08 } as const
export function project(depth: number, lane: Lane) {
  const scale = Math.pow(CAMERA.sizeRatio, Math.sign(depth) * Math.pow(Math.abs(depth), CAMERA.sizeDepthPower))
  // Ease the farthest pair back into the unchanged middle row during forward travel.
  const far = Math.min(1, Math.max(0, depth - 2))
  const farBlend = far * far * (3 - 2 * far)
  return {
    x: 50 + (lane === 0 ? -1 : 1) * CAMERA.laneSpread * Math.pow(CAMERA.laneRatio, depth),
    y: CAMERA.horizon + (CAMERA.nearY - CAMERA.horizon) * Math.pow(CAMERA.depthRatio, depth) - CAMERA.farLift * farBlend,
    scale: scale * (1 - CAMERA.farShrink * farBlend),
  }
}
