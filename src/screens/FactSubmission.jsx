import React, { useState } from 'react'
import { db } from '../firebase'
import { ref, set, update } from 'firebase/database'
import { generateQuestions } from '../utils'
import PlayerAvatar from '../components/PlayerAvatar'

export default function FactSubmission({ playerId, roomCode, gameState, isHost }) {
  const [fact1, setFact1] = useState('')
  const [fact2, setFact2] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const players = gameState?.players || {}
  const facts = gameState?.facts || {}
  const submittedIds = Object.keys(facts)
  const submittedCount = submittedIds.length
  const totalCount = Object.keys(players).length
  const allSubmitted = submittedCount >= totalCount

  const hasValidFacts = fact1.trim().length >= 5

  const handleSubmit = async () => {
    if (!hasValidFacts || submitted) return
    setLoading(true)
    try {
      await set(ref(db, `rooms/${roomCode}/facts/${playerId}`), {
        0: fact1.trim(),
        ...(fact2.trim() ? { 1: fact2.trim() } : {}),
      })
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  const handleStartGame = async () => {
    const questions = generateQuestions(players, facts)
    if (questions.length === 0) {
      alert('No facts submitted yet! Ask your crew to submit at least one fact.')
      return
    }
    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'question',
      questions,
      currentQuestion: 0,
      questionStartedAt: Date.now(),
      currentAnswers: null,
    })
  }

  const alreadySubmitted = !!facts[playerId]
  const isSubmitted = submitted || alreadySubmitted

  return (
    <div className="game-bg min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">💣</div>
          <h1 className="text-2xl font-black text-white">Drop Your Bombshells</h1>
          <p className="text-white/50 text-sm mt-1">
            Think <span className="text-violet-400 font-semibold">stories</span>, not preferences. The weirder, the better.
          </p>
        </div>

        {/* Good vs bad tip */}
        <div className="glass-dark rounded-xl px-4 py-3 mb-4 text-xs space-y-1">
          <p className="text-emerald-400 font-semibold">✅ Good — "I accidentally got on the wrong flight and ended up in Oslo"</p>
          <p className="text-red-400/80 font-semibold">❌ Skip — "I like coffee" or "I enjoy hiking"</p>
        </div>

        {/* Submission progress */}
        {isHost ? (
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm font-semibold">Who's ready</span>
              <span className="text-violet-400 font-bold text-sm">
                {submittedCount}/{totalCount}
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 mb-3">
              <div
                className="bg-gradient-to-r from-violet-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (submittedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(players).map(([id, player]) => (
                <div
                  key={id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                    submittedIds.includes(id)
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/30 border border-white/10'
                  }`}
                >
                  <PlayerAvatar name={player.name} color={player.color} size="sm" className="w-4 h-4 text-[9px]" />
                  {player.name.split(' ')[0]}
                  {submittedIds.includes(id) ? ' ✓' : ' ⏳'}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 mb-4">
            <span className="text-white/30 text-xs">{submittedCount} of {totalCount} ready</span>
            <div className="flex-1 mx-3 bg-white/5 rounded-full h-1">
              <div
                className="bg-gradient-to-r from-violet-500 to-cyan-500 h-1 rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (submittedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-violet-400 text-xs font-bold">{submittedCount}/{totalCount}</span>
          </div>
        )}

        {/* Fact inputs */}
        {!isSubmitted ? (
          <div className="card mb-4 space-y-3">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Your most unexpected story <span className="text-red-400">*</span>
              </label>
              <textarea
                className="input-field resize-none text-sm"
                rows={2}
                placeholder='e.g. "I once walked into a film set by accident and ended up as an extra"'
                value={fact1}
                onChange={(e) => setFact1(e.target.value)}
                maxLength={120}
              />
              <p className="text-right text-white/20 text-xs mt-1">{fact1.length}/120</p>
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                A hidden talent or secret skill <span className="text-white/30">(optional)</span>
              </label>
              <textarea
                className="input-field resize-none text-sm"
                rows={2}
                placeholder='e.g. "I have a black belt in karate but never mentioned it at work"'
                value={fact2}
                onChange={(e) => setFact2(e.target.value)}
                maxLength={120}
              />
              <p className="text-right text-white/20 text-xs mt-1">{fact2.length}/120</p>
            </div>
            <button
              className="btn-primary w-full"
              onClick={handleSubmit}
              disabled={!hasValidFacts || loading}
            >
              {loading ? '⏳ Submitting...' : '💣 Drop My Bombshells'}
            </button>
          </div>
        ) : (
          <div className="card mb-4 text-center py-6 animate-bounce-in">
            <div className="text-4xl mb-2">💣</div>
            <p className="text-white font-bold">Bombshells dropped!</p>
            <p className="text-white/40 text-sm mt-1">
              {allSubmitted
                ? "Everyone's ready! Waiting for the host..."
                : "Waiting for the others to spill the tea..."}
            </p>
          </div>
        )}

        {/* Host controls */}
        {isHost && (
          <div className="text-center">
            <button
              className={`btn-primary w-full text-base ${
                submittedCount === 0 ? 'opacity-50' : ''
              }`}
              onClick={handleStartGame}
              disabled={submittedCount === 0}
            >
              {allSubmitted ? '🚀 Start Game!' : `⚡ Start Now (${submittedCount} facts ready)`}
            </button>
            {!allSubmitted && (
              <p className="text-white/30 text-xs mt-2">
                You can start before everyone finishes
              </p>
            )}
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-4">
          🎯 The more surprising, the more points your crew misses!
        </p>
      </div>
    </div>
  )
}
