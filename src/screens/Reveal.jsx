import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { ref, update } from 'firebase/database'
import PlayerAvatar from '../components/PlayerAvatar'
import Leaderboard from '../components/Leaderboard'

const REVEAL_DURATION = 6000

export default function Reveal({ playerId, roomCode, gameState, isHost }) {
  const [countdown, setCountdown] = useState(Math.ceil(REVEAL_DURATION / 1000))
  const advancedRef = useRef(false)
  const revealedAt = useRef(Date.now())

  const questions = gameState?.questions || []
  const currentIdx = gameState?.currentQuestion || 0
  const question = questions[currentIdx]
  const players = gameState?.players || {}
  const currentAnswers = gameState?.currentAnswers || {}

  const correctPlayer = question ? players[question.correctId] : null

  // Host: update scores once and auto-advance
  useEffect(() => {
    if (!isHost || advancedRef.current || !question) return
    advancedRef.current = true
    revealedAt.current = Date.now()

    // Calculate score updates
    const scoreUpdates = {}
    Object.entries(currentAnswers).forEach(([uid, answeredId]) => {
      if (answeredId === question.correctId) {
        const current = players[uid]?.score || 0
        scoreUpdates[`players/${uid}/score`] = current + 100
      }
    })

    if (Object.keys(scoreUpdates).length > 0) {
      update(ref(db, `rooms/${roomCode}`), scoreUpdates)
    }

    const nextIdx = currentIdx + 1
    const isLast = nextIdx >= questions.length

    const timer = setTimeout(async () => {
      if (isLast) {
        await update(ref(db, `rooms/${roomCode}`), { phase: 'podium' })
      } else {
        await update(ref(db, `rooms/${roomCode}`), {
          phase: 'question',
          currentQuestion: nextIdx,
          questionStartedAt: Date.now(),
          currentAnswers: null,
        })
      }
    }, REVEAL_DURATION)

    return () => clearTimeout(timer)
  }, [])

  // Countdown display for everyone
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - revealedAt.current) / 1000
      setCountdown(Math.max(0, Math.ceil(REVEAL_DURATION / 1000 - elapsed)))
    }, 250)
    return () => clearInterval(interval)
  }, [])

  // Host: manual advance
  const handleNext = async () => {
    const nextIdx = currentIdx + 1
    const isLast = nextIdx >= questions.length
    if (isLast) {
      await update(ref(db, `rooms/${roomCode}`), { phase: 'podium' })
    } else {
      await update(ref(db, `rooms/${roomCode}`), {
        phase: 'question',
        currentQuestion: nextIdx,
        questionStartedAt: Date.now(),
        currentAnswers: null,
      })
    }
  }

  if (!question || !correctPlayer) return null

  const myAnswer = currentAnswers[playerId]
  const iGotItRight = myAnswer === question.correctId

  // Split players into correct / wrong
  const correct = []
  const wrong = []
  Object.entries(players).forEach(([id, p]) => {
    if (currentAnswers[id] === question.correctId) correct.push({ id, ...p })
    else if (currentAnswers[id]) wrong.push({ id, ...p })
  })

  return (
    <div className="game-bg min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-bounce-in">
        {/* My result banner */}
        <div
          className={`rounded-2xl p-4 text-center mb-5 border-2 ${
            iGotItRight
              ? 'bg-emerald-500/15 border-emerald-500/40 glow-green'
              : myAnswer
              ? 'bg-red-500/15 border-red-500/40 glow-red'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <div className="text-4xl mb-1">
            {iGotItRight ? '🎉' : myAnswer ? '😅' : '⏰'}
          </div>
          <p className={`font-black text-lg ${iGotItRight ? 'text-emerald-400' : myAnswer ? 'text-red-400' : 'text-white/40'}`}>
            {iGotItRight ? '+100 points!' : myAnswer ? 'Not quite!' : "Time's up!"}
          </p>
        </div>

        {/* The answer */}
        <div className="card text-center mb-4">
          <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-3">
            The answer was...
          </p>
          <div className="flex flex-col items-center gap-2 mb-3">
            <PlayerAvatar name={correctPlayer.name} color={correctPlayer.color} size="xl" />
            <p className="text-2xl font-black text-white">{correctPlayer.name}!</p>
          </div>
          <div className="glass-dark rounded-xl px-4 py-2 text-center">
            <p className="text-white/60 text-xs mb-0.5">who said</p>
            <p className="text-white text-sm italic">"{question.fact}"</p>
          </div>
        </div>

        {/* Who got it right */}
        {(correct.length > 0 || wrong.length > 0) && (
          <div className="card mb-4">
            {correct.length > 0 && (
              <div className="mb-3">
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  ✅ Got it right ({correct.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {correct.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-2 py-1"
                    >
                      <PlayerAvatar name={p.name} color={p.color} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-emerald-300 text-xs font-semibold">{p.name}</span>
                      <span className="text-emerald-400 text-xs">+100</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {wrong.length > 0 && (
              <div>
                <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
                  ❌ Guessed wrong ({wrong.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {wrong.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1"
                    >
                      <PlayerAvatar name={p.name} color={p.color} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-red-300 text-xs font-semibold">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div className="card mb-4">
          <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-3">
            Standings
          </p>
          <Leaderboard players={players} highlightId={playerId} />
        </div>

        {/* Auto-advance indicator */}
        <div className="text-center">
          {isHost ? (
            <div className="flex items-center justify-center gap-3">
              <p className="text-white/30 text-xs">
                Next question in {countdown}s
              </p>
              <button
                onClick={handleNext}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Next →
              </button>
            </div>
          ) : (
            <p className="text-white/30 text-xs">
              Next question in {countdown}s...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
