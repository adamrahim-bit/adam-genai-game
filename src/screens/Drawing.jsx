import React, { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, update, remove, increment } from 'firebase/database'
import { WORD_LIST, getRandomWordIndex } from '../data/wordList'
import { getTeamImage } from '../utils'
import DrawingCanvas from '../components/DrawingCanvas'
import LetterBoard from '../components/LetterBoard'
import Keyboard from '../components/Keyboard'
import PlayerAvatar from '../components/PlayerAvatar'
import Chat from '../components/Chat'

const COLORS = ['#000000', '#ffffff', '#ef4444', '#3b82f6', '#00B14F', '#eab308', '#f97316', '#a855f7', '#06b6d4', '#6b7280']
const BRUSH_SIZES = [3, 7, 14]
const DEFAULT_ROUND_TIME = 240
const PREP_TIME = 15           // seconds drawer studies word before guessing opens
const MAX_WRONG = 3

const POWER_CARDS = [
  { id: 'hint',     emoji: '💡', name: 'Hint',     desc: 'Reveal the word hint',                       cost: 50, targets: 'self'   },
  { id: 'sabotage', emoji: '💣', name: 'Sabotage', desc: 'Add +1 wrong guess to a specific player',    cost: 60, targets: 'player' },
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
  const [cardPickTarget, setCardPickTarget] = useState(null) // cardId awaiting player pick
  const [cardToast, setCardToast] = useState(null)           // { msg, color }
  const [hintRevealed, setHintRevealed] = useState(false)
  const [inPrepPhase, setInPrepPhase] = useState(true)
  const [prepCountdown, setPrepCountdown] = useState(PREP_TIME)
  const [showRoleNudge, setShowRoleNudge] = useState(false)
  const roleNudgeShownRef = useRef(false)
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
  useEffect(() => { setHintRevealed(false) }, [gameState?.wordIndex, gameState?.currentRound])
  const isOnDrawingTeam = myTeamId === drawingTeamId
  const isAnswerer = !isOnDrawingTeam && answerers[myTeamId] === playerId

  // Individual progress — each player tracks their own guesses
  const myTeamProgress = myTeamId ? (teamProgress[myTeamId] || {}) : {}
  const myProgress = myTeamId ? (myTeamProgress.members?.[playerId] || {}) : {}
  const guessedLetters = myProgress.guessedLetters || {}
  const wrongLetters = myProgress.wrongLetters || {}
  const wrongCount = myProgress.wrongGuesses || 0
  const myPersonalDone = myProgress.done || false   // this player finished
  const myTeamDone = myTeamProgress.done || false   // ALL members of team finished

  const drawer = players[drawerId]
  const drawingTeam = teams[drawingTeamId]

  // Timer — handles 15s prep phase then main countdown. Pauses respect timerPausedOffset.
  useEffect(() => {
    advancedRef.current = false
    roleNudgeShownRef.current = false
    setInPrepPhase(true)
    setPrepCountdown(PREP_TIME)
    setShowRoleNudge(false)

    if (isPaused) return
    const tick = () => {
      const pausedOffset = gameState?.timerPausedOffset || 0
      const totalElapsed = (Date.now() - (gameState?.roundStartedAt || Date.now())) / 1000 - pausedOffset
      if (totalElapsed < PREP_TIME) {
        setInPrepPhase(true)
        setPrepCountdown(Math.ceil(PREP_TIME - totalElapsed))
        setTimeLeft(ROUND_TIME)
      } else {
        setInPrepPhase(false)
        setPrepCountdown(0)
        const gameElapsed = totalElapsed - PREP_TIME
        setTimeLeft(Math.max(0, Math.ceil(ROUND_TIME - gameElapsed)))
      }
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [gameState?.roundStartedAt, gameState?.currentRound, isPaused, gameState?.timerPausedOffset, ROUND_TIME])

  // Show role nudge once prep ends (not before)
  useEffect(() => {
    if (!inPrepPhase && !roleNudgeShownRef.current) {
      roleNudgeShownRef.current = true
      setShowRoleNudge(true)
      const t = setTimeout(() => setShowRoleNudge(false), 5000)
      return () => clearTimeout(t)
    }
  }, [inPrepPhase])

  // Host auto-advance on timer expiry (fires after PREP_TIME + ROUND_TIME total)
  useEffect(() => {
    if (!isHost || !gameState?.roundStartedAt || isPaused) return
    advancedRef.current = false
    const pausedOffset = (gameState?.timerPausedOffset || 0) * 1000
    const elapsed = Date.now() - gameState.roundStartedAt - pausedOffset
    const remaining = Math.max(0, (PREP_TIME + ROUND_TIME) * 1000 - elapsed)
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

  // Toast when a card is played against this player
  useEffect(() => {
    const lca = myProgress.lastCardAgainst
    if (!lca || lca.at === lastCardRef.current) return
    lastCardRef.current = lca.at
    const msgs = {
      sabotage: `💣 ${lca.byTeamName} sabotaged you! −1 guess`,
    }
    showCardToast(msgs[lca.cardId] || '⚡ Power card!', '#ef4444')
  }, [myProgress.lastCardAgainst])

  const showCardToast = (msg, color = '#f59e0b') => {
    setCardToast({ msg, color })
    setTimeout(() => setCardToast(null), 3000)
  }

  const memberPath = `teamProgress/${myTeamId}/members/${playerId}`

  // Returns true if every member of myTeam is done, given this player's updated state
  const checkTeamDone = (myPersonalUpdated) => {
    const teamMembers = teams[myTeamId]?.memberIds || []
    return teamMembers.every((pid) => {
      if (pid === playerId) return myPersonalUpdated.done
      return !!(myTeamProgress.members?.[pid]?.done)
    })
  }

  // Returns { allDone, anyWon } across all guessing teams, given myTeam's done status
  const checkRoundEnd = (myTeamNowDone = false) => {
    const guessingTeamIds = Object.keys(teams).filter((tid) => tid !== drawingTeamId)
    const allDone = guessingTeamIds.every((tid) => {
      if (tid === myTeamId) return myTeamNowDone
      return !!(teamProgress[tid]?.done)
    })
    const anyWon = guessingTeamIds.some((tid) => {
      const members = teams[tid]?.memberIds || []
      const prog = teamProgress[tid] || {}
      return members.some((pid) => prog.members?.[pid]?.done && !prog.members?.[pid]?.failed)
    })
    return { allDone, anyWon }
  }

  const handleLetterGuess = async (letter) => {
    if (isOnDrawingTeam || isHost || inPrepPhase || myPersonalDone || guessedLetters[letter] || wrongLetters[letter] || !wordEntry) return
    const wordLetters = [...new Set(wordEntry.word.toUpperCase().split('').filter((c) => c !== ' '))]
    const isCorrect = wordLetters.includes(letter)

    if (isCorrect) {
      const newGuessed = { ...guessedLetters, [letter]: true }
      const allGuessed = wordLetters.every((l) => newGuessed[l])
      const updates = { [`${memberPath}/guessedLetters/${letter}`]: true }
      if (allGuessed) {
        const earnedScore = Math.max(0, 250 - 50 * wrongCount)
        updates[`${memberPath}/done`] = true
        updates[`${memberPath}/doneAt`] = Date.now()
        updates[`${memberPath}/score`] = earnedScore
        updates[`teams/${myTeamId}/score`] = increment(earnedScore)
        const teamNowDone = checkTeamDone({ done: true })
        if (teamNowDone) {
          updates[`teamProgress/${myTeamId}/done`] = true
          const { allDone, anyWon } = checkRoundEnd(true)
          if (allDone && !advancedRef.current) {
            advancedRef.current = true
            updates.phase = 'roundreveal'
            updates.roundWon = anyWon
          }
        }
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
    } else {
      const newWrongCount = wrongCount + 1
      const updates = {
        [`${memberPath}/wrongLetters/${letter}`]: true,
        [`${memberPath}/wrongGuesses`]: increment(1),
      }
      if (newWrongCount >= MAX_WRONG) {
        updates[`${memberPath}/done`] = true
        updates[`${memberPath}/failed`] = true
        const teamNowDone = checkTeamDone({ done: true })
        if (teamNowDone) {
          updates[`teamProgress/${myTeamId}/done`] = true
          const { allDone, anyWon } = checkRoundEnd(true)
          if (allDone && !advancedRef.current) {
            advancedRef.current = true
            updates.phase = 'roundreveal'
            updates.roundWon = anyWon
          }
        }
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
    }
  }

  const handleFullGuessSubmit = async (e) => {
    e.preventDefault()
    if (isOnDrawingTeam || isHost || inPrepPhase || myPersonalDone || !wordEntry || !fullGuess.trim()) return
    const correct = fullGuess.trim().toUpperCase() === wordEntry.word.toUpperCase()
    if (correct) {
      const earnedScore = Math.max(0, 250 - 50 * wrongCount)
      const updates = {
        [`${memberPath}/done`]: true,
        [`${memberPath}/doneAt`]: Date.now(),
        [`${memberPath}/score`]: earnedScore,
        [`teams/${myTeamId}/score`]: increment(earnedScore),
      }
      const teamNowDone = checkTeamDone({ done: true })
      if (teamNowDone) {
        updates[`teamProgress/${myTeamId}/done`] = true
        const { allDone, anyWon } = checkRoundEnd(true)
        if (allDone && !advancedRef.current) {
          advancedRef.current = true
          updates.phase = 'roundreveal'
          updates.roundWon = anyWon
        }
      }
      await update(ref(db, `rooms/${roomCode}`), updates)
      setFullGuess('')
    } else {
      const newWrongCount = wrongCount + 1
      const updates = { [`${memberPath}/wrongGuesses`]: increment(1) }
      if (newWrongCount >= MAX_WRONG) {
        updates[`${memberPath}/done`] = true
        updates[`${memberPath}/failed`] = true
        const teamNowDone = checkTeamDone({ done: true })
        if (teamNowDone) {
          updates[`teamProgress/${myTeamId}/done`] = true
          const { allDone, anyWon } = checkRoundEnd(true)
          if (allDone && !advancedRef.current) {
            advancedRef.current = true
            updates.phase = 'roundreveal'
            updates.roundWon = anyWon
          }
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
    const anyWon = guessingTeamIds.some(tid =>
      (teams[tid]?.memberIds || []).some(pid => teamProgress[tid]?.members?.[pid]?.done && !teamProgress[tid]?.members?.[pid]?.failed)
    )
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

  // targetId is null for 'hint', or a playerId for 'sabotage'
  const handlePlayCard = async (cardId, targetId) => {
    const card = POWER_CARDS.find((c) => c.id === cardId)
    if (!card || usedCard || myTeamScore < card.cost) return
    const updates = {}

    if (cardId === 'hint') {
      setHintRevealed(true)
      showCardToast(`💡 ${wordEntry?.hint || 'No hint available'}`, myTeam?.color)

    } else if (cardId === 'sabotage') {
      const targetTeamId = Object.entries(teams).find(([, t]) => t.memberIds?.includes(targetId))?.[0]
      if (!targetTeamId) return
      const targetMemberPath = `teamProgress/${targetTeamId}/members/${targetId}`
      const targetProg = teamProgress[targetTeamId]?.members?.[targetId] || {}
      const targetPlayer = players[targetId]
      const newWrong = (targetProg.wrongGuesses || 0) + 1
      updates[`${targetMemberPath}/wrongGuesses`] = increment(1)
      updates[`${targetMemberPath}/lastCardAgainst`] = { cardId: 'sabotage', byTeamName: myTeam?.name, at: Date.now() }
      if (newWrong >= MAX_WRONG) {
        updates[`${targetMemberPath}/done`] = true
        updates[`${targetMemberPath}/failed`] = true
        // Check if this eliminates the whole target team
        const targetMembers = teams[targetTeamId]?.memberIds || []
        const allTargetDone = targetMembers.every((pid) => {
          if (pid === targetId) return true
          return !!(teamProgress[targetTeamId]?.members?.[pid]?.done)
        })
        if (allTargetDone) {
          updates[`teamProgress/${targetTeamId}/done`] = true
          const guessingIds = Object.keys(teams).filter((tid) => tid !== drawingTeamId)
          const allTeamsDone = guessingIds.every((tid) =>
            tid === targetTeamId ? true : !!(teamProgress[tid]?.done)
          )
          if (allTeamsDone && !advancedRef.current) {
            advancedRef.current = true
            const anyWon = guessingIds.some((tid) => {
              const members = teams[tid]?.memberIds || []
              const prog = teamProgress[tid] || {}
              return members.some((pid) => {
                const done = tid === targetTeamId && pid === targetId ? true : prog.members?.[pid]?.done
                const failed = tid === targetTeamId && pid === targetId ? true : prog.members?.[pid]?.failed
                return done && !failed
              })
            })
            updates.phase = 'roundreveal'
            updates.roundWon = anyWon
          }
        }
      }
      showCardToast(`💣 Sabotaged ${targetPlayer?.name || 'them'}!`, myTeam?.color)
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
  const isGuessingMember  = !isHost && !isOnDrawingTeam && !!myTeamId && !myPersonalDone
  const isDrawingSpectator = !isHost && isOnDrawingTeam && !isDrawer && !!myTeamId
  const usedCard = !!(gameState?.spectatorCardUsed?.[playerId])
  const myTeamScore = myTeam?.score || 0
  // Guessers: Hint + Sabotage. Drawing spectators: Sabotage only. Drawer: none.
  const availableCards = isDrawingSpectator
    ? POWER_CARDS.filter((c) => c.id === 'sabotage')
    : isGuessingMember
      ? POWER_CARDS
      : []


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

          {/* Drawer action prompt */}
          {isDrawer && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(0,177,79,0.08)', border: '1px solid rgba(0,177,79,0.2)' }}>
              <span className="text-sm">🎨</span>
              <p className="text-white/50 text-xs font-semibold">Sketch it out — no writing or speaking!</p>
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
                  const teamProg = teamProgress[tid] || {}
                  const isDrawing = tid === drawingTeamId
                  const doneCount = (team.memberIds || []).filter(pid => teamProg.members?.[pid]?.done).length
                  const total = (team.memberIds || []).length
                  return (
                    <div key={tid} className="rounded-xl px-3 py-2"
                      style={{ background: `rgba(${hexToRgb(team.color)}, 0.08)`, border: `1px solid rgba(${hexToRgb(team.color)}, 0.2)` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {getTeamImage(team.name)
                            ? <img src={getTeamImage(team.name)} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                            : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: team.color }} />
                          }
                          <span className="text-white/60 text-xs font-semibold">{team.name}</span>
                          {isDrawing && <span className="text-[9px]" style={{ color: team.color }}>✏ Drawing</span>}
                        </div>
                        {!isDrawing && (
                          <span className="text-[10px] tabular-nums" style={{ color: team.color }}>{doneCount}/{total} done</span>
                        )}
                      </div>
                      {/* Per-member progress rows */}
                      {!isDrawing && (team.memberIds || []).map((pid) => {
                        const mp = teamProg.members?.[pid] || {}
                        const wn = mp.wrongGuesses || 0
                        return (
                          <div key={pid} className="flex items-center gap-1.5 mt-1">
                            <span className="text-white/40 text-[9px] w-16 truncate">{players[pid]?.name}</span>
                            {mp.done ? (
                              mp.failed
                                ? <span className="text-red-400 text-[9px] font-bold">Out</span>
                                : <span className="text-[9px] font-bold" style={{ color: team.color }}>✓ {mp.score || 0}pts</span>
                            ) : (
                              <span className="text-white/25 text-[9px]">{wn > 0 ? `${wn} wrong` : 'guessing…'}</span>
                            )}
                          </div>
                        )
                      })}
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
              {/* Role action banner */}
              {!myPersonalDone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.12)`, border: `1px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.3)` }}>
                  <span className="text-base">🔍</span>
                  <div className="min-w-0">
                    <p className="font-black text-xs" style={{ color: myTeam?.color }}>Guess on your own!</p>
                    <p className="text-white/40 text-[10px] leading-tight">Tap letters or type the full word</p>
                  </div>
                </div>
              )}

              {/* Hint reveal banner */}
              {hintRevealed && wordEntry && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <span className="text-base">💡</span>
                  <p className="text-amber-400 font-bold text-xs leading-tight">{wordEntry.hint}</p>
                </div>
              )}

              {/* My team's role badge */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: myTeam?.color }} />
                <span className="text-white/40 text-xs font-semibold">{myTeam?.name}</span>
                {myPersonalDone ? (
                  myProgress.failed ? (
                    <span className="ml-auto text-[10px] text-red-400 font-bold">Out of guesses</span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold" style={{ color: myTeam?.color }}>Guessed it!</span>
                  )
                ) : (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.15)`, color: myTeam?.color }}>
                    Guessing
                  </span>
                )}
              </div>

              {/* Individual word board */}
              <LetterBoard
                word={wordEntry?.word || ''}
                guessedLetters={guessedLetters}
                wrongLetters={wrongLetters}
                wrongCount={wrongCount}
              />

              {/* Guessing controls */}
              {!myPersonalDone && (
                <>
                  <Keyboard
                    guessedLetters={guessedLetters}
                    wrongLetters={wrongLetters}
                    onGuess={handleLetterGuess}
                  />
                  <form onSubmit={handleFullGuessSubmit} className="flex gap-1.5">
                    <input
                      value={fullGuess}
                      onChange={(e) => setFullGuess(e.target.value.toUpperCase())}
                      placeholder="Or type the full word..."
                      maxLength={40}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold tracking-widest outline-none transition-all ${guessShake ? 'animate-shake' : ''}`}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: guessShake ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
                        color: 'white', caretColor: 'white', WebkitTextFillColor: 'white',
                      }}
                    />
                    <button type="submit" disabled={!fullGuess.trim()}
                      className="px-3 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                      style={{ background: myTeam?.color || '#00B14F', color: 'black' }}>Go</button>
                  </form>
                </>
              )}

              {/* Power cards — Hint + Sabotage for guessing members */}
              {isGuessingMember && availableCards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white/20 text-[10px] uppercase tracking-widest font-semibold">Power Cards</p>
                  <div className="flex gap-1.5">
                    {availableCards.map((card) => {
                      const canAfford = myTeamScore >= card.cost
                      const disabled = usedCard || !canAfford || (card.id === 'hint' && hintRevealed)
                      const teamColor = myTeam?.color || '#00B14F'
                      const isSelected = cardPickTarget === card.id
                      return (
                        <button key={card.id} disabled={disabled} title={card.desc}
                          onClick={() => {
                            if (card.id === 'hint') handlePlayCard('hint', null)
                            else setCardPickTarget(isSelected ? null : card.id)
                          }}
                          className="flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                          style={{
                            background: isSelected ? `rgba(${hexToRgb(teamColor)}, 0.2)` : disabled ? 'rgba(255,255,255,0.03)' : `rgba(${hexToRgb(teamColor)}, 0.1)`,
                            border: `1px solid ${isSelected ? `rgba(${hexToRgb(teamColor)}, 0.5)` : disabled ? 'rgba(255,255,255,0.06)' : `rgba(${hexToRgb(teamColor)}, 0.25)`}`,
                          }}>
                          <span className="text-xl leading-none">{card.emoji}</span>
                          <span className="text-white/70 text-[9px] font-bold leading-none mt-0.5">{card.name}</span>
                          <span className="text-[9px] font-black leading-none" style={{ color: teamColor }}>{card.cost} pts</span>
                        </button>
                      )
                    })}
                  </div>
                  {usedCard && <p className="text-white/20 text-[10px] text-center">Card used this round ✓</p>}
                  {/* Sabotage: pick a player on any other guessing team */}
                  {cardPickTarget === 'sabotage' && (
                    <div className="rounded-xl overflow-hidden animate-slide-up"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-white/30 text-[10px] px-3 pt-2 pb-1 uppercase tracking-widest font-semibold">Pick a player to sabotage</p>
                      {Object.entries(teams)
                        .filter(([tid]) => tid !== drawingTeamId && tid !== myTeamId)
                        .flatMap(([tid, team]) => (team.memberIds || []).map((pid) => ({ pid, team, tid })))
                        .filter(({ pid }) => !teamProgress[Object.entries(teams).find(([,t])=>t.memberIds?.includes(pid))?.[0]]?.members?.[pid]?.done)
                        .map(({ pid, team }) => {
                          const p = players[pid]
                          if (!p) return null
                          return (
                            <button key={pid} onClick={() => handlePlayCard('sabotage', pid)}
                              className="w-full flex items-center gap-2 px-3 py-2 transition-all hover:bg-white/5 active:scale-95 text-left">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                style={{ background: `rgba(${hexToRgb(team.color)}, 0.2)`, color: team.color }}>
                                {p.name?.[0]?.toUpperCase()}
                              </div>
                              <span className="text-white/70 text-xs font-semibold">{p.name}</span>
                              <span className="text-white/25 text-[10px] ml-1">{team.name}</span>
                            </button>
                          )
                        })}
                      <button onClick={() => setCardPickTarget(null)}
                        className="w-full px-3 py-1.5 text-white/25 text-[10px] hover:bg-white/5 text-center transition-all">Cancel</button>
                    </div>
                  )}
                  <p className="text-white/20 text-[10px] text-center">Chat with your team below</p>
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
                  const teamProg = teamProgress[tid] || {}
                  const doneCount = (team.memberIds || []).filter(pid => teamProg.members?.[pid]?.done).length
                  const total = (team.memberIds || []).length
                  return (
                    <div key={tid} className="rounded-xl px-3 py-2"
                      style={{ background: `rgba(${hexToRgb(team.color)}, 0.08)`, border: `1px solid rgba(${hexToRgb(team.color)}, 0.2)` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {getTeamImage(team.name)
                            ? <img src={getTeamImage(team.name)} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                            : <div className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                          }
                          <span className="text-white/60 text-xs font-semibold">{team.name}</span>
                        </div>
                        <span className="text-[10px] tabular-nums" style={{ color: team.color }}>{doneCount}/{total}</span>
                      </div>
                      {(team.memberIds || []).map((pid) => {
                        const mp = teamProg.members?.[pid] || {}
                        const wn = mp.wrongGuesses || 0
                        return (
                          <div key={pid} className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-white/35 text-[9px] w-14 truncate">{players[pid]?.name}</span>
                            {mp.done ? (
                              mp.failed
                                ? <span className="text-red-400 text-[9px]">Out</span>
                                : <span className="text-[9px] font-bold" style={{ color: team.color }}>✓ {mp.score || 0}pts</span>
                            ) : (
                              <span className="text-white/20 text-[9px]">{wn > 0 ? `${wn} wrong` : '…'}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Drawing spectator action banner */}
              {isDrawingSpectator && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-1"
                  style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.08)`, border: `1px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.2)` }}>
                  <span className="text-base">💣</span>
                  <div>
                    <p className="font-black text-xs" style={{ color: myTeam?.color }}>Sabotage the guessing teams!</p>
                    <p className="text-white/30 text-[10px]">Spend your team's points to slow them down</p>
                  </div>
                </div>
              )}

              {/* Drawing-team spectator power cards — Sabotage, pick a specific person */}
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

                  {/* Player picker — shows individual players on guessing teams */}
                  {cardPickTarget && (
                    <div className="rounded-xl overflow-hidden animate-slide-up"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-white/30 text-[10px] px-3 pt-2 pb-1 uppercase tracking-widest font-semibold">Pick a player to sabotage</p>
                      {Object.entries(teams)
                        .filter(([tid]) => tid !== drawingTeamId)
                        .flatMap(([tid, team]) => (team.memberIds || []).map((pid) => ({ pid, team, tid })))
                        .filter(({ pid, tid }) => !teamProgress[tid]?.members?.[pid]?.done)
                        .map(({ pid, team }) => {
                          const p = players[pid]
                          if (!p) return null
                          return (
                            <button key={pid} onClick={() => handlePlayCard(cardPickTarget, pid)}
                              className="w-full flex items-center gap-2 px-3 py-2 transition-all hover:bg-white/5 active:scale-95 text-left">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                style={{ background: `rgba(${hexToRgb(team.color)}, 0.2)`, color: team.color }}>
                                {p.name?.[0]?.toUpperCase()}
                              </div>
                              <span className="text-white/70 text-xs font-semibold">{p.name}</span>
                              <span className="text-white/25 text-[10px] ml-1.5">{team.name}</span>
                            </button>
                          )
                        })}
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

      {/* ── Prep phase overlay (15s before guessing opens) ── */}
      {inPrepPhase && !isHost && wordEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-sm text-center space-y-4 animate-bounce-in"
            style={{ background: 'rgba(10,20,14,0.97)', border: `1px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.4)`, borderRadius: '1.5rem', padding: '2rem' }}>

            {isDrawer ? (
              <>
                <div className="text-5xl">🎨</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Your word to draw</p>
                <div className="px-4 py-4 rounded-2xl" style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.15)`, border: `1px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.35)` }}>
                  <p className="font-black text-4xl tracking-widest uppercase leading-tight" style={{ color: myTeam?.color || '#00B14F' }}>{wordEntry.word}</p>
                  <p className="text-white/35 text-xs mt-2">{wordEntry.category} · {wordEntry.hint}</p>
                </div>
                <p className="text-white/50 text-sm">Study the word, then start drawing!</p>
                <p className="text-white/20 text-xs">No writing or speaking the answer</p>
              </>
            ) : isOnDrawingTeam ? (
              <>
                <div className="text-5xl">👀</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Get ready</p>
                <p className="text-white font-black text-2xl leading-tight">{players[drawerId]?.name} is drawing</p>
                <p className="text-white/40 text-sm">Use <span className="font-bold text-white">💣 Sabotage</span> to slow down guessing teams</p>
              </>
            ) : (
              <>
                <div className="text-5xl">⏳</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Get ready to guess</p>
                <p className="text-white font-black text-2xl leading-tight">Drawing begins soon</p>
                <p className="text-white/40 text-sm">
                  <span className="font-bold text-white/70">{drawer?.name}</span>
                  <span> · </span>
                  <span className="font-bold" style={{ color: drawingTeam?.color }}>{drawingTeam?.name}</span>
                  <span> is studying their word</span>
                </p>
                <p className="text-white/20 text-xs">Anyone on your team can guess</p>
              </>
            )}

            {/* Countdown ring */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl"
                style={{ background: `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.15)`, border: `2px solid rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.4)`, color: myTeam?.color || '#00B14F' }}>
                {prepCountdown}
              </div>
              <span className="text-white/30 text-xs">seconds until guessing opens</span>
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
                <p className="text-white/20 text-xs">Sketch it out — no writing or speaking the answer!</p>
              </>
            ) : !isOnDrawingTeam ? (
              <>
                <div className="text-5xl mb-2">🔍</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Guess together!</p>
                <p className="text-white font-black text-2xl leading-tight">What's being drawn?</p>
                <div className="px-4 py-3 rounded-xl mt-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-white/60 text-sm">
                    <span className="font-bold text-white">{drawer?.name}</span>
                    <span className="text-white/40"> · </span>
                    <span className="font-bold" style={{ color: drawingTeam?.color }}>{drawingTeam?.name}</span>
                    <span className="text-white/60"> is drawing</span>
                  </p>
                  <p className="text-white/30 text-xs mt-1">Everyone on your team can guess — tap letters or type the full word</p>
                </div>
                <p className="text-white/20 text-xs">First team to guess wins the most points</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">👀</div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">You're on the drawing team</p>
                <p className="text-white font-black text-2xl leading-tight">{players[drawerId]?.name} is drawing</p>
                <div className="px-4 py-3 rounded-xl mt-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-white/50 text-sm">Use <span className="font-bold text-white">💣 Sabotage</span> to slow down guessing teams</p>
                </div>
                <p className="text-white/20 text-xs">Spend your team points strategically</p>
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
