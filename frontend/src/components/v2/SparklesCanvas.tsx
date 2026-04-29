import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  size: number; opacity: number
  vx: number; vy: number
  life: number; maxLife: number
}

export default function SparklesCanvas({ color = '#C9F53B' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = canvas.offsetWidth  || canvas.clientWidth  || 800
      canvas.height = canvas.offsetHeight || canvas.clientHeight || 500
    }
    resize()
    window.addEventListener('resize', resize)

    const spawn = () => {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        opacity: 0,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        life: 0,
        maxLife: Math.random() * 120 + 60,
      })
    }

    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (frame % 4 === 0 && particlesRef.current.length < 80) spawn()
      frame++

      particlesRef.current = particlesRef.current.filter(p => {
        p.life++
        p.x += p.vx
        p.y += p.vy
        const progress = p.life / p.maxLife
        p.opacity = progress < 0.3
          ? progress / 0.3
          : progress > 0.7
          ? (1 - progress) / 0.3
          : 1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity * 0.6})`
        ctx.fill()

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity * 0.15})`
        ctx.fill()

        return p.life < p.maxLife
      })

      animFrameRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [color])

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.7 }}
    />
  )
}
