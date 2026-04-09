import React, { useState, useEffect, useRef } from 'react'

const BASE_TRACK_MAX = 2000   // fallback when totalRounds unknown

// ── Vehicle SVGs ──────────────────────────────────────────────

const GrabCar = ({ color, moving }) => (
  <svg width="44" height="22" viewBox="0 0 44 22" fill="none"
    style={{
      transform: moving ? 'scaleX(1.1) translateY(-1px)' : 'scaleX(1)',
      transition: 'transform 0.2s ease',
      filter: moving ? `drop-shadow(0 0 5px ${color})` : 'none',
    }}>
    <rect x="2" y="8" width="40" height="11" rx="3" fill={color} />
    <path d="M10 8 L14 3 L30 3 L34 8Z" fill={color} opacity="0.88" />
    <path d="M15 8 L18 4 L30 4 L33 8Z" fill="rgba(255,255,255,0.22)" />
    <rect x="15" y="4" width="7" height="4" rx="0.5" fill="rgba(255,255,255,0.12)" />
    <circle cx="10" cy="19" r="3.5" fill="#111" /><circle cx="10" cy="19" r="1.8" fill="#2a2a2a" />
    <circle cx="33" cy="19" r="3.5" fill="#111" /><circle cx="33" cy="19" r="1.8" fill="#2a2a2a" />
    <rect x="40" y="10" width="2.5" height="4" rx="1.2" fill="rgba(255,235,120,0.95)" />
    <rect x="2" y="13" width="40" height="2" fill="rgba(0,0,0,0.15)" />
  </svg>
)

const GrabBike = ({ color, moving }) => (
  <svg width="36" height="26" viewBox="0 0 36 26" fill="none"
    style={{
      transform: moving ? 'scaleX(1.1) translateY(-2px) rotate(-4deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
      filter: moving ? `drop-shadow(0 0 5px ${color})` : 'none',
    }}>
    <circle cx="7" cy="19" r="6.5" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="7" cy="19" r="2.5" fill={color} opacity="0.5" />
    <circle cx="29" cy="19" r="6.5" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="29" cy="19" r="2.5" fill={color} opacity="0.5" />
    <path d="M7 19 L18 9 L29 19" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M18 9 L23 6 L29 9 L29 19" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M14 10 L20 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <path d="M17 10 L20 4" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <circle cx="21" cy="3" r="3.5" fill={color} />
    <path d="M26 7 L29 8" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const GrabFood = ({ color, moving }) => (
  <svg width="38" height="24" viewBox="0 0 38 24" fill="none"
    style={{
      transform: moving ? 'scaleX(1.1) translateY(-1px)' : 'scaleX(1)',
      transition: 'transform 0.2s ease',
      filter: moving ? `drop-shadow(0 0 5px ${color})` : 'none',
    }}>
    <rect x="1" y="7" width="10" height="9" rx="1.5" fill={color} opacity="0.85" />
    <line x1="6" y1="7" x2="6" y2="16" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
    <path d="M11 12 Q15 6 20 6 L30 6 Q34 6 34 12" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <rect x="17" y="5" width="10" height="3" rx="1.5" fill={color} />
    <path d="M22 5 L24 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="25" cy="0" r="3" fill={color} />
    <circle cx="7" cy="19" r="5" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="31" cy="19" r="5" fill="none" stroke={color} strokeWidth="2.5" />
    <rect x="35" y="9" width="2" height="3" rx="1" fill="rgba(255,235,120,0.9)" />
  </svg>
)

const GrabVan = ({ color, moving }) => (
  <svg width="48" height="22" viewBox="0 0 48 22" fill="none"
    style={{
      transform: moving ? 'scaleX(1.08) translateY(-1px)' : 'scaleX(1)',
      transition: 'transform 0.2s ease',
      filter: moving ? `drop-shadow(0 0 5px ${color})` : 'none',
    }}>
    <rect x="2" y="4" width="42" height="14" rx="2.5" fill={color} />
    <rect x="30" y="2" width="14" height="9" rx="2" fill={color} opacity="0.85" />
    <rect x="32" y="3" width="10" height="6.5" rx="1" fill="rgba(255,255,255,0.2)" />
    <line x1="26" y1="5" x2="26" y2="17" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
    <rect x="4" y="8" width="19" height="6" rx="1.5" fill="rgba(0,0,0,0.15)" />
    <circle cx="10" cy="19" r="3.5" fill="#111" /><circle cx="10" cy="19" r="1.8" fill="#2a2a2a" />
    <circle cx="38" cy="19" r="3.5" fill="#111" /><circle cx="38" cy="19" r="1.8" fill="#2a2a2a" />
    <rect x="44" y="9" width="2.5" height="4" rx="1" fill="rgba(255,235,120,0.95)" />
  </svg>
)

const makeImageIcon = (src, glowColor, rotate = -6) =>
  ({ moving }) => (
    <img src={src} alt=""
      style={{
        width: 44, height: 44, objectFit: 'contain',
        transform: moving ? `scale(1.18) translateY(-3px) rotate(${rotate}deg)` : 'scale(1) rotate(0deg)',
        transition: 'transform 0.2s ease',
        filter: moving ? `drop-shadow(0 0 8px ${glowColor}) brightness(1.15)` : 'brightness(1)',
      }} />
  )

const DurianFruit   = makeImageIcon('/team-durian.png',    '#00B14F', -6)
const PandanLeaf    = makeImageIcon('/team-pandan.png',    '#4ade80', -8)
const LaksaBowl     = makeImageIcon('/team-laksa.png',     '#f97316', -5)
const TehTarikGlass = makeImageIcon('/team-teh-tarik.png', '#f59e0b',  5)

const TEAM_VEHICLE_MAP = {
  'Durian': DurianFruit, 'Pandan': PandanLeaf,
  'Laksa': LaksaBowl, 'Teh Tarik': TehTarikGlass,
  'Cendol': GrabFood, 'Satay': GrabBike,
  'Rendang': GrabVan, 'Roti Canai': GrabCar,
  'Sambal': GrabBike, 'Nasi Lemak': GrabFood,
}

const getVehicle = (teamName) =>
  TEAM_VEHICLE_MAP[teamName?.replace('Team ', '')] || GrabCar

function SpeedLines({ color }) {
  return (
    <div className="absolute inset-y-0 pointer-events-none overflow-hidden"
      style={{ right: '100%', width: 52 }}>
      {[6, 12, 18, 24].map((top, i) => (
        <div key={i} className="absolute rounded-full"
          style={{ top, right: 0, width: 14 + i * 9, height: 1.5,
            opacity: 0.55 - i * 0.08,
            background: `linear-gradient(90deg, transparent, ${color})` }} />
      ))}
    </div>
  )
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '0,177,79'
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)].join(',')
}

// ── RaceTrack ─────────────────────────────────────────────────
// NEVER pass key= to this component — it must stay mounted so
// displayScores persists and vehicles continue from their last position.
// Pass ready=false to hold animation until you're ready to trigger it.
// Pass totalRounds so TRACK_MAX scales to exactly fit the game length.
export default function RaceTrack({ teams, teamResults, ready = true, totalRounds }) {
  // Max points a team can earn = totalRounds × 250 (max per round as guesser)
  const TRACK_MAX = totalRounds ? totalRounds * 250 : BASE_TRACK_MAX
  // Lock team order on first render — rows NEVER re-sort, only rank badge updates
  const teamIdsRef = useRef(null)
  if (!teamIdsRef.current) {
    teamIdsRef.current = Object.keys(teams)
  }
  const teamIds = teamIdsRef.current

  // displayScores = where vehicles visually ARE right now
  // Initialise from current teams scores (not 0) so on remount vehicles start
  // at the position they finished last round, not the beginning of the track
  const [displayScores, setDisplayScores] = useState(() => {
    const s = {}; teamIds.forEach(tid => { s[tid] = teams[tid]?.score || 0 }); return s
  })
  const [phase, setPhase] = useState('settled')
  const [noMovement, setNoMovement] = useState(false)
  const animRef = useRef(null)

  // Score sum as cheap change detector
  const scoreSum = teamIds.reduce((n, tid) => n + (teams[tid]?.score || 0), 0)

  useEffect(() => {
    if (!ready) { setNoMovement(false); return }

    const anyMoved = teamIds.some(
      tid => (teams[tid]?.score || 0) !== (displayScores[tid] || 0)
    )

    if (!anyMoved) {
      // Nothing changed — show "no movement" after a short delay so the
      // overlay has time to fade in before the message appears
      const t = setTimeout(() => setNoMovement(true), 600)
      return () => clearTimeout(t)
    }

    setNoMovement(false)
    if (animRef.current) clearTimeout(animRef.current)

    setPhase('racing')

    animRef.current = setTimeout(() => {
      const next = {}
      teamIds.forEach(tid => { next[tid] = teams[tid]?.score || 0 })
      setDisplayScores(next)
      setPhase('settled')
    }, 1600)

    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [scoreSum, ready])

  const getPct = (tid) => {
    const score = phase === 'racing'
      ? (teams[tid]?.score || 0)
      : (displayScores[tid] || 0)
    return Math.min((score / TRACK_MAX) * 90, 90)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Race Standings</p>
        {phase === 'racing' && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full animate-pulse"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            RACING
          </span>
        )}
        {phase === 'settled' && !noMovement && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,177,79,0.15)', color: '#00B14F', border: '1px solid rgba(0,177,79,0.3)' }}>
            FINISHED
          </span>
        )}
        {noMovement && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
            NO CHANGE
          </span>
        )}
      </div>

      <div className="space-y-3 pr-5 relative">
        {/* Finish line */}
        <div className="absolute right-0 top-0 bottom-0 w-5 z-10 rounded-r-lg"
          style={{
            background: 'repeating-conic-gradient(rgba(255,255,255,0.18) 0% 25%, transparent 0% 50%) 0 0 / 10px 10px',
            borderLeft: '1px solid rgba(255,255,255,0.15)',
          }} />

        {teamIds.map((tid, i) => {
          const team = teams[tid]
          const result = teamResults?.find(r => r.tid === tid)
          const Vehicle = getVehicle(team?.name)
          const pct = getPct(tid)
          const isMoving = phase === 'racing' &&
            (teams[tid]?.score || 0) !== (displayScores[tid] || 0)

          const rank = [...teamIds]
            .sort((a, b) => (teams[b]?.score || 0) - (teams[a]?.score || 0))
            .indexOf(tid) + 1

          const transition = phase === 'racing'
            ? `left 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 100}ms`
            : 'none'

          return (
            <div key={tid}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-white/25 text-[10px] font-bold w-3">{rank}</span>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: team?.color }} />
                <span className="text-white/60 text-xs font-semibold flex-1 truncate">{team?.name}</span>
                {result?.pts > 0 && (
                  <span className="text-xs font-black animate-bounce-in" style={{ color: team?.color }}>
                    +{result.pts}
                  </span>
                )}
                <span className="text-white font-black text-sm tabular-nums w-12 text-right">
                  {teams[tid]?.score || 0}
                </span>
              </div>

              <div className="relative rounded-xl overflow-visible"
                style={{
                  height: 52, background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(${hexToRgb(team?.color)}, 0.2)`,
                  boxShadow: isMoving ? `0 0 12px rgba(${hexToRgb(team?.color)}, 0.15)` : 'none',
                  transition: 'box-shadow 0.3s',
                }}>

                {/* Road dashes — repeating gradient so they always span full width */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 16px, transparent 16px, transparent 28px)',
                    backgroundPosition: '12px center',
                    backgroundSize: 'calc(100% - 24px) 1px',
                    backgroundRepeat: 'repeat-x',
                  }} />

                {/* Progress trail */}
                <div className="absolute left-0 top-0 bottom-0 rounded-xl"
                  style={{
                    width: `calc(${pct}% + 24px)`,
                    background: `linear-gradient(90deg, rgba(${hexToRgb(team?.color)}, 0.13), rgba(${hexToRgb(team?.color)}, 0.03))`,
                    transition,
                  }} />

                {/* Vehicle */}
                <div className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: `calc(${pct}% - 4px)`, transition, zIndex: 2 }}>
                  {isMoving && <SpeedLines color={team?.color || '#00B14F'} />}
                  <Vehicle color={team?.color || '#00B14F'} moving={isMoving} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rank pills */}
      <div className="flex items-center gap-1.5 mt-4 pt-3 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {[...teamIds]
          .sort((a, b) => (teams[b]?.score || 0) - (teams[a]?.score || 0))
          .map((tid, i) => {
            const team = teams[tid]
            return (
              <div key={tid} className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: `rgba(${hexToRgb(team?.color)}, 0.1)`, border: `1px solid rgba(${hexToRgb(team?.color)}, 0.25)` }}>
                <span className="text-white/30 text-[10px]">#{i + 1}</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: team?.color }} />
                <span className="text-white/60 text-[10px] font-bold">{team?.name?.replace('Team ', '')}</span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
