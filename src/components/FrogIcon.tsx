type Props = {
  size?: number
  label?: string
  className?: string
}

/** Small-size mark for KP, badges and navigation. Details are intentionally reduced. */
export function FrogIcon({ size = 20, label, className = '' }: Props) {
  return (
    <svg
      className={`frog-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 32 30"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse className="frog-icon__foot" cx="7" cy="25" rx="7" ry="4" />
      <ellipse className="frog-icon__foot" cx="25" cy="25" rx="7" ry="4" />
      <path className="frog-icon__body" d="M5 17C5 8 9 3 16 3s11 5 11 14c0 8-4 11-11 11S5 25 5 17Z" />
      <circle className="frog-icon__eye-rim" cx="10" cy="6" r="5" />
      <circle className="frog-icon__eye-rim" cx="22" cy="6" r="5" />
      <circle className="frog-icon__eye" cx="10" cy="6" r="3.2" />
      <circle className="frog-icon__eye" cx="22" cy="6" r="3.2" />
      <circle className="frog-icon__pupil" cx="10" cy="6.3" r="1.4" />
      <circle className="frog-icon__pupil" cx="22" cy="6.3" r="1.4" />
      <path className="frog-icon__mouth" d="M12 18q4 4 8 0" />
    </svg>
  )
}
