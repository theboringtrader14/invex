import { useEffect, useRef, useCallback } from 'react'

interface Pixel {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number; size: number
}

export default function PixelBurst({ color = '#C9F53B' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelsRef = useRef<Pixel[]>([])
  const rafRef    = useRef<number>(0)

  const burst = useCallback((x: number, y: number) => {
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20
      const speed = 0.5 + Math.random() * 2
      pixelsRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        size: 1 + Math.random() * 2,
      })
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pixelsRef.current = pixelsRef.current.filter(p => {
        p.life++
        p.x += p.vx; p.y += p.vy
        p.vx *= 0.97; p.vy *= 0.97
        const opacity = (1 - p.life / p.maxLife) * 0.6
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
        return p.life < p.maxLife
      })
      rafRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [color])

  /* Expose burst function on the canvas DOM node so parent can call without refs */
  useEffect(() => {
    if (canvasRef.current) (canvasRef.current as any).__burst = burst
  }, [burst])

  return (
    <canvas
      ref={canvasRef}
      data-pixel-burst="true"
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}
