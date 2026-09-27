import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ADVANCE_MS, type Motion } from './pyonMotion'
import water from '../../assets/game/backgrounds/pond_water.png'
import farBackground from '../../assets/game/backgrounds/pond_far_background.png'
import leftA from '../../assets/game/backgrounds/bank_left_a.png'
import leftB from '../../assets/game/backgrounds/bank_left_b.png'

export const PERSPECTIVE_TOP_SCALE = 0.87
export const RIGHT_BANK_PHASE_OFFSET = 0.35
export const BACKGROUND = {
  bankWidth: 0.26,
  bankStep: 44,
  waterStep: 18,
  duration: ADVANCE_MS,
  topScale: PERSPECTIVE_TOP_SCALE,
  imageAspect: 2, // Water and bank tiles are 1:2; keep full images joined vertically.
  farHeight: 34,
  blendStart: 12,
  farSideFadeStart: 35, // Percent of the far image's height, not the field.
  farSideFadeEnd: 70,
  farCenterInset: 26,
  bankFadeStart: 12,
  bankFadeMiddle: 18,
  bankFadeEnd: 24,
  bankFadeOpacity: 0.75,
} as const

// Stable complementary sequences. A tile's image never changes while visible.
function bankVariant(index: number, side: 'left' | 'right') {
  let hash = (index + 127) | 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  const left = (hash ^ (hash >>> 16)) & 1
  return side === 'left' ? left : 1 - left
}

function Strip({ kind, width, height, step, advancing }: {
  kind: 'water' | 'left' | 'right'; width: number; height: number; step: number; advancing: boolean
}) {
  const tileHeight = width * BACKGROUND.imageAspect
  const movement = kind === 'water' ? BACKGROUND.waterStep : BACKGROUND.bankStep
  const distance = step * movement + (kind === 'right' ? tileHeight * RIGHT_BANK_PHASE_OFFSET : 0)
  const first = Math.floor(distance / tileHeight)
  const offset = distance - first * tileHeight
  const tiles = Math.ceil(height / tileHeight) + Math.ceil(movement / tileHeight) + 3
  return <div className={`pyon-bg-strip pyon-bg-strip--${kind}`}>
    <div key={`${step}-${advancing}`} className={`pyon-bg-travel${advancing ? ' pyon-bg-travel--advance' : ''}`}
      style={{ '--bg-from': `${offset}px`, '--bg-to': `${offset + movement}px` } as CSSProperties}>
      {Array.from({ length: tiles }, (_, i) => {
        const index = first + i - Math.ceil(height / tileHeight) - 1
        const src = kind === 'water' ? water : [leftA, leftB][bankVariant(index, kind)]
        return <img key={index} data-tile={index} src={src} alt="" draggable={false}
          style={{ top: (first - index - 1) * tileHeight, width, height: tileHeight }} />
      })}
    </div>
  </div>
}

/** Independent presentation layer; no timers, RNG, input or game-state writes. */
export const PyonBackground = memo(function PyonBackground({ step, motion }: { step: number; motion: Motion }) {
  const root = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  const inset = size.width * (1 - BACKGROUND.topScale) / 2
  // Whole CSS pixels keep adjacent 1:2 tiles on the same raster boundary.
  const bankWidth = Math.round(size.width * BACKGROUND.bankWidth)
  // Project the joined plane around its outer bottom edge. The outer edge stays
  // at x=0 throughout: no negative right offset and no cropped outer artwork.
  const expansion = bankWidth ? 1 + inset / bankWidth : 1
  const vertical = 1 / expansion
  const perspective = size.height ? (1 - vertical) / size.height : 0
  const advancing = motion === 'advance'
  return <div ref={root} className="pyon-background" aria-hidden="true"
    style={{ '--bg-duration': `${BACKGROUND.duration}ms`, '--far-height': `${BACKGROUND.farHeight}%`, '--far-blend-start': `${BACKGROUND.blendStart}%`,
      '--far-side-start': `${BACKGROUND.farSideFadeStart}%`, '--far-side-end': `${BACKGROUND.farSideFadeEnd}%`, '--far-center-inset': `${BACKGROUND.farCenterInset}%`,
      '--bank-fade-start': `${BACKGROUND.bankFadeStart}%`, '--bank-fade-middle': `${BACKGROUND.bankFadeMiddle}%`, '--bank-fade-end': `${BACKGROUND.bankFadeEnd}%`, '--bank-fade-opacity': BACKGROUND.bankFadeOpacity,
    } as CSSProperties}>
    {size.width > 0 && <>
      <Strip kind="water" width={size.width} height={size.height} step={step} advancing={advancing} />
      <div className="pyon-far-layer"><img className="pyon-far-background" src={farBackground} alt="" draggable={false} /></div>
      <div className="pyon-bank-layer">{(['left', 'right'] as const).map(side => <div key={side} className={`pyon-bank-plane pyon-bank-plane--${side}`}
        style={{ width: bankWidth, [side]: 0, transformOrigin: `${side} bottom`, transform: `matrix3d(1,0,0,0,0,${vertical},0,${perspective},0,0,1,0,0,0,0,1)` }}>
        <Strip kind={side} width={bankWidth} height={size.height} step={step} advancing={advancing} />
      </div>)}</div>
    </>}
  </div>
})
