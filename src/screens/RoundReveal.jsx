import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { ref, update } from 'firebase/database'
import { WORD_LIST, getRandomWordIndex } from '../data/wordList'
import PlayerAvatar from '../components/PlayerAvatar'
import RaceTrack from '../components/RaceTrack'
import { getTeamImage } from '../utils'

const MAX_WRONG = 3
const BASE_POINTS = 100
const HEART_BONUS = 50   // per heart remaining
const DRAWING_TEAM_POINTS = 80

export default function RoundReveal({ playerId, roomCode, gameState, isHost, myTeamId }) {
  const scoredRef = useRef(false)

  // Race overlay — driven by Firebase so all players see it simultaneously
  const showRace = !!gameState?.showRace
  const [raceReady, setRaceReady] = useState(false)
  const [showNoScorePrompt, setShowNoScorePrompt] = useState(false)

  // When host broadcasts showRace, every client starts the delay then animates
  useEffect(() => {
    if (!showRace) { setRaceReady(false); setShowNoScorePrompt(false); return }
    const t = setTimeout(() => {
      setRaceReady(true)
      // If nobody scored, show the no-score splash instead of a silent static track
      if (!roundWon) setShowNoScorePrompt(true)
    }, 1800)
    return () => clearTimeout(t)
  }, [showRace])

  const teams = gameState?.teams || {}
  const players = gameState?.players || {}
  const drawingTeamId = gameState?.drawingTeamId
  const drawerId = gameState?.drawerId
  const wordEntry = WORD_LIST[gameState?.wordIndex]
  const roundWon = gameState?.roundWon
  const teamProgress = gameState?.teamProgress || {}
  const currentRound = gameState?.currentRound || 0
  const totalRounds = gameState?.totalRounds || 1
  const isLastRound = currentRound + 1 >= totalRounds
  const drawer = players[drawerId]
  const drawingTeam = drawingTeamId ? teams[drawingTeamId] : null
  const teamIds = Object.keys(teams)

  // Per-team results
  const guessingTeamIds = teamIds.filter((tid) => tid !== drawingTeamId)
  const teamResults = guessingTeamIds.map((tid) => {
    const team = teams[tid]
    const prog = teamProgress[tid] || {}
    const succeeded = prog.done && !prog.failed
    const heartsLeft = MAX_WRONG - (prog.wrongGuesses || 0)
    const pts = succeeded ? BASE_POINTS + heartsLeft * HEART_BONUS : 0
    return { tid, team, prog, succeeded, heartsLeft, pts }
  })

  // First team to guess (by doneAt timestamp)
  const firstTeamResult = teamResults
    .filter((r) => r.succeeded && r.prog.doneAt)
    .sort((a, b) => a.prog.doneAt - b.prog.doneAt)[0]

  // Apply team scores once on mount (host only)
  useEffect(() => {
    if (!isHost || scoredRef.current) return
    scoredRef.current = true
    const updates = {}

    // Each guessing team scores independently by hearts remaining
    teamResults.forEach(({ tid, team, succeeded, heartsLeft }) => {
      if (succeeded) {
        const pts = BASE_POINTS + heartsLeft * HEART_BONUS
        updates[`teams/${tid}/score`] = (team.score || 0) + pts
      }
    })

    // Drawing team scores if anyone guessed
    const anyWon = teamResults.some((r) => r.succeeded)
    if (anyWon && drawingTeamId && teams[drawingTeamId]) {
      updates[`teams/${drawingTeamId}/score`] = (teams[drawingTeamId].score || 0) + DRAWING_TEAM_POINTS
    }

    if (Object.keys(updates).length > 0) {
      update(ref(db, `rooms/${roomCode}`), updates)
    }
  }, [])

  // Skip podium — keep scores, start another full cycle immediately
  const handleContinue = async () => {
    const firstWordIndex = getRandomWordIndex([])
    const nextDrawingTeamId = teamIds[0]
    const nextDrawingTeam = teams[nextDrawingTeamId]
    const nextDrawerId = nextDrawingTeam.memberIds[0]
    const nextAnswerers = {}
    teamIds.forEach((tid) => {
      if (tid === nextDrawingTeamId) return
      nextAnswerers[tid] = teams[tid].memberIds[0]
    })
    const nextTotalRounds = Object.values(teams).reduce((sum, t) => sum + t.memberIds.length, 0)
    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'drawing',
      currentRound: 0,
      totalRounds: nextTotalRounds,
      drawingTeamId: nextDrawingTeamId,
      drawerId: nextDrawerId,
      answerers: nextAnswerers,
      wordIndex: firstWordIndex,
      usedWordIndices: [firstWordIndex],
      roundStartedAt: Date.now(),
      canvasClearedAt: Date.now(),
      teamProgress: null, strokes: null,
      roundWon: null, winningTeamId: null, showRace: null,
      spectatorCardUsed: null,
    })
  }

  const handleNext = async () => {
    if (isLastRound) {
      await update(ref(db, `rooms/${roomCode}`), { phase: 'podium' })
      return
    }

    const nextRound = currentRound + 1
    const nextDrawingTeamId = teamIds[nextRound % teamIds.length]
    const nextDrawingTeam = teams[nextDrawingTeamId]
    const timesDrawn = Math.floor(nextRound / teamIds.length)
    const nextDrawerId = nextDrawingTeam.memberIds[timesDrawn % nextDrawingTeam.memberIds.length]

    const nextAnswerers = {}
    teamIds.forEach((tid) => {
      if (tid === nextDrawingTeamId) return
      nextAnswerers[tid] = teams[tid].memberIds[nextRound % teams[tid].memberIds.length]
    })

    const usedIndices = gameState?.usedWordIndices || []
    const nextWordIndex = getRandomWordIndex(usedIndices)

    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'drawing',
      currentRound: nextRound,
      drawingTeamId: nextDrawingTeamId,
      drawerId: nextDrawerId,
      answerers: nextAnswerers,
      wordIndex: nextWordIndex,
      usedWordIndices: [...usedIndices, nextWordIndex],
      roundStartedAt: Date.now(),
      canvasClearedAt: Date.now(),
      teamProgress: null,
      roundWon: null,
      winningTeamId: null,
      strokes: null,
      showRace: null,
      spectatorCardUsed: null,
    })
  }

  const openRace = () => {
    // Broadcast to all players via Firebase
    update(ref(db, `rooms/${roomCode}`), { showRace: true })
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg animate-slide-up space-y-4">

        {/* Result banner */}
        <div
          className="rounded-2xl p-5 text-center"
          style={roundWon
            ? { background: 'rgba(0,177,79,0.1)', border: '1px solid rgba(0,177,79,0.3)', boxShadow: '0 0 32px rgba(0,177,79,0.1)' }
            : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }
          }
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: roundWon ? '#00B14F' : '#ef4444' }}>
            {roundWon ? 'Round complete' : "Time's up — nobody guessed"}
          </p>
          <h2 className="text-2xl font-black text-white">
            {roundWon ? 'Teams scored on remaining points' : 'No points this round'}
          </h2>
          {roundWon && (
            <p className="text-white/40 text-sm mt-1">
              Start at 250 pts · −50 per wrong guess
            </p>
          )}
        </div>

        {/* The word */}
        <div className="card text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">The word was</p>
          <p className="text-4xl font-black tracking-widest mb-2"
            style={{ background: 'linear-gradient(90deg, #00B14F, #00D460)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {wordEntry?.word}
          </p>
          <p className="text-white/30 text-sm">{wordEntry?.hint}</p>
        </div>

        {/* Per-team results */}
        <div className="card space-y-3">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Round Results</p>

          {/* Drawing team */}
          {drawer && drawingTeam && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(${hexToRgb(drawingTeam.color)}, 0.08)`, border: `1px solid rgba(${hexToRgb(drawingTeam.color)}, 0.2)` }}>
              {getTeamImage(drawingTeam.name)
                ? <img src={getTeamImage(drawingTeam.name)} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                : <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: drawingTeam.color }} />
              }
              <div className="flex-1">
                <p className="text-white/40 text-xs">Drew this round</p>
                <p className="text-white font-bold text-sm">{drawingTeam.name} — {drawer.name}</p>
              </div>
              {roundWon && (
                <div className="text-right">
                  <p className="font-black text-base" style={{ color: drawingTeam.color }}>+{DRAWING_TEAM_POINTS}</p>
                  <p className="text-white/30 text-xs">pts</p>
                </div>
              )}
            </div>
          )}

          {/* Each guessing team */}
          {teamResults.map(({ tid, team, succeeded, heartsLeft, pts, prog }) => {
            const isFirst = firstTeamResult?.tid === tid
            return (
              <div key={tid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: succeeded ? `rgba(${hexToRgb(team.color)}, 0.08)` : 'rgba(255,255,255,0.03)',
                  border: succeeded ? `1px solid rgba(${hexToRgb(team.color)}, 0.2)` : '1px solid rgba(255,255,255,0.06)',
                }}>
                {getTeamImage(team.name)
                  ? <img src={getTeamImage(team.name)} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                  : <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: team.color }} />
                }
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-bold text-sm">{team.name}</p>
                    {isFirst && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `rgba(${hexToRgb(team.color)}, 0.2)`, color: team.color }}>
                        First!
                      </span>
                    )}
                  </div>
                  {succeeded ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div className="h-full rounded-full"
                          style={{
                            width: `${(pts / 250) * 100}%`,
                            background: heartsLeft === MAX_WRONG ? '#00B14F' : heartsLeft === MAX_WRONG - 1 ? '#f59e0b' : '#ef4444',
                          }} />
                      </div>
                      <span className="text-white/50 text-xs tabular-nums">
                        {MAX_WRONG - heartsLeft} wrong · earned {pts} pts
                      </span>
                    </div>
                  ) : (
                    <p className="text-red-400/60 text-xs mt-0.5">
                      {prog.failed ? 'Points ran out' : 'Did not guess'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {succeeded ? (
                    <>
                      <p className="font-black text-base" style={{ color: team.color }}>+{pts}</p>
                      <p className="text-white/30 text-xs">pts</p>
                    </>
                  ) : (
                    <p className="text-white/20 font-bold text-sm">+0</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* See Race button — host triggers, members wait */}
        {isHost ? (
          <button
            className="w-full py-3.5 rounded-2xl font-black text-base tracking-wide transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #0d2b1a, #0a1f13)',
              border: '1px solid rgba(0,177,79,0.4)',
              color: '#00B14F',
              boxShadow: '0 0 24px rgba(0,177,79,0.15)',
            }}
            onClick={openRace}
          >
            🏁 Show Race Standings
          </button>
        ) : (
          <div className="w-full py-3.5 rounded-2xl text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-center gap-2 text-white/30 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-grab animate-pulse" />
              Waiting for host to show race…
            </div>
          </div>
        )}

      </div>

      {/* ── Full-screen race overlay ──
          Always mounted (never conditional) so RaceTrack.displayScores is
          initialised from the pre-round scores on first render. Using CSS
          visibility/opacity to show/hide instead of conditional rendering. ── */}
      <div
        className="fixed inset-0 z-50 flex flex-col overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at top, #0a2518 0%, #060e09 60%, #020705 100%)',
          opacity: showRace ? 1 : 0,
          visibility: showRace ? 'visible' : 'hidden',
          pointerEvents: showRace ? 'auto' : 'none',
          transition: 'opacity 0.5s ease',
        }}
      >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-8 pb-4 flex-shrink-0">
            <div>
              <p className="text-white/30 text-xs uppercase tracking-[0.2em] font-semibold">
                Round {currentRound + 1} of {totalRounds}
              </p>
              <h1 className="text-3xl font-black text-white tracking-tight mt-0.5">Race Standings</h1>
            </div>
            <div className="text-right">
              {showRace && !raceReady ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-white/30 uppercase tracking-widest">Get ready…</span>
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-grab animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-2xl animate-bounce-in">🏁</span>
              )}
            </div>
          </div>

          {/* Race track — always in DOM so displayScores survives until overlay opens */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 relative">
            <RaceTrack teams={teams} teamResults={teamResults} ready={raceReady} totalRounds={totalRounds} myTeamId={myTeamId} players={gameState?.players || {}} />
          </div>

          {/* No-score splash prompt — appears over the track when nobody scored */}
          {showNoScorePrompt && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center p-6"
              style={{ background: 'rgba(6,14,9,0.85)', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.4s ease forwards' }}
              onClick={() => setShowNoScorePrompt(false)}
            >
              <div className="text-center animate-bounce-in max-w-xs">
                <div className="text-7xl mb-4">😴</div>
                <h2 className="text-white font-black text-2xl tracking-tight mb-2">Nobody scored!</h2>
                <p className="text-white/50 text-base leading-snug mb-1">
                  No team guessed the word this round.
                </p>
                <p className="text-white/30 text-sm mb-6">Standings stay exactly the same.</p>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1.5">
                    {[...Object.values(teams)].map((t, i) => (
                      <div key={i} className="w-2 h-2 rounded-full opacity-60" style={{ background: t.color }} />
                    ))}
                  </div>
                  <p className="text-white/20 text-xs">Tap anywhere to see standings</p>
                </div>
              </div>
            </div>
          )}

          {/* Bottom actions */}
          <div className="px-4 pb-8 pt-3 flex-shrink-0 space-y-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {isHost ? (
              isLastRound ? (
                <>
                  <button className="btn-primary w-full text-base py-4" onClick={handleContinue}>
                    ▶ Continue — another round cycle
                  </button>
                  <p className="text-white/25 text-xs text-center">Scores carry over · Same teams · New words</p>
                  <button
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={handleNext}>
                    🏆 See final results
                  </button>
                </>
              ) : (
                <button className="btn-primary w-full text-base py-4" onClick={handleNext}>
                  Next round · {currentRound + 2} of {totalRounds}
                </button>
              )
            ) : (
              <div className="text-center flex items-center justify-center gap-2 text-white/30 text-sm py-3">
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
