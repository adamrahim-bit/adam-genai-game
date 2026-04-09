import React, { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, set, update } from 'firebase/database'
import { QUESTION_TIME } from '../utils'
import CircleTimer from '../components/CircleTimer'
import PlayerAvatar from '../components/PlayerAvatar'

export default function Question({ playerId, roomCode, gameState, isHost }) {
  const [myAnswer, setMyAnswer] = useState(null)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const advancedRef = useRef(false)

  const questions = gameState?.questions || []
  const currentIdx = gameState?.currentQuestion || 0
  const question = questions[currentIdx]
  const players = gameState?.players || {}
  const currentAnswers = gameState?.currentAnswers || {}
  const questionStartedAt = gameState?.questionStartedAt || Date.now()

  // Sync my answer from Firebase (handles page refresh)
  useEffect(() => {
    setMyAnswer(currentAnswers[playerId] || null)
  }, [currentIdx])

  // Timer display for all clients
  useEffect(() => {
    advancedRef.current = false
    const tick = () => {
      const elapsed = (Date.now() - questionStartedAt) / 1000
      setTimeLeft(Math.max(0, Math.ceil(QUESTION_TIME - elapsed)))
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [questionStartedAt, currentIdx])

  // Host: auto-advance when timer hits 0
  useEffect(() => {
    if (!isHost || !questionStartedAt) return
    advancedRef.current = false

    const elapsed = Date.now() - questionStartedAt
    const remaining = Math.max(0, QUESTION_TIME * 1000 - elapsed)

    const timer = setTimeout(async () => {
      if (advancedRef.current) return
      advancedRef.current = true
      await update(ref(db, `rooms/${roomCode}`), { phase: 'reveal' })
    }, remaining)

    return () => clearTimeout(timer)
  }, [questionStartedAt, currentIdx, isHost])

  const handleAnswer = async (chosenId) => {
    if (myAnswer) return
    setMyAnswer(chosenId)
    await set(ref(db, `rooms/${roomCode}/currentAnswers/${playerId}`), chosenId)

    // Host: advance early if everyone answered
    if (isHost) {
      const answeredCount = Object.keys(currentAnswers).length + 1
      const totalPlayers = Object.keys(players).length
      if (answeredCount >= totalPlayers && !advancedRef.current) {
        advancedRef.current = true
        setTimeout(async () => {
          await update(ref(db, `rooms/${roomCode}`), { phase: 'reveal' })
        }, 800)
      }
    }
  }

  // Host: manual advance button
  const handleForceReveal = async () => {
    if (advancedRef.current) return
    advancedRef.current = true
    await update(ref(db, `rooms/${roomCode}`), { phase: 'reveal' })
  }

  if (!question) {
    return (
      <div className="game-bg min-h-screen flex items-center justify-center">
        <p className="text-white/40">Loading question...</p>
      </div>
    )
  }

  const optionPlayers = question.options
    .map((id) => ({ id, ...(players[id] || { name: '?', color: '#7c3aed', score: 0 }) }))
    .filter((p) => p.name)

  const answeredCount = Object.keys(currentAnswers).length

  return (
    <div className="game-bg min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-1 bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
        {/* Question header */}
        <div className="w-full flex items-center justify-between mb-6 animate-fade-in">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">
              Question
            </p>
            <p className="text-white font-black text-lg">
              {currentIdx + 1}{' '}
              <span className="text-white/30 font-normal text-base">of {questions.length}</span>
            </p>
          </div>
          <CircleTimer timeLeft={timeLeft} total={QUESTION_TIME} />
          <div className="text-right">
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">
              Answered
            </p>
            <p className="text-white font-black text-lg">
              {answeredCount}
              <span className="text-white/30 font-normal text-base">/{Object.keys(players).length}</span>
            </p>
          </div>
        </div>

        {/* Question prompt */}
        <div className="w-full mb-6 animate-slide-up">
          <p className="text-center text-white/60 text-sm font-semibold mb-3 uppercase tracking-widest">
            👀 Who said this?
          </p>
          <div className="glass rounded-2xl p-5 text-center border border-white/10">
            <span className="text-violet-400 text-4xl font-serif leading-none">"</span>
            <p className="text-white text-xl font-semibold leading-relaxed my-1">
              {question.fact}
            </p>
            <span className="text-violet-400 text-4xl font-serif leading-none">"</span>
          </div>
        </div>

        {/* Answer options */}
        <div
          className={`w-full grid gap-3 animate-fade-in ${
            optionPlayers.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'
          }`}
        >
          {optionPlayers.map((player) => {
            const isSelected = myAnswer === player.id
            const isLocked = !!myAnswer && !isSelected
            const hasAnswered = !!currentAnswers[player.id]

            return (
              <button
                key={player.id}
                onClick={() => handleAnswer(player.id)}
                disabled={!!myAnswer}
                className={`
                  relative p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-2
                  ${isSelected
                    ? 'border-violet-500 bg-violet-500/25 scale-[0.97] glow-violet'
                    : isLocked
                    ? 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 active:scale-[0.97]'
                  }
                `}
                style={isSelected ? { boxShadow: `0 0 24px rgba(124,58,237,0.5)` } : {}}
              >
                <PlayerAvatar name={player.name} color={player.color} size="md" />
                <span className="text-white font-semibold text-sm text-center leading-tight">
                  {player.name}
                </span>
                {isSelected && (
                  <span className="text-violet-300 text-xs font-bold">Your pick ✓</span>
                )}
                {hasAnswered && !isSelected && !myAnswer && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"
                    title="Someone answered"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Waiting message */}
        {myAnswer && (
          <p className="text-white/40 text-sm mt-5 animate-fade-in text-center">
            {answeredCount >= Object.keys(players).length
              ? '⚡ Everyone answered! Revealing soon...'
              : `⏳ Waiting for ${Object.keys(players).length - answeredCount} more...`}
          </p>
        )}

        {/* Host manual advance */}
        {isHost && (
          <button
            onClick={handleForceReveal}
            className="mt-4 text-white/30 hover:text-white/60 text-xs underline transition-colors"
          >
            Skip to reveal →
          </button>
        )}
      </div>
    </div>
  )
}
