"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

export function Globe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return

      // White markers from the video
      const markers = [
        { location: [37.7595, -122.4367], size: 0.05 }, // SF
        { location: [40.7128, -74.0060], size: 0.05 },  // NY
        { location: [51.5074, -0.1278], size: 0.05 },   // London
        { location: [35.6895, 139.6917], size: 0.05 },  // Tokyo
        { location: [19.4326, -99.1332], size: 0.05 },  // Mexico City
        { location: [-23.5505, -46.6333], size: 0.05 }, // Sao Paulo
        { location: [28.6139, 77.2090], size: 0.05 },   // New Delhi
        { location: [-33.8688, 151.2093], size: 0.05 }, // Sydney
      ]

      // Connecting arcs like in the video
      const arcs = [
        { from: [37.7595, -122.4367], to: [40.7128, -74.0060], color: [1, 1, 1] },
        { from: [40.7128, -74.0060], to: [51.5074, -0.1278], color: [1, 1, 1] },
        { from: [51.5074, -0.1278], to: [28.6139, 77.2090], color: [1, 1, 1] },
        { from: [28.6139, 77.2090], to: [35.6895, 139.6917], color: [1, 1, 1] },
        { from: [35.6895, 139.6917], to: [-33.8688, 151.2093], color: [1, 1, 1] },
        { from: [19.4326, -99.1332], to: [-23.5505, -46.6333], color: [1, 1, 1] },
      ]

      globe = createGlobe(canvas, {
        devicePixelRatio: 1, // Hardcode to 1 for mobile performance
        width, height: width,
        phi: 0, theta: 0.2, 
        dark: 0, 
        diffuse: 1.2,
        mapSamples: 3000, // Reduced heavily to prevent mobile lag
        mapBrightness: 6,
        baseColor: [1 - 0.258, 1 - 0.521, 1 - 0.956], // Inverted Google Blue
        markerColor: [0, 0, 0], // Inverted White
        glowColor: [1 - 0.258, 1 - 0.521, 1 - 0.956], // Inverted Google Blue glow
        markerElevation: 0.05,
        markers,
        arcs,
        arcColor: [0, 0, 0], // Inverted White
        arcWidth: 1.5, 
        arcHeight: 0.4,
        opacity: 0.9,
      })
      
      let isVisible = false
      const io = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting
      })
      io.observe(canvas)

      function animate() {
        if (isVisible) {
          phi += 0.003
          globe!.update({
            phi: phi,
            theta: 0.2,
          })
        }
        animationId = requestAnimationFrame(animate)
      }
      animate()
      
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [])

  return (
    <div className={`relative aspect-square select-none flex items-center justify-center w-full h-full pointer-events-none ${className}`}>
      <canvas
        ref={canvasRef}
        style={{
          position: "relative",
          zIndex: 1,
          filter: "invert(1)", // Hardware-accelerated invert, much faster than mix-blend-mode on mobile Safari
          width: "100%", height: "100%", opacity: 0,
          transition: "opacity 1.2s ease", borderRadius: "50%",
        }}
      />
      {/* GDG Overlay Logo in bottom right */}
      <div className="absolute -bottom-1 -right-1 w-10 h-10 md:w-12 md:h-12 bg-white rounded-full shadow-md flex items-center justify-center pointer-events-none z-10 border border-gray-100">
        <img 
          src="/gdg_logo.png" 
          alt="GDG Logo" 
          className="w-5 h-5 md:w-6 md:h-6 object-contain"
        />
      </div>
    </div>
  )
}

