import type { CSSProperties } from 'react'
import { FrogIcon } from '../components/FrogIcon'
import type { Lane, Phase, Tile } from './pyon'
import { jumpDirection, project, type Motion } from './pyonMotion'
import { PyonBackground } from './PyonBackground'
import frogIdle from '../../assets/game/frog_idle_back.png'
import frogStraight from '../../assets/game/frog_jump_straight.png'
import frogLeft from '../../assets/game/frog_jump_left.png'
import frogRight from '../../assets/game/frog_jump_right.png'
import lilyNormal from '../../assets/game/lily_normal.png'
import lilyHole from '../../assets/game/lily_hole.png'
import lilyKp from '../../assets/game/lily_kp.png'
import lilyHeron from '../../assets/game/lily_enemy_heron.png'

const labels = { safe: 'あんしん', hole: '穴あき', water: 'ハスなし', enemy: '天敵' }
/** Replace these presentation components with image assets without changing game rules. */
export function Lily({ tile }: { tile: Tile }) {
  const src = tile.kind === 'water' ? undefined : tile.kind === 'hole' ? lilyHole
    : tile.kind === 'enemy' ? lilyHeron : tile.kp ? lilyKp : lilyNormal
  return <div className={`pyon-lily pyon-lily--${tile.kind}${src ? ' pyon-lily--image' : ''}`}>
    {src && <img className="pyon-lily-image" src={src} alt="" draggable={false} />}
    <span className="pyon-tile-label">{labels[tile.kind]}</span>
    {tile.kp && <span className="pyon-coin"><FrogIcon size={18} />1 KP</span>}
  </div>
}
export const FROG_ASSETS: Record<string, string | undefined> = {
  frog_idle_back: frogIdle, frog_jump_straight: frogStraight,
  frog_jump_left: frogLeft, frog_jump_right: frogRight,
}
export function FrogPlayer({ pose }: { pose: string }) {
  const src = FROG_ASSETS[pose]
  return src ? <img className="pyon-frog-image" src={src} data-pose={pose} alt="カエル" draggable={false} /> :
    <div className={`pyon-frog pyon-frog--${pose}`} data-pose={pose} role="img" aria-label="後ろ向きのカエル">
      <i className="pyon-frog-leg pyon-frog-leg--left" /><i className="pyon-frog-leg pyon-frog-leg--right" />
      <i className="pyon-frog-back" />
    </div>
}
export function PickupEffect() { return <span className="pyon-pickup">+1 KP</span> }
const safe: Tile = { kind: 'safe', kp: false }
export function PyonField({ runKey, step, stage, nextStage, lane, target, phase, motion, progress, timeMs, picked }: {
  runKey: string; stage: [Tile, Tile]; nextStage: [Tile, Tile]; lane: Lane; target: Lane;
  phase: Phase; motion: Motion; progress: number; timeMs: number; picked: boolean; step: number
}) {
  const camera = motion === 'advance' ? progress * progress * (3 - 2 * progress) : 0
  const origin = project(0, lane)
  const landing = project(1 - camera, target)
  const airborne = motion === 'jump'
  const arrived = ['land', 'advance', 'fall'].includes(motion)
  const t = airborne ? progress : arrived ? 1 : 0
  const x = origin.x + (landing.x - origin.x) * t
  const y = origin.y + (landing.y - origin.y) * t
  const scale = origin.scale + (landing.scale - origin.scale) * t
  const pose = airborne ? `frog_jump_${jumpDirection(lane, target)}` : 'frog_idle_back'
  const pad = (depth: number, side: Lane, tile: Tile, current = false, distant = false) => {
    const point = project(depth - camera, side)
    return <div key={`${depth}-${side}`} className={`pyon-pad ${current ? 'pyon-current' : ''} ${distant ? 'pyon-distant' : ''}`}
      aria-hidden={distant || current ? true : undefined}
      style={{ left: `${point.x}%`, top: `${point.y}%`, transform: `translate(-50%, -50%) scale(${point.scale})`, opacity: depth === 0 || (depth === 1 && side !== target) ? 1 - camera : depth === 4 ? camera * 0.7 : distant ? 0.7 : 1, zIndex: 5 - depth }}>
      <div className="pyon-pad-surface" key={current ? runKey : undefined}><Lily tile={tile} /></div>
    </div>
  }
  return <div className={`pyon-field pyon-field--${phase}`} data-motion={motion} style={{ '--decision-ms': `${timeMs}ms` } as CSSProperties}>
    <PyonBackground step={step} motion={motion} />
    {pad(0, lane, safe, true)}
    {([0, 1] as Lane[]).map(side => pad(1, side, picked && motion !== 'idle' && side === target ? { ...stage[side], kp: false } : stage[side]))}
    {([0, 1] as Lane[]).map(side => pad(2, side, motion === 'advance' ? nextStage[side] : safe, false, motion !== 'advance'))}
    {([0, 1] as Lane[]).map(side => pad(3, side, safe, false, true))}
    {motion === 'advance' && ([0, 1] as Lane[]).map(side => pad(4, side, safe, false, true))}
    <div className="pyon-player" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -100%) translateY(${airborne ? -Math.sin(Math.PI * progress) * 48 : (motion === 'fall' || motion === 'sink') ? progress * 24 : 0}px) scale(${scale})`, opacity: (motion === 'fall' || motion === 'sink') ? 1 - progress * 0.8 : 1 }}>
      <FrogPlayer pose={pose} />
    </div>
    {picked && <PickupEffect key={runKey} />}
    <span className="pyon-water-caption">沈むまえに、次のハスへ！</span>
  </div>
}
