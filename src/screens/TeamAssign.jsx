import React, { useState } from 'react'
import { db } from '../firebase'
import { ref, update } from 'firebase/database'
import { getRandomWordIndex } from '../data/wordList'
import PlayerAvatar from '../components/PlayerAvatar'
import { assignTeams } from '../utils'

export default function TeamAssign({ playerId, roomCode, gameState, isHost, myTeamId, myTeam }) {
  const teams = gameState?.teams || {}
  const players = gameState?.players || {}
  const teamIds = Object.keys(teams)

  // Non-host players available for team assignment
  const hostId = gameState?.hostId
  const assignablePlayers = Object.keys(players).filter((id) => id !== hostId)
  const currentTeamCount = teamIds.length
  const maxTeams = Math.min(8, assignablePlayers.length)  // at least 1 player per team
  const minTeams = Math.min(2, assignablePlayers.length)
  const [selectedTeamCount, setSelectedTeamCount] = useState(currentTeamCount)

  // Possible team counts: 2 up to maxTeams
  const teamCountOptions = Array.from({ length: maxTeams - minTeams + 1 }, (_, i) => minTeams + i)

  const handleReshuffle = async () => {
    const newTeams = assignTeams(assignablePlayers, selectedTeamCount)
    await update(ref(db, `rooms/${roomCode}`), { teams: newTeams })
  }

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
                      My Team
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

        {/* How it works */}
        <div
          className="rounded-xl px-4 py-3 mb-6 text-sm text-white/50 leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          Each round, one team draws while the rest guess individually.
          <span className="text-white/70 font-semibold"> Every player guesses on their own</span> — earn up to 250 pts, minus 50 per wrong guess.
          Use <span className="text-amber-400 font-semibold">💡 Hint</span> to reveal a clue, or <span className="text-red-400 font-semibold">💣 Sabotage</span> to deal 100 pts damage to an opponent's team.
        </div>

        {/* Action */}
        {isHost ? (
          <div className="space-y-3">
            <button className="btn-primary w-full" onClick={handleStartGame}>
              Let's Play
            </button>

            {/* Reshuffle with team count picker */}
            <div className="rounded-2xl p-3 space-y-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/30 text-[11px] uppercase tracking-widest font-semibold text-center">
                🔀 Reshuffle into
              </p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {teamCountOptions.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSelectedTeamCount(n)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={selectedTeamCount === n
                      ? { background: 'rgba(0,177,79,0.2)', color: '#00B14F', border: '1px solid rgba(0,177,79,0.4)' }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {n} teams
                  </button>
                ))}
              </div>
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
                onClick={handleReshuffle}
              >
                Reshuffle
              </button>
            </div>
          </div>
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
