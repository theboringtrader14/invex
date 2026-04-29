function generatePath(width: number, height: number, seed: number): string {
  const rng = (n: number) => Math.sin(seed + n) * 0.5 + 0.5
  const startX = rng(1) * width  * 0.3
  const startY = rng(2) * height
  const cp1X   = rng(3) * width  * 0.5 + width * 0.2
  const cp1Y   = rng(4) * height
  const cp2X   = rng(5) * width  * 0.5 + width * 0.3
  const cp2Y   = rng(6) * height
  const endX   = width  * 0.8 + rng(7) * width * 0.2
  const endY   = rng(8) * height
  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`
}

export default function BackgroundPaths({ width, height }: { width: number; height: number }) {
  const paths = Array.from({ length: 12 }, (_, i) => ({
    d:           generatePath(width, height, i * 137.5),
    opacity:     0.03 + (i % 4) * 0.01,
    duration:    15 + i * 3,
    delay:       i * 1.5,
    strokeWidth: 0.5 + (i % 3) * 0.3,
  }))

  return (
    <svg
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow-path">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke="#C9F53B"
          strokeWidth={p.strokeWidth}
          opacity={p.opacity}
          filter="url(#glow-path)"
          strokeDasharray="4 8"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-120"
            dur={`${p.duration}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity"
            values={`${p.opacity};${p.opacity * 2};${p.opacity}`}
            dur={`${p.duration * 0.7}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  )
}
