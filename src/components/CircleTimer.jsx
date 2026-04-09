import React from 'react'

const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CircleTimer({ timeLeft, total }) {
  const progress = Math.max(0, timeLeft / total)
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const isDanger = timeLeft <= 5
  const isWarning = timeLeft <= 10 && timeLeft > 5

  const strokeColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#7c3aed'
  const textColor = isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-grab'

  return (
    <div className={`relative inline-flex items-center justify-center ${isDanger ? 'timer-danger' : ''}`}>
      <svg width="96" height="96" className="-rotate-90" aria-hidden="true">
        <circle
          cx="48" cy="48" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
        />
        <circle
          cx="48" cy="48" r={RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span className={`absolute text-2xl font-black ${textColor}`}>{timeLeft}</span>
    </div>
  )
}
