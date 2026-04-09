import React from 'react'
import { db } from '../firebase'
import { ref, update } from 'firebase/database'
import { getRandomWordIndex } from '../data/wordList'
import PlayerAvatar from '../components/PlayerAvatar'

export default function TeamAssign({ playerId, roomCode, gameState, isHost, myTeamId, myTeam }) {
  const teams = gameState?.teams || {}
  const players = gameState?.players || {}
  const teamIds = Object.keys(teams)

  const handleStartGame = async () => {
    const drawingTeamId = teamIds[0]
    const drawingTeam = teams[drawingTeamId]
    const drawerId = drawingTeam.memberIds[0]

    const answerers = {}
    teamIds.forEach((tid) => {
      if (tid === drawingTeamId) return
      answerers[tid] = teams[tid].memberIds[0]
    })

    const firstWordIndex = getRandomWordIndex([])
    const totalRounds = Object.values(teams).reduce((sum, t) => sum + t.memberIds.length, 0)

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
      roundWon: null,
      winningTeamId: null,
      strokes: null,
    })
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Teams are ready</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Meet your crew</h1>
          <p className="text-white/40 text-sm mt-1">
            {myTeam
              ? <>You're on <span style={{ color: myTeam.color }} className="font-bold">{myTeam.name}</span></>
              : 'Teams have been randomly assigned'}
          </p>
        </div>

        {/* Teams grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {teamIds.map((tid) => {
            const team = teams[tid]
            const isMyTeam = tid === myTeamId
            return (
              <div
                key={tid}
                className="rounded-2xl p-4"
                style={{
                  background: isMyTeam
                    ? `rgba(${hexToRgb(team.color)}, 0.1)`
                    : 'rgba(255,255,255,0.04)',
                  border: isMyTeam
                    ? `1.5px solid rgba(${hexToRgb(team.color)}, 0.35)`
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isMyTeam ? `0 0 24px rgba(${hexToRgb(team.color)}, 0.08)` : 'none',
                }}
              >
                {/* Team header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: team.color }}
                  />
                  <span className="font-black text-white text-sm tracking-wide">{team.name}</span>
                  {isMyTeam && (
                    <span
                      className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `rgba(${hexToRgb(team.color)}, 0.2)`, color: team.color }}
                    >
                      You
                    </span>
                  )}
                </div>

                {/* Members */}
                <div className="space-y-2">
                  {(team.memberIds || []).map((uid) => {
                    const p = players[uid]
                    if (!p) return null
                    return (
                      <div key={uid} className="flex items-center gap-2.5">
                        <PlayerAvatar name={p.name} color={p.color} size="sm" />
                        <span className="text-white/80 text-sm font-medium">{p.name}</span>
                        {uid === playerId && (
                          <span className="text-white/30 text-xs ml-auto">you</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* How it works for teams */}
        <div
          className="rounded-xl px-4 py-3 mb-6 text-sm text-white/50 leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          Each round, one team draws while the others race to guess.
          <span className="text-white/70 font-semibold"> Everyone on your team can guess</span> — collaborate to get it first.
          First team to guess correctly wins the round.
        </div>

        {/* Action */}
        {isHost ? (
          <button className="btn-primary w-full" onClick={handleStartGame}>
            Let's Play
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-white/30 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-grab animate-pulse" />
            Waiting for the host to start
          </div>
        )}
      </div>
    </div>
  )
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
