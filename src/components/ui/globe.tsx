"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

export function Globe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

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
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width, height: width,
        phi: 0, theta: 0.2, 
        dark: 1, // Use dark mode to get white dots and glowing map
        diffuse: 1.2,
        mapSamples: 16000, 
        mapBrightness: 6,
        baseColor: [0.258, 0.521, 0.956], // #4285F4 (Google Blue)
        markerColor: [1, 1, 1], // White markers
        glowColor: [1, 1, 1],
        markerElevation: 0.05,
        markers,
        arcs,
        arcColor: [1, 1, 1],
        arcWidth: 1.5, // Thicker arcs to match video
        arcHeight: 0.4,
        opacity: 0.9,
      })
      function animate() {
        if (!isPausedRef.current) phi += 0.003
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
        })
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
    <div className={`relative aspect-square select-none flex items-center justify-center ${className}`}>
      {/* Background circle to simulate the solid blue sphere from the video */}
      <div className="absolute inset-0 m-auto w-[98%] h-[98%] rounded-full bg-[#8ab4f8] opacity-80" />
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%", height: "100%", cursor: "grab", opacity: 0,
          transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none",
        }}
      />
      {/* GDG Overlay Logo in bottom right */}
      <div className="absolute -bottom-2 -right-2 md:bottom-2 md:right-2 w-16 h-16 md:w-20 md:h-20 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none z-10 border border-gray-100">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 md:w-12 md:h-12 ml-1">
          <path d="M10 5L3 12L10 19" stroke="url(#leftGradient)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 5L21 12L14 19" stroke="url(#rightGradient)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="leftGradient" x1="10" y1="5" x2="10" y2="19" gradientUnits="userSpaceOnUse">
              <stop offset="50%" stopColor="#EA4335" /> {/* Red */}
              <stop offset="50%" stopColor="#4285F4" /> {/* Blue */}
            </linearGradient>
            <linearGradient id="rightGradient" x1="14" y1="5" x2="14" y2="19" gradientUnits="userSpaceOnUse">
              <stop offset="50%" stopColor="#34A853" /> {/* Green */}
              <stop offset="50%" stopColor="#FBBC04" /> {/* Yellow */}
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}
