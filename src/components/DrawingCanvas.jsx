import React, { useRef, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import { ref, push, onChildAdded, off, remove, update } from 'firebase/database'

const CANVAS_BG = '#FFFDF7'

function drawStroke(ctx, stroke, canvas) {
  const { points, color, size, isEraser } = stroke
  if (!points || points.length === 0) return

  ctx.beginPath()
  ctx.strokeStyle = isEraser ? CANVAS_BG : color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const first = points[0]
  const x0 = first.x * canvas.width
  const y0 = first.y * canvas.height
  ctx.moveTo(x0, y0)

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height)
  }
  ctx.stroke()

  // Dot for single-tap strokes
  if (points.length === 1) {
    ctx.beginPath()
    ctx.fillStyle = isEraser ? CANVAS_BG : color
    ctx.arc(x0, y0, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function DrawingCanvas({
  isDrawer,
  roomCode,
  currentRound,
  canvasClearedAt,
  color,
  brushSize,
  isEraser,
}) {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef([])
  const drawnKeysRef = useRef(new Set())
  const unsubRef = useRef(null)

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Re-attach strokes listener on new round or canvas clear
  useEffect(() => {
    clearCanvas()
    drawnKeysRef.current.clear()

    if (unsubRef.current) {
      off(unsubRef.current)
      unsubRef.current = null
    }

    const strokesRef = ref(db, `rooms/${roomCode}/strokes`)
    unsubRef.current = strokesRef

    const unsub = onChildAdded(strokesRef, (snap) => {
      if (drawnKeysRef.current.has(snap.key)) return
      drawnKeysRef.current.add(snap.key)
      const canvas = canvasRef.current
      if (!canvas) return
      drawStroke(canvas.getContext('2d'), snap.val(), canvas)
    })

    return () => unsub()
  }, [roomCode, currentRound, canvasClearedAt])

  const getRelativePos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) / rect.width,
      y: (src.clientY - rect.top) / rect.height,
    }
  }

  const handleStart = useCallback(
    (e) => {
      if (!isDrawer) return
      e.preventDefault()
      isDrawingRef.current = true
      const pos = getRelativePos(e, canvasRef.current)
      currentPointsRef.current = [pos]
    },
    [isDrawer]
  )

  const handleMove = useCallback(
    (e) => {
      if (!isDrawer || !isDrawingRef.current) return
      e.preventDefault()
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const pos = getRelativePos(e, canvas)
      const pts = currentPointsRef.current
      pts.push(pos)

      // Draw segment locally for instant feedback
      if (pts.length >= 2) {
        const prev = pts[pts.length - 2]
        const curr = pts[pts.length - 1]
        ctx.beginPath()
        ctx.strokeStyle = isEraser ? CANVAS_BG : color
        ctx.lineWidth = brushSize
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height)
        ctx.lineTo(curr.x * canvas.width, curr.y * canvas.height)
        ctx.stroke()
      }
    },
    [isDrawer, color, brushSize, isEraser]
  )

  const handleEnd = useCallback(
    async (e) => {
      if (!isDrawer || !isDrawingRef.current) return
      e.preventDefault()
      isDrawingRef.current = false

      const points = currentPointsRef.current
      currentPointsRef.current = []
      if (points.length === 0) return

      const strokesRef = ref(db, `rooms/${roomCode}/strokes`)
      const newRef = await push(strokesRef, {
        points,
        color,
        size: brushSize,
        isEraser: isEraser || false,
      })
      // Mark as drawn so onChildAdded won't double-render it
      drawnKeysRef.current.add(newRef.key)
    },
    [isDrawer, color, brushSize, isEraser, roomCode]
  )

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={480}
      className="w-full h-full rounded-2xl"
      style={{
        background: CANVAS_BG,
        cursor: isDrawer ? (isEraser ? 'cell' : 'crosshair') : 'default',
        touchAction: 'none',
      }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  )
}
