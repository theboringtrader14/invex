import { motion } from 'framer-motion'

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(201,245,59,${0.03 + i * 0.0015})`,
    width: 0.4 + i * 0.025,
  }))

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 696 316"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map(p => (
        <motion.path
          key={p.id}
          d={p.d}
          stroke={p.color}
          strokeWidth={p.width}
          initial={{ pathLength: 0.3, opacity: 0.3 }}
          animate={{
            pathLength: 1,
            opacity: [0.2, 0.5, 0.2],
            pathOffset: [0, 1, 0],
          }}
          transition={{
            duration: 15 + p.id * 0.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </svg>
  )
}

export function BackgroundPaths() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  )
}
