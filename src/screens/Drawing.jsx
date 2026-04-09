import React, { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, update, remove } from 'firebase/database'
import { WORD_LIST, getRandomWordIndex } from '../data/wordList'
import { getTeamImage } from '../utils'
import DrawingCanvas from '../components/DrawingCanvas'
import LetterBoard from '../components/LetterBoard'
import Keyboard from '../components/Keyboard'
import PlayerAvatar from '../components/PlayerAvatar'
import Chat from '../components/Chat'

const COLORS = ['#000000', '#ffffff', '#ef4444', '#3b82f6', '#00B14F', '#eab308', '#f97316', '#a855f7', '#06b6d4', '#6b7280']
const BRUSH_SIZES = [3, 7, 14]
const DEFAULT_ROUND_TIME = 90
const MAX_WRONG = 3

const POWER_CARDS = [
  { id: 'reveal', emoji: '🔤', name: 'Reveal', desc: 'Expose a hidden letter for your team', cost: 50, targets: 'self' },
  { id: 'hex',    emoji: '💣', name: 'Hex',    desc: '+1 wrong penalty on an opponent',      cost: 40, targets: 'opponent' },
  { id: 'lock',   emoji: '🔒', name: 'Lock',   desc: 'Freeze an opponent\'s input for 6s',   cost: 80, targets: 'opponent' },
]

export default function Drawing({ playerId, playerName, roomCode, gameState, isHost, myTeamId, myTeam, exitRoom, exitRoomAsHost, deleteRoom }) {
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(7)
  const [isEraser, setIsEraser] = useState(false)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_ROUND_TIME)
  const [fullGuess, setFullGuess] = useState('')
  const [guessShake, setGuessShake] = useState(false)
  const [showHostPanel, setShowHostPanel] = useState(false)
  const [showExitMenu, setShowExitMenu] = useState(false)
  const [exitConfirm, setExitConfirm] = useState(null) // 'exit' | 'delete'
  const [cardPickTarget, setCardPickTarget] = useState(null) // cardId awaiting target team pick
  const [cardToast, setCardToast] = useState(null)           // { msg, color }
  const [isLocked, setIsLocked] = useState(false)
  const [showRoleNudge, setShowRoleNudge] = useState(true)
  const advancedRef = useRef(false)
  const lastCardRef = useRef(null)

  const teams = gameState?.teams || {}
  const players = gameState?.players || {}
  const drawingTeamId = gameState?.drawingTeamId
  const drawerId = gameState?.drawerId
  const answerers = gameState?.answerers || {}
  const wordEntry = WORD_LIST[gameState?.wordIndex]
  const teamProgress = gameState?.teamProgress || {}
  const ROUND_TIME = gameState?.roundDuration || DEFAULT_ROUND_TIME
  const isPaused = !!gameState?.timerPaused

  const isDrawer = drawerId === playerId

  // Word only visible while held down — releases hide it again
  const [wordRevealed, setWordRevealed] = useState(false)
  useEffect(() => { setWordRevealed(false) }, [gameState?.wordIndex])
  const isOnDrawingTeam = myTeamId === drawingTeamId
  const isAnswerer = !isOnDrawingTeam && answerers[myTeamId] === playerId

  // My team's guessing progress
  const myProgress = myTeamId ? (teamProgress[myTeamId] || {}) : {}
  const guessedLetters = myProgress.guessedLetters || {}
  const wrongLetters = myProgress.wrongLetters || {}
  // wrongGuesses tracks ALL wrong attempts: letters + full-word misses
  const wrongCount = myProgress.wrongGuesses || 0
  const myTeamDone = myProgress.done || false

  const drawer = players[drawerId]
  const drawingTeam = teams[drawingTeamId]

  // Timer — pauses when timerPaused is set, resumes from timerPausedAt offset
  useEffect(() => {
    advancedRef.current = false
    if (isPaused) return  // freeze display while paused
    const tick = () => {
      const pausedOffset = gameState?.timerPausedOffset || 0
      const elapsed = (Date.now() - (gameState?.roundStartedAt || Date.now())) / 1000 - pausedOffset
      setTimeLeft(Math.max(0, Math.ceil(ROUND_TIME - elapsed)))
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [gameState?.roundStartedAt, gameState?.currentRound, isPaused, gameState?.timerPausedOffset, ROUND_TIME])

  // Host auto-advance on timer expiry
  useEffect(() => {
    if (!isHost || !gameState?.roundStartedAt || isPaused) return
    advancedRef.current = false
    const pausedOffset = (gameState?.timerPausedOffset || 0) * 1000
    const elapsed = Date.now() - gameState.roundStartedAt - pausedOffset
    const remaining = Math.max(0, ROUND_TIME * 1000 - elapsed)
    const timer = setTimeout(async () => {
      if (advancedRef.current) return
      advancedRef.current = true
      await update(ref(db, `rooms/${roomCode}`), { phase: 'roundreveal', roundWon: false })
    }, remaining)
    return () => clearTimeout(timer)
  }, [gameState?.roundStartedAt, gameState?.currentRound, isHost, isPaused, gameState?.timerPausedOffset, ROUND_TIME])

  // Role nudge: show briefly at start of each round/word
  useEffect(() => {
    setShowRoleNudge(true)
    const t = setTimeout(() => setShowRoleNudge(false), 5000)
    return () => clearTimeout(t)
  }, [gameState?.currentRound, gameState?.wordIndex])

  // Lock card: auto-clear isLocked when lockedUntil expires
  useEffect(() => {
    const lockedUntil = myProgress.lockedUntil
    if (!lockedUntil || Date.now() >= lockedUntil) { setIsLocked(false); return }
    setIsLocked(true)
    const t = setTimeout(() => setIsLocked(false), lockedUntil - Date.now())
    return () => clearTimeout(t)
  }, [myProgress.lockedUntil])

  // Toast when a card is played against my team
  useEffect(() => {
    const lca = myProgress.lastCardAgainst
    if (!lca || lca.at === lastCardRef.current) return
    lastCardRef.current = lca.at
    const msgs = {
      hex:  `💣 ${lca.byTeamName} hexed you! −1 guess`,
      lock: `🔒 ${lca.byTeamName} locked your input for 6s!`,
    }
    showCardToast(msgs[lca.cardId] || '⚡ Power card!', '#ef4444')
  }, [myProgress.lastCardAgainst])

  const showCardToast = (msg, color = '#f59e0b') => {
    setCardToast({ msg, color })
    setTimeout(() => setCardToast(null), 3000)
  }

  // After any team finishes, check if all guessing teams are done → end round
  const checkRoundEnd = (myUpdatedProgress) => {
    const guessingTeamIds = Object.keys(teams).filter((tid) => tid !== drawingTeamId)
    const merged = { ...teamProgress, [myTeamId]: myUpdatedProgress }
    const allDone = guessingTeamIds.every((tid) => merged[tid]?.done)
    const anyWon = guessingTeamIds.some((tid) => merged[tid]?.done && !merged[tid]?.failed)
    return { allDone, anyWon }
  }

  const handleLetterGuess = async (letter) => {
    if (!isAnswerer || myTeamDone || isLocked || guessedLetters[letter] || wrongLetters[letter] || !wordEntry) return
    const wordLetters = [...new Set(wordEntry.word.toUpperCase().split('').filter((c) => c !== ' '))]
    const isCorrect = wordLetters.includes(letter)

    if (isCorrect) {
      const newGuessed = { ...guessedLetters, [letter]: true }
      const allGuessed = wordLetters.every((l) => newGuessed[l])
      const updates = { [`teamProgress/${myTeamId}/guessedLetters/${letter}`]: true }
      if (allGuessed) {
        const myUpdated = { ...myProgress, done: true, doneAt: Date.now() }
        updates[`teamProgress/${myTeamId}/done`] = true
        updates[`teamProgress/${myTeamId}/doneAt`] = myUpdated.doneAt
        const { allDone, anyWon } = checkRoundEnd(myUpdated)
        if (allDone) {
          updates.phase = 'roundreveal'
          updates.roundWon = anyWon
          advancedRef.current = true
        }
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
    } else {
      const newWrongCount = wrongCount + 1
      const myUpdated = { ...myProgress, wrongGuesses: newWrongCount }
      const updates = {
        [`teamProgress/${myTeamId}/wrongLetters/${letter}`]: true,
        [`teamProgress/${myTeamId}/wrongGuesses`]: newWrongCount,
      }
      if (newWrongCount >= MAX_WRONG) {
        myUpdated.done = true
        myUpdated.failed = true
        updates[`teamProgress/${myTeamId}/done`] = true
        updates[`teamProgress/${myTeamId}/failed`] = true
        const { allDone, anyWon } = checkRoundEnd(myUpdated)
        if (allDone) {
          updates.phase = 'roundreveal'
          updates.roundWon = anyWon
          advancedRef.current = true
        }
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
    }
  }

  const handleFullGuessSubmit = async (e) => {
    e.preventDefault()
    if (!isAnswerer || myTeamDone || isLocked || !wordEntry || !fullGuess.trim()) return
    const correct = fullGuess.trim().toUpperCase() === wordEntry.word.toUpperCase()
    if (correct) {
      const myUpdated = { ...myProgress, done: true, doneAt: Date.now() }
      const updates = {
        [`teamProgress/${myTeamId}/done`]: true,
        [`teamProgress/${myTeamId}/doneAt`]: myUpdated.doneAt,
      }
      const { allDone, anyWon } = checkRoundEnd(myUpdated)
      if (allDone) {
        updates.phase = 'roundreveal'
        updates.roundWon = anyWon
        advancedRef.current = true
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
      setFullGuess('')
    } else {
      // Wrong full-word guess: deduct a heart
      const newWrongCount = wrongCount + 1
      const myUpdated = { ...myProgress, wrongGuesses: newWrongCount }
      const updates = { [`teamProgress/${myTeamId}/wrongGuesses`]: newWrongCount }
      if (newWrongCount >= MAX_WRONG) {
        myUpdated.done = true
        myUpdated.failed = true
        updates[`teamProgress/${myTeamId}/done`] = true
        updates[`teamProgress/${myTeamId}/failed`] = true
        const { allDone, anyWon } = checkRoundEnd(myUpdated)
        if (allDone) {
          updates.phase = 'roundreveal'
          updates.roundWon = anyWon
          advancedRef.current = true
        }
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
      setGuessShake(true)
      setFullGuess('')
      setTimeout(() => setGuessShake(false), 600)
    }
  }

  const handleClear = async () => {
    await Promise.all([
      remove(ref(db, `rooms/${roomCode}/strokes`)),
      update(ref(db, `rooms/${roomCode}`), { canvasClearedAt: Date.now() }),
    ])
  }

  // ── Host actions ──────────────────────────────────────────
  const handleTogglePause = async () => {
    if (!isPaused) {
      // Pause: record when we paused (as elapsed seconds so far)
      const pausedOffset = gameState?.timerPausedOffset || 0
      const elapsedNow = (Date.now() - gameState.roundStartedAt) / 1000 - pausedOffset
      await update(ref(db, `rooms/${roomCode}`), {
        timerPaused: true,
        timerPausedElapsed: elapsedNow,
      })
    } else {
      // Resume: extend roundStartedAt to account for time paused
      const pausedElapsed = gameState?.timerPausedElapsed || 0
      const prevOffset = gameState?.timerPausedOffset || 0
      // New offset = time already paused before + this pause duration
      const thisPauseDuration = (Date.now() - gameState.roundStartedAt) / 1000 - pausedElapsed - prevOffset
      await update(ref(db, `rooms/${roomCode}`), {
        timerPaused: null,
        timerPausedElapsed: null,
        timerPausedOffset: prevOffset + thisPauseDuration,
      })
    }
    setShowHostPanel(false)
  }

  const handleEndRound = async () => {
    if (advancedRef.current) return
    advancedRef.current = true
    const guessingTeamIds = Object.keys(teams).filter(tid => tid !== drawingTeamId)
    const anyWon = guessingTeamIds.some(tid => teamProgress[tid]?.done && !teamProgress[tid]?.failed)
    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'roundreveal',
      roundWon: anyWon,
      timerPaused: null,
      timerPausedElapsed: null,
      timerPausedOffset: null,
    })
    setShowHostPanel(false)
  }

  const handleSkipWord = async () => {
    const usedIndices = gameState?.usedWordIndices || []
    const nextWordIndex = getRandomWordIndex(usedIndices)
    await update(ref(db, `rooms/${roomCode}`), {
      wordIndex: nextWordIndex,
      usedWordIndices: [...usedIndices, nextWordIndex],
      teamProgress: null,
      roundStartedAt: Date.now(),
      timerPaused: null,
      timerPausedElapsed: null,
      timerPausedOffset: null,
      spectatorCardUsed: null,
    })
    setShowHostPanel(false)
  }

  const handlePlayCard = async (cardId, targetTeamId) => {
    const card = POWER_CARDS.find((c) => c.id === cardId)
    if (!card || usedCard || myTeamScore < card.cost) return
    const updates = {}

    if (cardId === 'reveal') {
      const wordLetters = [...new Set((wordEntry?.word || '').toUpperCase().split('').filter((c) => c !== ' '))]
      const unguessed = wordLetters.filter((l) => !guessedLetters[l])
      if (unguessed.length === 0) return
      const letter = unguessed[Math.floor(Math.random() * unguessed.length)]
      updates[`teamProgress/${myTeamId}/guessedLetters/${letter}`] = true
      // Check if this completes the word
      const newGuessed = { ...guessedLetters, [letter]: true }
      if (wordLetters.every((l) => newGuessed[l])) {
        updates[`teamProgress/${myTeamId}/done`] = true
        updates[`teamProgress/${myTeamId}/doneAt`] = Date.now()
        const guessingIds = Object.keys(teams).filter((tid) => tid !== drawingTeamId)
        const merged = { ...teamProgress, [myTeamId]: { ...myProgress, done: true } }
        if (guessingIds.every((tid) => merged[tid]?.done) && !advancedRef.current) {
          advancedRef.current = true
          updates.phase = 'roundreveal'
          updates.roundWon = guessingIds.some((tid) => merged[tid]?.done && !merged[tid]?.failed)
        }
      }
      showCardToast(`🔤 Revealed "${letter}" for your team!`, myTeam?.color)

    } else if (cardId === 'hex') {
      const targetProg = teamProgress[targetTeamId] || {}
      const newWrong = (targetProg.wrongGuesses || 0) + 1
      updates[`teamProgress/${targetTeamId}/wrongGuesses`] = newWrong
      if (newWrong >= MAX_WRONG) {
        updates[`teamProgress/${targetTeamId}/done`] = true
        updates[`teamProgress/${targetTeamId}/failed`] = true
        const guessingIds = Object.keys(teams).filter((tid) => tid !== drawingTeamId)
        const merged = { ...teamProgress, [targetTeamId]: { ...targetProg, done: true, failed: true } }
        if (guessingIds.every((tid) => merged[tid]?.done) && !advancedRef.current) {
          advancedRef.current = true
          updates.phase = 'roundreveal'
          updates.roundWon = guessingIds.some((tid) => merged[tid]?.done && !merged[tid]?.failed)
        }
      }
      updates[`teamProgress/${targetTeamId}/lastCardAgainst`] = { cardId: 'hex', byTeamName: myTeam?.name, at: Date.now() }
      showCardToast(`💣 Hexed ${teams[targetTeamId]?.name}!`, myTeam?.color)

    } else if (cardId === 'lock') {
      updates[`teamProgress/${targetTeamId}/lockedUntil`] = Date.now() + 6000
      updates[`teamProgress/${targetTeamId}/lastCardAgainst`] = { cardId: 'lock', byTeamName: myTeam?.name, at: Date.now() }
      showCardToast(`🔒 Locked ${teams[targetTeamId]?.name} for 6s!`, myTeam?.color)
    }

    updates[`teams/${myTeamId}/score`] = Math.max(0, myTeamScore - card.cost)
    updates[`spectatorCardUsed/${playerId}`] = true
    await update(ref(db, `rooms/${roomCode}`), updates)
    setCardPickTarget(null)
  }

  const timerPct = timeLeft / ROUND_TIME
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 30 ? '#f59e0b' : '#00B14F'
  const teamIds = Object.keys(teams)

  // Who is answering for my team (if I'm not the answerer)?
  const myTeamAnswererId = myTeamId ? answerers[myTeamId] : null
  const myTeamAnswerer = myTeamAnswererId ? players[myTeamAnswererId] : null

  // Power card roles
  const isGuessingSpectator = !isHost && !isOnDrawingTeam && !isAnswerer && !!myTeamId && !myTeamDone
  const isDrawingSpectator  = !isHost && isOnDrawingTeam && !isDrawer && !!myTeamId
  const usedCard = !!(gameState?.spectatorCardUsed?.[playerId])
  const myTeamScore = myTeam?.score || 0

  // Guessing spectators get all 3; drawing spectators can only sabotage (no Reveal)
  const availableCards = isDrawingSpectator
    ? POWER_CARDS.filter((c) => c.targets === 'opponent')
    : POWER_CARDS

  return (
    <div className="flex flex-col" style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '1200px', height: '100dvh', overflow: 'hidden' }}>

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-2 lg:px-4 lg:py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }}
      >
        {/* Round */}
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="text-white/30 text-xs font-semibold uppercase tracking-wider">Round</div>
          <div className="text-white font-black text-lg leading-none">
            {(gameState?.currentRound || 0) + 1}
            <span className="text-white/25 font-normal text-sm">/{gameState?.totalRounds || 1}</span>
          </div>
        </div>

        {/* Timer */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            {isPaused && <span className="text-amber-400 text-xs font-black animate-pulse">⏸</span>}
            <div
              className={`font-black text-2xl tabular-nums leading-none ${timeLeft <= 10 && !isPaused ? 'timer-danger' : ''}`}
              style={{ color: isPaused ? '#f59e0b' : timerColor }}
            >
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
          <div className="w-16 h-0.5 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${timerPct * 100}%`, background: isPaused ? '#f59e0b' : timerColor }}
            />
          </div>
        </div>

        {/* Host gear + Exit menu */}
        <div className="flex items-center gap-1.5">
          {isHost && (
            <button
              onClick={() => setShowHostPanel(v => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              style={{
                background: showHostPanel ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${showHostPanel ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
              }}>
              <span className="text-sm">{showHostPanel ? '✕' : '⚙'}</span>
            </button>
          )}
          <button
            onClick={() => setShowExitMenu(v => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-sm leading-none">≡</span>
          </button>
        </div>

        {/* Team scores */}
        <div className="flex items-center gap-2 min-w-[80px] justify-end">
          {teamIds.map((tid) => {
            const team = teams[tid]
            const isDrawingTeam = tid === drawingTeamId
            const isMine = tid === myTeamId
            return (
              <div
                key={tid}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
                style={{
                  background: isMine ? `rgba(${hexToRgb(team.color)}, 0.12)` : 'transparent',
                  border: isMine ? `1px solid rgba(${hexToRgb(team.color)}, 0.25)` : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-1">
                  {getTeamImage(team.name)
                    ? <img src={getTeamImage(team.name)} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                    : <div className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                  }
                  <span className="text-white/60 text-[10px] font-semibold">{team.name.replace('Team ', '')}</span>
                  {isDrawingTeam && (
                    <span className="text-[9px]" style={{ color: team.color }}>✏</span>
                  )}
                </div>
                <span className="text-white font-black text-xs tabular-nums">{team.score || 0}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* Canvas area — capped on mobile, fills width on desktop */}
        <div className="flex-shrink-0 h-[44dvh] lg:h-auto lg:flex-1 flex flex-col p-2 lg:p-3 gap-1.5 lg:gap-2 min-h-0">

          {/* Context banner */}
          {isHost ? (
            /* Host sees the word clearly — they're monitoring, not playing */
            <div className="flex items-center justify-between px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div>
                <p className="text-amber-400/50 text-[10px] uppercase tracking-widest font-semibold mb-0.5">The word</p>
                <p className="text-white font-black text-xl tracking-widest">{wordEntry?.word}</p>
              </div>
              <div className="text-right">
                <p className="text-white/30 text-xs">{wordEntry?.category}</p>
                <p className="text-white/30 text-xs mt-0.5 max-w-[140px] leading-tight">{wordEntry?.hint?.slice(2)}</p>
              </div>
            </div>
          ) : isDrawer ? (
            <div
              className="flex items-center justify-between px-4 py-2.5 rounded-xl flex-shrink-0 w-full select-none cursor-pointer transition-all"
              style={{ background: wordRevealed ? 'rgba(0,177,79,0.12)' : 'rgba(0,177,79,0.06)', border: `1px solid ${wordRevealed ? 'rgba(0,177,79,0.35)' : 'rgba(0,177,79,0.15)'}`, padding: 'clamp(8px,2vw,10px) clamp(12px,3vw,16px)' }}
              onPointerDown={() => setWordRevealed(true)}
              onPointerUp={() => setWordRevealed(false)}
              onPointerLeave={() => setWordRevealed(false)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-0.5">
                  {wordRevealed ? 'Your word' : 'Hold to reveal your word'}
                </p>
                <p className="text-white font-black text-xl tracking-widest"
                  style={{
                    filter: wordRevealed ? 'none' : 'blur(10px)',
                    transition: 'filter 0.15s ease',
                    userSelect: 'none',
                  }}>
                  {wordEntry?.word}
                </p>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                {wordRevealed ? (
                  <>
                    <p className="text-white/30 text-xs">{wordEntry?.category}</p>
                    <p className="text-white/40 text-xs mt-0.5 max-w-[140px] text-right leading-tight">{wordEntry?.hint?.slice(2)}</p>
                  </>
                ) : (
                  <span className="text-2xl">👁️</span>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {drawer && (
                <>
                  <div className="relative">
                    <PlayerAvatar name={drawer.name} color={drawer.color} size="sm" />
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                      style={{ background: drawingTeam?.color || '#00B14F' }}
                    />
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px]">{drawingTeam?.name} is drawing</p>
                    <p className="text-white font-bold text-sm">{drawer.name}</p>
                  </div>
                </>
              )}
              <div className="ml-auto">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(0,177,79,0.12)', color: '#00B14F', border: '1px solid rgba(0,177,79,0.2)' }}
                >
                  {wordEntry?.category}
                </span>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div
            className="flex-1 min-h-[120px] rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <DrawingCanvas
              isDrawer={isDrawer}
              roomCode={roomCode}
              currentRound={gameState?.currentRound}
              canvasClearedAt={gameState?.canvasClearedAt}
              color={selectedColor}
              brushSize={brushSize}
              isEraser={isEraser}
            />
          </div>

          {/* Drawer toolbar */}
          {isDrawer && (
            <div
              className="rounded-xl p-2.5 flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setSelectedColor(c); setIsEraser(false) }}
                      style={{
                        backgroundColor: c,
                        width: '20px', height: '20px', borderRadius: '50%',
                        border: selectedColor === c && !isEraser ? '2.5px solid white' : '2px solid rgba(255,255,255,0.15)',
                        transform: selectedColor === c && !isEraser ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.15s ease', flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
                <button
                  onClick={() => setIsEraser(!isEraser)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={isEraser
                    ? { background: 'white', color: 'black' }
                    : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >Erase</button>
                <button
                  onClick={handleClear}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
                >Clear</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs mr-1">Size</span>
                {BRUSH_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => { setBrushSize(size); setIsEraser(false) }}
                    className="w-8 h-6 rounded-lg flex items-center justify-center transition-all"
                    style={brushSize === size && !isEraser
                      ? { background: 'rgba(0,177,79,0.25)', border: '1px solid rgba(0,177,79,0.5)' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    <div className="rounded-full"
                      style={{
                        width: `${size}px`, height: `${size}px`,
                        background: brushSize === size && !isEraser ? '#00B14F' : 'rgba(255,255,255,0.6)',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — fills remaining height on mobile, fixed width on desktop */}
        <div
          className="flex-1 min-h-0 flex flex-col lg:flex-shrink-0 lg:w-80"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >

          {/* ── HOST MONITOR SECTION ── */}
          {isHost ? (
            <div className="flex-shrink-0 p-2 lg:p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-400 text-xs">⚙</span>
                <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-widest">Host Monitor</p>
              </div>
              <div className="space-y-2">
                {teamIds.map((tid) => {
                  const team = teams[tid]
                  const prog = teamProgress[tid] || {}
                  const gl = prog.guessedLetters || {}
                  const wl = prog.wrongLetters || {}
                  const wrongN = prog.wrongGuesses || Object.keys(wl).length
                  const answererUid = answerers[tid]
                  const answererName = players[answererUid]?.name || '?'
                  const isDrawing = tid === drawingTeamId
                  return (
                    <div key={tid} className="rounded-xl px-3 py-2"
                      style={{ background: `rgba(${hexToRgb(team.color)}, 0.08)`, border: `1px solid rgba(${hexToRgb(team.color)}, 0.2)` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {getTeamImage(team.name)
                            ? <img src={getTeamImage(team.name)} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                            : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: team.color }} />
                          }
                          <span className="text-white/60 text-xs font-semibold">{team.name}</span>
                          {isDrawing && <span className="text-[9px]" style={{ color: team.color }}>✏ Drawing</span>}
                        </div>
                        {isDrawing ? (
                          <span className="text-white/25 text-[10px]">{players[drawerId]?.name}</span>
                        ) : prog.done ? (
                          prog.failed
                            ? <span className="text-red-400 text-[10px] font-bold">Out</span>
                            : <span className="text-[10px] font-bold" style={{ color: team.color }}>Got it!</span>
                        ) : (
                          <span className="text-[10px] font-bold tabular-nums"
                            style={{ color: wrongN === 0 ? 'rgba(255,255,255,0.3)' : wrongN === 1 ? '#f59e0b' : '#ef4444' }}>
                            {250 - wrongN * 50} pts · {answererName}
                          </span>
                        )}
                      </div>
                      {!isDrawing && (
                        <div className="flex gap-0.5 flex-wrap">
                          {(wordEntry?.word || '').toUpperCase().split('').map((char, i) =>
                            char === ' ' ? <div key={i} className="w-2" /> : (
                              <div key={i}
                                className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black"
                                style={{ background: gl[char] ? `rgba(${hexToRgb(team.color)}, 0.3)` : 'rgba(255,255,255,0.05)', color: gl[char] ? team.color : 'rgba(255,255,255,0.15)' }}>
                                {char}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : !isOnDrawingTeam ? (
            <div
              className="flex-shrink-0 p-2 lg:p-3 space-y-1.5 lg:space-y-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* My team's role badge */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: myTeam?.color }} />
                <span className="text-white/40 text-xs font-semibold">{myTeam?.name}</span>
                {myTeamDone ? (
                  myProgress.failed ? (
                    <span className="ml-auto text-[10px] text-red-400 font-bold">Out of guesses</span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold" style={{ color: myTeam?.color }}>Guessed it!</span>
                  )
                ) : isAnswerer ? (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.15)`, color: myTeam?.color }}>
                    Answering
                  </span>
                ) : (
                  <span className="ml-auto text-white/25 text-[10px]">
                    {myTeamAnswerer?.name} is answering
                  </span>
                )}
              </div>

              {/* Word board */}
              <LetterBoard
                word={wordEntry?.word || ''}
                guessedLetters={guessedLetters}
                wrongLetters={wrongLetters}
                wrongCount={wrongCount}
              />

              {/* Answerer controls */}
              {isAnswerer && !myTeamDone && (
                <>
                  {/* Lock banner */}
                  {isLocked && (
                    <div className="flex items-center justify-center gap-2 rounded-xl py-2 animate-pulse"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <span className="text-base">🔒</span>
                      <span className="text-red-400 font-black text-xs tracking-wide">Input locked!</span>
                    </div>
                  )}

                  {/* Letter keyboard */}
                  <Keyboard
                    guessedLetters={guessedLetters}
                    wrongLetters={wrongLetters}
                    onGuess={handleLetterGuess}
                    disabled={isLocked}
                  />

                  {/* Full word guess */}
                  <form onSubmit={handleFullGuessSubmit} className="flex gap-1.5">
                    <input
                      value={fullGuess}
                      onChange={(e) => setFullGuess(e.target.value.toUpperCase())}
                      placeholder={isLocked ? 'Locked…' : 'Or type the full word...'}
                      maxLength={40}
                      disabled={isLocked}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold tracking-widest outline-none transition-all ${guessShake ? 'animate-shake' : ''}`}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: guessShake ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        caretColor: 'white',
                        WebkitTextFillColor: 'white',
                        opacity: isLocked ? 0.4 : 1,
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!fullGuess.trim() || isLocked}
                      className="px-3 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                      style={{ background: myTeam?.color || '#00B14F', color: 'black' }}
                    >Go</button>
                  </form>
                </>
              )}

              {/* Spectator power cards */}
              {isGuessingSpectator && (
                <div className="space-y-2">
                  <p className="text-white/20 text-[10px] uppercase tracking-widest font-semibold">Power Cards</p>

                  {/* Card tray */}
                  <div className="flex gap-1.5">
                    {availableCards.map((card) => {
                      const canAfford = myTeamScore >= card.cost
                      const disabled = usedCard || !canAfford
                      const teamColor = myTeam?.color || '#00B14F'
                      return (
                        <button
                          key={card.id}
                          disabled={disabled}
                          title={card.desc}
                          onClick={() => {
                            if (card.targets === 'self') handlePlayCard(card.id, myTeamId)
                            else setCardPickTarget(cardPickTarget === card.id ? null : card.id)
                          }}
                          className="flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                          style={{
                            background: cardPickTarget === card.id
                              ? `rgba(${hexToRgb(teamColor)}, 0.2)`
                              : disabled ? 'rgba(255,255,255,0.03)' : `rgba(${hexToRgb(teamColor)}, 0.1)`,
                            border: `1px solid ${cardPickTarget === card.id
                              ? `rgba(${hexToRgb(teamColor)}, 0.5)`
                              : disabled ? 'rgba(255,255,255,0.06)' : `rgba(${hexToRgb(teamColor)}, 0.25)`}`,
                          }}
                        >
                          <span className="text-xl leading-none">{card.emoji}</span>
                          <span className="text-white/70 text-[9px] font-bold leading-none mt-0.5">{card.name}</span>
                          <span className="text-[9px] font-black leading-none" style={{ color: teamColor }}>{card.cost} pts</span>
                        </button>
                      )
                    })}
                  </div>

                  {usedCard && (
                    <p className="text-white/20 text-[10px] text-center">Card used this round ✓</p>
                  )}

                  {/* Target team picker */}
                  {cardPickTarget && (
                    <div className="rounded-xl overflow-hidden animate-slide-up"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-white/30 text-[10px] px-3 pt-2 pb-1 uppercase tracking-widest font-semibold">Pick target</p>
                      {Object.entries(teams)
                        .filter(([tid]) => tid !== myTeamId && tid !== drawingTeamId)
                        .map(([tid, team]) => (
                          <button
                            key={tid}
                            onClick={() => handlePlayCard(cardPickTarget, tid)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-all hover:bg-white/5 active:scale-95 text-left"
                          >
                            {getTeamImage(team.name)
                              ? <img src={getTeamImage(team.name)} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                              : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: team.color }} />
                            }
                            <span className="text-white/60 text-xs font-semibold">{team.name}</span>
                          </button>
                        ))}
                      <button onClick={() => setCardPickTarget(null)}
                        className="w-full px-3 py-1.5 text-white/25 text-[10px] hover:bg-white/5 text-center transition-all">
                        Cancel
                      </button>
                    </div>
                  )}

                  <p className="text-white/20 text-[10px] text-center">Chat below to help {myTeamAnswerer?.name}</p>
                </div>
              )}
            </div>
          ) : (
            /* Drawer side panel — watch other teams' progress */
            <div
              className="flex-shrink-0 p-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2">Teams guessing</p>
              <div className="space-y-2">
                {teamIds.filter((tid) => tid !== drawingTeamId).map((tid) => {
                  const team = teams[tid]
                  const prog = teamProgress[tid] || {}
                  const gl = prog.guessedLetters || {}
                  const wl = prog.wrongLetters || {}
                  const wrongN = prog.wrongGuesses || Object.keys(wl).length
                  const answererUid = answerers[tid]
                  const answererName = players[answererUid]?.name || '?'
                  return (
                    <div key={tid} className="rounded-xl px-3 py-2"
                      style={{ background: `rgba(${hexToRgb(team.color)}, 0.08)`, border: `1px solid rgba(${hexToRgb(team.color)}, 0.2)` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {getTeamImage(team.name)
                            ? <img src={getTeamImage(team.name)} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                            : <div className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                          }
                          <span className="text-white/60 text-xs font-semibold">{team.name}</span>
                        </div>
                        {prog.done ? (
                          prog.failed
                            ? <span className="text-red-400 text-[10px] font-bold">Out</span>
                            : <span className="text-[10px] font-bold" style={{ color: team.color }}>Got it!</span>
                        ) : (
                          <span className="text-[10px] font-bold tabular-nums"
                            style={{ color: wrongN === 0 ? 'rgba(255,255,255,0.3)' : wrongN === 1 ? '#f59e0b' : '#ef4444' }}>
                            {250 - wrongN * 50} pts
                          </span>
                        )}
                      </div>
                      {/* Mini word progress */}
                      <div className="flex gap-0.5 flex-wrap">
                        {(wordEntry?.word || '').toUpperCase().split('').map((char, i) =>
                          char === ' ' ? <div key={i} className="w-2" /> : (
                            <div key={i}
                              className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black"
                              style={{ background: gl[char] ? `rgba(${hexToRgb(team.color)}, 0.25)` : 'rgba(255,255,255,0.05)', color: gl[char] ? team.color : 'transparent' }}>
                              {char}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Drawing-team spectator power cards (Hex + Lock only) */}
              {isDrawingSpectator && (
                <div className="space-y-2 mt-3">
                  <p className="text-white/20 text-[10px] uppercase tracking-widest font-semibold">Power Cards</p>
                  <div className="flex gap-1.5">
                    {availableCards.map((card) => {
                      const canAfford = myTeamScore >= card.cost
                      const disabled = usedCard || !canAfford
                      const teamColor = myTeam?.color || '#00B14F'
                      return (
                        <button
                          key={card.id}
                          disabled={disabled}
                          title={card.desc}
                          onClick={() => setCardPickTarget(cardPickTarget === card.id ? null : card.id)}
                          className="flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                          style={{
                            background: cardPickTarget === card.id
                              ? `rgba(${hexToRgb(teamColor)}, 0.2)`
                              : disabled ? 'rgba(255,255,255,0.03)' : `rgba(${hexToRgb(teamColor)}, 0.1)`,
                            border: `1px solid ${cardPickTarget === card.id
                              ? `rgba(${hexToRgb(teamColor)}, 0.5)`
                              : disabled ? 'rgba(255,255,255,0.06)' : `rgba(${hexToRgb(teamColor)}, 0.25)`}`,
                          }}
                        >
                          <span className="text-xl leading-none">{card.emoji}</span>
                          <span className="text-white/70 text-[9px] font-bold leading-none mt-0.5">{card.name}</span>
                          <span className="text-[9px] font-black leading-none" style={{ color: teamColor }}>{card.cost} pts</span>
                        </button>
                      )
                    })}
                  </div>
                  {usedCard && <p className="text-white/20 text-[10px] text-center">Card used this round ✓</p>}
                  {cardPickTarget && (
                    <div className="rounded-xl overflow-hidden animate-slide-up"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-white/30 text-[10px] px-3 pt-2 pb-1 uppercase tracking-widest font-semibold">Pick target</p>
                      {Object.entries(teams)
                        .filter(([tid]) => tid !== drawingTeamId)
                        .map(([tid, team]) => (
                          <button key={tid} onClick={() => handlePlayCard(cardPickTarget, tid)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-all hover:bg-white/5 active:scale-95 text-left">
                            {getTeamImage(team.name)
                              ? <img src={getTeamImage(team.name)} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                              : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: team.color }} />
                            }
                            <span className="text-white/60 text-xs font-semibold">{team.name}</span>
                          </button>
                        ))}
                      <button onClick={() => setCardPickTarget(null)}
                        className="w-full px-3 py-1.5 text-white/25 text-[10px] hover:bg-white/5 text-center transition-all">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── CHAT SECTION ── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Chat
              roomCode={roomCode}
              playerId={playerId}
              playerName={playerName}
              myTeamId={myTeamId}
              myTeam={myTeam}
              teams={teams}
            />
          </div>
        </div>
      </div>

      {/* ── Host control panel dropdown ── */}
      {isHost && showHostPanel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowHostPanel(false)} />
          <div className="fixed top-14 right-4 z-40 rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
            style={{ background: 'rgba(10,20,14,0.97)', border: '1px solid rgba(245,158,11,0.25)', minWidth: 220, backdropFilter: 'blur(16px)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-amber-400/70 text-xs uppercase tracking-widest font-semibold">Host Controls</p>
            </div>
            <div className="p-2 space-y-1">
              <button onClick={handleTogglePause}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5 active:scale-95">
                <span className="text-lg">{isPaused ? '▶️' : '⏸️'}</span>
                <div>
                  <p className="text-white/80 text-sm font-semibold">{isPaused ? 'Resume timer' : 'Pause timer'}</p>
                  <p className="text-white/30 text-xs">{isPaused ? 'Clock resumes for everyone' : 'Freeze clock for everyone'}</p>
                </div>
              </button>
              <button onClick={handleSkipWord}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5 active:scale-95">
                <span className="text-lg">⏭️</span>
                <div>
                  <p className="text-white/80 text-sm font-semibold">Skip word</p>
                  <p className="text-white/30 text-xs">New word, round timer resets</p>
                </div>
              </button>
              <button onClick={handleEndRound}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-amber-500/10 active:scale-95">
                <span className="text-lg">⏩</span>
                <div>
                  <p className="text-amber-400 text-sm font-semibold">End round now</p>
                  <p className="text-white/30 text-xs">Go straight to results</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Exit menu dropdown ── */}
      {showExitMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowExitMenu(false)} />
          <div className="fixed top-14 right-4 z-40 rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
            style={{ background: 'rgba(10,20,14,0.97)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 200, backdropFilter: 'blur(16px)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Room options</p>
            </div>
            <div className="p-2 space-y-1">
              <button onClick={() => { setExitConfirm('exit'); setShowExitMenu(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5 active:scale-95">
                <span className="text-base">🚪</span>
                <div>
                  <p className="text-white/80 text-sm font-semibold">Leave room</p>
                  <p className="text-white/30 text-xs">{isHost ? 'Host transfers to next player' : 'You exit the game'}</p>
                </div>
              </button>
              {isHost && (
                <button onClick={() => { setExitConfirm('delete'); setShowExitMenu(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-red-500/10 active:scale-95">
                  <span className="text-base">🗑️</span>
                  <div>
                    <p className="text-red-400 text-sm font-semibold">Delete room</p>
                    <p className="text-white/30 text-xs">Ends the game for everyone</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Exit confirm modal */}
      {exitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl p-6 w-full max-w-xs animate-bounce-in"
            style={{ background: 'rgba(10,20,14,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="text-center mb-5">
              <span className="text-4xl">{exitConfirm === 'delete' ? '🗑️' : '🚪'}</span>
              <h3 className="text-white font-black text-lg mt-3">{exitConfirm === 'delete' ? 'Delete room?' : 'Leave room?'}</h3>
              <p className="text-white/40 text-sm mt-1">
                {exitConfirm === 'delete' ? 'This ends the game for all players.' : isHost ? 'Host role transfers to the next player.' : 'You will exit the current game.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setExitConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
              <button
                onClick={async () => {
                  setExitConfirm(null)
                  if (exitConfirm === 'delete') await deleteRoom()
                  else await (isHost ? exitRoomAsHost() : exitRoom())
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black active:scale-95"
                style={exitConfirm === 'delete' ? { background: 'rgba(239,68,68,0.9)', color: 'white' } : { background: 'rgba(0,177,79,0.9)', color: 'white' }}>
                {exitConfirm === 'delete' ? 'Delete' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role nudge overlay ── */}
      {showRoleNudge && !isHost && wordEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowRoleNudge(false)}
        >
          <div className="w-full max-w-sm animate-bounce-in text-center space-y-4"
            style={{ background: 'rgba(10,20,14,0.97)', border: `1px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.35)`, borderRadius: '1.5rem', padding: '2rem' }}>

            {isDrawer ? (
              <>
                <div className="text-5xl mb-2">🎨</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Your turn to draw</p>
                <p className="text-white font-black text-2xl leading-tight">Draw this word!</p>
                <div className="px-4 py-3 rounded-xl mt-2" style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.15)`, border: `1px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.3)` }}>
                  <p className="font-black text-3xl tracking-widest uppercase" style={{ color: myTeam?.color || '#00B14F' }}>{wordEntry.word}</p>
                  <p className="text-white/30 text-xs mt-1">{wordEntry.category} · {wordEntry.hint}</p>
                </div>
                <p className="text-white/20 text-xs">Don't say the word — draw it!</p>
              </>
            ) : isAnswerer ? (
              <>
                <div className="text-5xl mb-2">🔍</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Your turn to guess</p>
                <p className="text-white font-black text-2xl leading-tight">Guess the drawing!</p>
                <div className="px-4 py-3 rounded-xl mt-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-white/60 text-sm">
                    <span className="font-bold" style={{ color: drawingTeam?.color }}>{drawingTeam?.name}</span> is drawing
                  </p>
                  <p className="text-white/30 text-xs mt-1">Guess letters or type the full word</p>
                </div>
                <p className="text-white/20 text-xs">You're the answerer for your team</p>
              </>
            ) : isOnDrawingTeam ? (
              <>
                <div className="text-5xl mb-2">👀</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">You're on the drawing team</p>
                <p className="text-white font-black text-2xl leading-tight">Cheer your drawer on!</p>
                <div className="px-4 py-3 rounded-xl mt-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-white/50 text-sm">Use <span className="font-bold text-white">💣 Hex</span> or <span className="font-bold text-white">🔒 Lock</span> to sabotage guessing teams</p>
                </div>
                <p className="text-white/20 text-xs">Spend your team points strategically</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">⚡</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">You're a spectator</p>
                <p className="text-white font-black text-2xl leading-tight">Play your power cards!</p>
                <div className="px-4 py-3 rounded-xl mt-2 space-y-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-white/50 text-sm">🔤 <span className="font-bold text-white">Reveal</span> — show a hidden letter for your team</p>
                  <p className="text-white/50 text-sm">💣 <span className="font-bold text-white">Hex</span> — add a penalty to opponents</p>
                  <p className="text-white/50 text-sm">🔒 <span className="font-bold text-white">Lock</span> — freeze an opponent's input</p>
                </div>
                <p className="text-white/20 text-xs">You can only play one card per round</p>
              </>
            )}

            <p className="text-white/15 text-[10px] mt-2">Tap anywhere to dismiss</p>
          </div>
        </div>
      )}

      {/* Power card toast */}
      {cardToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-2xl animate-slide-up pointer-events-none"
          style={{ background: `rgba(0,0,0,0.85)`, border: `1px solid ${cardToast.color}`, backdropFilter: 'blur(12px)' }}>
          <span className="font-black text-sm" style={{ color: cardToast.color }}>{cardToast.msg}</span>
        </div>
      )}

      {/* Paused overlay banner */}
      {isPaused && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', backdropFilter: 'blur(12px)' }}>
          <span className="text-amber-400 animate-pulse">⏸</span>
          <span className="text-amber-400 font-black text-sm tracking-wide">Round paused by host</span>
        </div>
      )}
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
