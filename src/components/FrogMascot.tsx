import { useId } from 'react'

export type FrogVariant =
  | 'normal'
  | 'request-received'
  | 'returned'
  | 'returned-back'
  | 'working'
  | 'done'
  | 'kp-earned'
  | 'relaxing'

type Props = {
  variant?: FrogVariant
  size?: number
}

const labels: Record<FrogVariant, string> = {
  normal: '通常のカエル',
  'request-received': 'お願いが届いてうれしいカエル',
  returned: 'お願いをカエしたカエル',
  'returned-back': 'お願いがカエってきたカエル',
  working: 'お願いに取り組むカエル',
  done: 'やったよと跳ねるカエル',
  'kp-earned': 'KPを獲得したカエル',
  relaxing: 'のんびり休むカエル',
}

export function FrogMascot({ variant = 'normal', size = 92 }: Props) {
  const titleId = useId()
  const isHappy = variant === 'done' || variant === 'kp-earned'
  const isSurprised = variant === 'request-received' || variant === 'returned-back'

  return (
    <svg
      className={`frog frog-mascot frog-mascot--${variant}`}
      style={{ width: size, height: size }}
      viewBox="0 0 120 104"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{labels[variant]}</title>

      {variant === 'relaxing' ? <RelaxingFrog /> : (
        <g className="frog-mascot__character">
          <ellipse className="frog-mascot__ground" cx="60" cy="96" rx="43" ry="6" />

          {variant === 'done' && <g className="frog-mascot__motion"><path d="M20 73l-8 6m91-6 8 6M29 53l-10-2m72 2 10-2" /><path d="M50 99q10 8 20 0" /></g>}

          <path className="frog-mascot__body" d="M31 66c0-24 10-43 29-43s29 19 29 43c0 17-11 29-29 29S31 83 31 66Z" />
          <ellipse className="frog-mascot__foot" cx="31" cy="89" rx="18" ry="9" transform={variant === 'done' ? 'rotate(-25 31 89)' : undefined} />
          <ellipse className="frog-mascot__foot" cx="89" cy="89" rx="18" ry="9" transform={variant === 'done' ? 'rotate(25 89 89)' : undefined} />

          <Eye x={44} happy={isHappy} />
          <Eye x={76} happy={isHappy} />
          <Face happy={isHappy} surprised={isSurprised} />

          {variant === 'request-received' && <Envelope x={33} y={66} />}
          {variant === 'returned' && <ReturnedPose />}
          {variant === 'returned-back' && <ReturnedBackPose />}
          {variant === 'working' && <WorkingPose />}
          {variant === 'done' && <DonePose />}
          {variant === 'kp-earned' && <KpPose />}
        </g>
      )}
    </svg>
  )
}

function Eye({ x, happy }: { x: number; happy: boolean }) {
  return <g>
    <circle className="frog-mascot__eye-rim" cx={x} cy="25" r="14" />
    <circle className="frog-mascot__eye" cx={x} cy="25" r="9" />
    {happy ? <path className="frog-mascot__eye-happy" d={`M${x - 5} 27q5-7 10 0`} /> : <circle className="frog-mascot__pupil" cx={x} cy="26" r="4" />}
  </g>
}

function Face({ happy, surprised }: { happy: boolean; surprised: boolean }) {
  if (happy) return <g><path className="frog-mascot__mouth-fill" d="M48 58q12 18 24 0Z" /><path className="frog-mascot__mouth" d="M48 58q12 18 24 0" /></g>
  if (surprised) return <circle className="frog-mascot__mouth-fill" cx="60" cy="61" r="5" />
  return <path className="frog-mascot__mouth" d="M48 59q12 13 24 0" />
}

function Envelope({ x, y }: { x: number; y: number }) {
  return <g className="frog-mascot__envelope"><rect x={x} y={y} width="54" height="29" rx="4" /><path d={`M${x + 3} ${y + 4}l24 16 24-16M${x + 3} ${y + 26}l17-12m31 12-17-12`} /></g>
}

function ReturnedPose() {
  return <g>
    <path className="frog-mascot__arm" d="M84 65q18-5 20-17" />
    <g transform="translate(47 25) scale(.7)"><Envelope x={33} y={30} /></g>
    <path className="frog-mascot__accent" d="M100 30l9-6m-5 14 11-1" />
  </g>
}

function ReturnedBackPose() {
  return <g>
    <g transform="translate(-3 25) scale(.7)"><Envelope x={10} y={30} /></g>
    <path className="frog-mascot__arrow" d="M11 35q17-14 31 0m-5-8 6 8-10 2" />
    <path className="frog-mascot__accent" d="M95 43l8-6m-5 14 10 1" />
  </g>
}

function WorkingPose() {
  return <g>
    <path className="frog-mascot__arm" d="M39 72q-8 7-7 16m49-16q8 7 7 16" />
    <path className="frog-mascot__book" d="M28 67q16-5 32 7v23q-15-9-32-5Zm64 0q-16-5-32 7v23q15-9 32-5Z" />
    <path className="frog-mascot__book-line" d="M60 74v23" />
  </g>
}

function DonePose() {
  return <g><path className="frog-mascot__arm" d="M34 59Q18 49 20 34m66 25q16-10 14-25" /><path className="frog-mascot__accent" d="M18 24l-6-7m11 4 2-10m77 13 6-7m-11 4-2-10" /></g>
}

function KpPose() {
  return <g>
    <circle className="frog-mascot__coin-edge" cx="60" cy="76" r="23" />
    <circle className="frog-mascot__coin" cx="60" cy="76" r="18" />
    <text className="frog-mascot__kp" x="60" y="82" textAnchor="middle">KP</text>
    <path className="frog-mascot__spark" d="M22 45l3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm76-11 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
  </g>
}

function RelaxingFrog() {
  return <g>
    <ellipse className="frog-mascot__ground" cx="60" cy="91" rx="49" ry="7" />
    <path className="frog-mascot__body" d="M15 76q5-23 31-22 13-20 34-8 18 10 13 31 13 0 17 10-20 7-50 5-29 1-45-5Z" />
    <circle className="frog-mascot__eye-rim" cx="73" cy="46" r="10" />
    <circle className="frog-mascot__eye" cx="73" cy="46" r="6" />
    <path className="frog-mascot__eye-happy" d="M69 47q4-5 8 0" />
    <path className="frog-mascot__mouth" d="M78 62q8 7 14-1" />
    <path className="frog-mascot__sleep" d="M91 32h9l-9 9h10m2-20h7l-7 7h8" />
  </g>
}
