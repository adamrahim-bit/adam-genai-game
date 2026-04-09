import React, { useState } from 'react'
import { db } from '../firebase'
import { ref, update, remove } from 'firebase/database'
import { assignTeams } from '../utils'
import PlayerAvatar from '../components/PlayerAvatar'

const HOW_TO = [
  { step: '01', emoji: '👥', text: 'Players are split into teams — each team takes turns drawing' },
  { step: '02', emoji: '🎨', text: 'The drawing team studies the word for 15 seconds, then starts drawing' },
  { step: '03', emoji: '🔍', text: 'Every player guesses individually — tap letters or type the full word' },
  { step: '04', emoji: '🏆', text: 'Earn up to 250 pts per player — −50 pts for each wrong guess' },
  { step: '05', emoji: '💣', text: 'Use power cards: 💡 Hint reveals a clue (−100 pts), 💣 Sabotage deals 100 pts damage to an opponent\'s team (costs you 150 pts)' },
]

const TIMER_OPTIONS = [120, 180, 240]

export default function Lobby({ playerId, roomCode, gameState, isHost, exitRoom, exitRoomAsHost, deleteRoom }) {
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'exit' | 'delete'
  const [kickId, setKickId] = useState(null)

  const players = Object.entries(gameState?.players || {})
  const playerCount = players.length
  const canStart = playerCount >= 2
  const roundDuration = gameState?.roundDuration || 240

  const setRoundDuration = (s) => update(ref(db, `rooms/${roomCode}`), { roundDuration: s })

  const handleKick = async () => {
    if (!kickId) return
    await remove(ref(db, `rooms/${roomCode}/players/${kickId}`))
    setKickId(null)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleStart = async () => {
    // Exclude host — host monitors only, not a player in any team
    const playerIds = Object.keys(gameState?.players || {}).filter(id => id !== playerId)
    const teams = assignTeams(playerIds)
    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'teamassign',
      teams,
      roundDuration: roundDuration,
    })
  }

  const handleConfirm = async () => {
    if (confirm === 'exit') await (isHost ? exitRoomAsHost : exitRoom)()
    else if (confirm === 'delete') await deleteRoom()
    setConfirm(null)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white tracking-tight">Game Lobby</h1>
          <p className="text-white/40 text-sm mt-1">
            {isHost ? 'Invite your crew, then start when ready' : 'Waiting for the host to start'}
          </p>
        </div>

        {/* Room code */}
        <div className="card-highlight p-5 mb-4 text-center">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
            Room Code
          </p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <span
              className="text-4xl font-black tracking-[0.25em] text-white"
              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.2em' }}
            >
              {roomCode}
            </span>
          </div>
          <button onClick={handleCopy} className="btn-secondary text-xs py-1.5 px-4">
            {copied ? 'Copied to clipboard' : 'Copy code'}
          </button>
        </div>

        {/* Timer duration — host only */}
        {isHost && (
          <div className="card mb-4">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">⏱️ Round timer</p>
            <div className="flex gap-2">
              {TIMER_OPTIONS.map((s) => (
                <button key={s}
                  onClick={() => setRoundDuration(s)}
                  className="flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95"
                  style={roundDuration === s
                    ? { background: 'rgba(0,177,79,0.2)', color: '#00B14F', border: '1px solid rgba(0,177,79,0.4)' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {Math.floor(s / 60)}m
                </button>
              ))}
            </div>
          </div>
        )}

        {/* How to play */}
        <div className="card mb-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">How it works</p>
          <div className="space-y-3">
            {HOW_TO.map(({ step, emoji, text }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-xl text-base"
                  style={{ background: 'rgba(0,177,79,0.1)', border: '1px solid rgba(0,177,79,0.2)' }}>
                  {emoji}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-white/60 text-sm leading-snug">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Players */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">
              Players
            </p>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,177,79,0.15)', color: '#00B14F', border: '1px solid rgba(0,177,79,0.2)' }}
            >
              {playerCount} joined
            </span>
          </div>

          <div className="space-y-2">
            {players.map(([id, player]) => (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all animate-fade-in"
                style={id === playerId
                  ? { background: 'rgba(0,177,79,0.08)', border: '1px solid rgba(0,177,79,0.25)' }
                  : { background: 'rgba(255,255,255,0.04)' }
                }
              >
                <PlayerAvatar name={player.name} color={player.color} size="sm" />
                <span className="font-semibold text-white flex-1 text-sm">{player.name}</span>
                {id === gameState?.hostId && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                    HOST
                  </span>
                )}
                {id === playerId && id !== gameState?.hostId && (
                  <span className="text-white/25 text-xs">You</span>
                )}
                {isHost && id !== playerId && (
                  <button onClick={() => setKickId(id)}
                    className="text-[10px] px-1.5 py-0.5 rounded font-bold transition-all hover:opacity-100 opacity-30"
                    style={{ color: '#ef4444' }}>
                    Kick
                  </button>
                )}
              </div>
            ))}

            {playerCount < 2 && (
              <div className="text-center py-3 border border-dashed border-white/10 rounded-xl">
                <p className="text-white/25 text-sm">Waiting for more players...</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isHost ? (
          <div className="space-y-2">
            <button className="btn-primary w-full" onClick={handleStart} disabled={!canStart}>
              {canStart ? 'Assign Teams & Start' : 'Need at least 2 players'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm('exit')}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                🚪 Leave room
              </button>
              <button
                onClick={() => setConfirm('delete')}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.6)', border: '1px solid rgba(239,68,68,0.15)' }}>
                🗑️ Delete room
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-white/30 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-grab animate-pulse" />
              Waiting for the host
            </div>
            <button
              onClick={() => setConfirm('exit')}
              className="btn-secondary text-sm py-2 px-5">
              🚪 Leave room
            </button>
          </div>
        )}

        {/* Kick confirm */}
        {kickId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="rounded-2xl p-6 w-full max-w-xs animate-bounce-in"
              style={{ background: 'rgba(10,20,14,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="text-center mb-5">
                <span className="text-4xl">👢</span>
                <h3 className="text-white font-black text-lg mt-3">Kick player?</h3>
                <p className="text-white/40 text-sm mt-1">
                  <span className="text-white font-semibold">{gameState?.players?.[kickId]?.name}</span> will be removed from the lobby.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setKickId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                  Cancel
                </button>
                <button onClick={handleKick}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black active:scale-95"
                  style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}>
                  Kick
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm modal */}
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="rounded-2xl p-6 w-full max-w-xs animate-bounce-in"
              style={{ background: 'rgba(10,20,14,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="text-center mb-5">
                <span className="text-4xl">{confirm === 'delete' ? '🗑️' : '🚪'}</span>
                <h3 className="text-white font-black text-lg mt-3">
                  {confirm === 'delete' ? 'Delete room?' : 'Leave room?'}
                </h3>
                <p className="text-white/40 text-sm mt-1">
                  {confirm === 'delete'
                    ? 'This ends the game for all players.'
                    : isHost
                      ? 'Host role transfers to the next player.'
                      : 'You will exit the lobby.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black active:scale-95"
                  style={confirm === 'delete'
                    ? { background: 'rgba(239,68,68,0.9)', color: 'white' }
                    : { background: 'rgba(0,177,79,0.9)', color: 'white' }}>
                  {confirm === 'delete' ? 'Delete' : 'Leave'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
