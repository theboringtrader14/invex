import { useEffect, useState, useId } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import type { Container } from '@tsparticles/engine'
import { loadSlim } from '@tsparticles/slim'
import { motion, useAnimation } from 'framer-motion'

type SparklesCoreProps = {
  id?: string
  className?: string
  background?: string
  minSize?: number
  maxSize?: number
  speed?: number
  particleColor?: string
  particleDensity?: number
}

export function SparklesCore({
  id,
  className = '',
  background = 'transparent',
  minSize = 0.5,
  maxSize = 2,
  speed = 2,
  particleColor = '#C9F53B',
  particleDensity = 80,
}: SparklesCoreProps) {
  const [init, setInit] = useState(false)
  const controls = useAnimation()
  const generatedId = useId()

  useEffect(() => {
    initParticlesEngine(async engine => {
      await loadSlim(engine)
    }).then(() => setInit(true))
  }, [])

  const particlesLoaded = async (container?: Container) => {
    if (container) controls.start({ opacity: 1, transition: { duration: 1 } })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={controls}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      className={className}
    >
      {init && (
        <Particles
          id={id ?? generatedId}
          particlesLoaded={particlesLoaded}
          style={{ width: '100%', height: '100%' }}
          options={{
            background: { color: { value: background } },
            fullScreen: { enable: false, zIndex: 0 },
            fpsLimit: 60,
            particles: {
              color: { value: particleColor },
              move: {
                enable: true,
                speed: { min: 0.1, max: 0.8 },
                direction: 'none' as const,
                outModes: { default: 'out' as const },
              },
              number: {
                density: { enable: true, width: 400, height: 400 },
                value: particleDensity,
              },
              opacity: {
                value: { min: 0.1, max: 0.7 },
                animation: { enable: true, speed, sync: false },
              },
              size: { value: { min: minSize, max: maxSize } },
              shape: { type: 'circle' },
            },
            detectRetina: true,
          }}
        />
      )}
    </motion.div>
  )
}
