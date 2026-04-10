import React, { useEffect } from 'react'
import { db } from '../firebase'
import { ref, update } from 'firebase/database'
import { getRandomWordIndex } from '../data/wordList'
import PlayerAvatar from '../components/PlayerAvatar'
import { getTeamImage } from '../utils'

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_HEIGHTS = ['h-28', 'h-20', 'h-14']

export default function Podium({ playerId, roomCode, gameState, isHost, myTeamId }) {
  const teams = gameState?.teams || {}
  const players = gameState?.players || {}

  const sortedTeams = Object.entries(teams)
    .map(([tid, t]) => ({
      tid, ...t,
      memberCount: (t.memberIds || []).length || 1,
      avgScore: Math.round((t.score || 0) / ((t.memberIds || []).length || 1)),
    }))
    .sort((a, b) => b.avgScore - a.avgScore || (b.score || 0) - (a.score || 0))

  // Assign ranks accounting for ties (same avgScore = same rank)
  const rankedTeams = sortedTeams.map((team, i) => {
    const rank = i === 0 ? 0 : sortedTeams.findIndex(t => t.avgScore === team.avgScore)
    return { ...team, rank }
  })

  const topAvg = rankedTeams[0]?.avgScore
  const winners = rankedTeams.filter(t => t.avgScore === topAvg)
  const isMultiWinner = winners.length > 1
  const myTeam = teams[myTeamId]
  const iAmOnWinningTeam = winners.some(w => w.tid === myTeamId)

  useEffect(() => {
    import('canvas-confetti').then((mod) => {
      const confetti = mod.default
      const fire = (opts) => confetti({
        particleCount: 80, spread: 70, origin: { y: 0.6 },
        colors: ['#00B14F', '#00D460', '#f59e0b', '#2563eb', '#ec4899'],
        ...opts,
      })
      fire()
      setTimeout(() => fire({ angle: 60, spread: 55, origin: { x: 0, y: 0.65 } }), 300)
      setTimeout(() => fire({ angle: 120, spread: 55, origin: { x: 1, y: 0.65 } }), 600)
    })
  }, [])

  const handlePlayAgain = async () => {
    const resetTeams = {}
    Object.entries(teams).forEach(([tid, t]) => {
      resetTeams[tid] = { ...t, score: 0 }
    })
    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'lobby',
      teams: resetTeams,
      currentRound: null, totalRounds: null,
      drawingTeamId: null, drawerId: null,
      answerers: null, wordIndex: null,
      usedWordIndices: null, roundStartedAt: null,
      teamProgress: null, strokes: null,
      canvasClearedAt: null, roundWon: null, winningTeamId: null, showRace: null,
    })
  }

  // Keep scores + teams, start another full round cycle immediately
  const handleContinue = async () => {
    const teamIds = Object.keys(teams)
    const drawingTeamId = teamIds[0]
    const drawingTeam = teams[drawingTeamId]
    const drawerId = drawingTeam.memberIds[0]

    const answerers = {}
    teamIds.forEach((tid) => {
      if (tid === drawingTeamId) return
      answerers[tid] = teams[tid].memberIds[0]
    })

    const totalRounds = Object.values(teams).reduce((sum, t) => sum + t.memberIds.length, 0)
    const firstWordIndex = getRandomWordIndex([])

    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'drawing',
      currentRound: 0,
      totalRounds,
      drawingTeamId,
      drawerId,
      answerers,
      wordIndex: firstWordIndex,
      usedWordIndices: [firstWordIndex],
      roundStartedAt: Date.now(),
      canvasClearedAt: Date.now(),
      teamProgress: null,
      strokes: null,
      roundWon: null,
      winningTeamId: null,
      showRace: null,
    })
  }

  const top3 = rankedTeams.slice(0, 3)
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]]

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Winner header */}
        <div className="text-center mb-8">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Game Over</p>
          <h1 className="text-3xl font-black text-white mb-1 tracking-tight">
            {isMultiWinner
              ? iAmOnWinningTeam ? "It's a tie — you're joint winners! 🤝" : "It's a tie! 🤝"
              : iAmOnWinningTeam ? 'Your team won!' : `${rankedTeams[0]?.name} wins!`}
          </h1>
          <p className="text-white/40 text-sm">
            {isMultiWinner
              ? `${winners.map(w => w.name.replace('Team ', '')).join(' & ')} · ${topAvg} pts/player each`
              : `${topAvg} pts/player · ${rankedTeams[0]?.score || 0} total`}
          </p>
        </div>

        {/* Visual podium - team based */}
        {sortedTeams.length >= 2 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            {podiumOrder.map((team) => {
              const rank = team.rank
              const isCenter = rank === 0
              const teamMembers = (team.memberIds || []).map((uid) => players[uid]).filter(Boolean)
              return (
                <div key={team.tid} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xl">{MEDALS[rank]}</span>

                  {/* Team logo / color dot + name */}
                  <div className="flex items-center gap-1 mb-1">
                    {getTeamImage(team.name)
                      ? <img src={getTeamImage(team.name)} alt="" className="w-5 h-5 object-contain" />
                      : <div className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                    }
                    <span className="text-white font-black text-xs">{team.name.replace('Team ', '')}</span>
                  </div>

                  {/* Member avatars stack */}
                  <div className="flex -space-x-1.5 justify-center">
                    {teamMembers.slice(0, 4).map((p, i) => (
                      <div key={i} className="border-2 border-black rounded-full">
                        <PlayerAvatar name={p.name} color={p.color} size={isCenter ? 'md' : 'sm'} />
                      </div>
                    ))}
                  </div>

                  <p className="text-white/50 font-black text-sm tabular-nums mt-1">{Math.round(team.avgScore || 0)}<span className="text-white/25 text-[9px] font-normal">/player</span></p>

                  {/* Podium block */}
                  <div
                    className={`w-full rounded-t-xl ${PODIUM_HEIGHTS[Math.min(rank, PODIUM_HEIGHTS.length - 1)]}`}
                    style={{
                      background: `linear-gradient(to top, rgba(${hexToRgb(team.color)}, 0.6), rgba(${hexToRgb(team.color)}, 0.35))`,
                      opacity: 0.9,
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Member breakdown */}
        <div className="card mb-5">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3">Full Results</p>
          <div className="space-y-3">
            {rankedTeams.map((team, i) => {
              const isMine = team.tid === myTeamId
              const teamMembers = (team.memberIds || []).map((uid) => players[uid]).filter(Boolean)
              return (
                <div key={team.tid}>
                  {/* Team header row */}
                  <div
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1"
                    style={{
                      background: isMine ? `rgba(${hexToRgb(team.color)}, 0.1)` : 'rgba(255,255,255,0.04)',
                      border: isMine ? `1px solid rgba(${hexToRgb(team.color)}, 0.25)` : '1px solid transparent',
                    }}
                  >
                    <span className="text-white/20 text-xs w-4 font-bold">{MEDALS[team.rank] || (team.rank + 1)}</span>
                    {getTeamImage(team.name)
                      ? <img src={getTeamImage(team.name)} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                      : <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: team.color }} />
                    }
                    <span className="flex-1 text-white font-bold text-sm">{team.name}</span>
                    <div className="text-right">
                      <span className="text-white font-black tabular-nums text-sm">{Math.round(team.avgScore || 0)}</span>
                      <span className="text-white/30 text-[9px] ml-0.5">/player</span>
                      <p className="text-white/30 text-[10px] tabular-nums">{team.score || 0} total</p>
                    </div>
                  </div>

                  {/* Members */}
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {teamMembers.map((p, j) => (
                      <div key={j} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <PlayerAvatar name={p.name} color={p.color} size="sm" />
                        <span className="text-white/50 text-xs">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isHost ? (
            <>
              <button className="btn-primary w-full" onClick={handleContinue}>
                ▶ Continue — another round cycle
              </button>
              <p className="text-white/25 text-xs text-center">Scores carry over · Same teams · New words</p>
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={handlePlayAgain}>
                ↺ Play Again — reset scores
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-white/30 text-sm py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-grab animate-pulse" />
              Waiting for the host
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '0,177,79'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
