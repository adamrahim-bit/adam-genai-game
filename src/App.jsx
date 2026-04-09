import React, { useState, useEffect } from 'react'
import { db } from './firebase'
import { ref, onValue, remove, update, get } from 'firebase/database'
import { getPlayerId, getTeamForPlayer } from './utils'
import Home from './screens/Home'
import Lobby from './screens/Lobby'
import TeamAssign from './screens/TeamAssign'
import Drawing from './screens/Drawing'
import RoundReveal from './screens/RoundReveal'
import Podium from './screens/Podium'
import RaceDemo from './screens/RaceDemo'

function ExitMenu({ isHost, onExit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'exit' | 'delete'

  const handleConfirm = async () => {
    if (confirm === 'exit') await onExit()
    else if (confirm === 'delete') await onDelete()
    setConfirm(null)
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed top-4 left-4 z-40 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
      >
        <span className="text-white/50 text-lg leading-none">≡</span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed top-14 left-4 z-50 rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
            style={{ background: 'rgba(10,20,14,0.97)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 200, backdropFilter: 'blur(16px)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Room options</p>
            </div>
            <div className="p-2 space-y-1">
              <button
                onClick={() => { setConfirm('exit'); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5 active:scale-95"
              >
                <span className="text-base">🚪</span>
                <div>
                  <p className="text-white/80 text-sm font-semibold">Leave room</p>
                  <p className="text-white/30 text-xs">
                    {isHost ? 'Host transfers to next player' : 'You exit the game'}
                  </p>
                </div>
              </button>
              {isHost && (
                <button
                  onClick={() => { setConfirm('delete'); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-red-500/10 active:scale-95"
                >
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
                    : 'You will exit the current game.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all active:scale-95"
                style={confirm === 'delete'
                  ? { background: 'rgba(239,68,68,0.9)', color: 'white' }
                  : { background: 'rgba(0,177,79,0.9)', color: 'white' }}>
                {confirm === 'delete' ? 'Delete' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BackgroundLayer() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  )
}

export default function App() {
  const [playerId] = useState(getPlayerId)
  const [playerName, setPlayerName] = useState(
    () => sessionStorage.getItem('kyc_name') || ''
  )
  const [roomCode, setRoomCode] = useState(
    () => sessionStorage.getItem('kyc_room') || ''
  )
  const [inGame, setInGame] = useState(
    () => !!sessionStorage.getItem('kyc_room')
  )
  const [gameState, setGameState] = useState(null)
  const [firebaseError, setFirebaseError] = useState(false)

  useEffect(() => {
    if (!roomCode || !inGame) return
    const gameRef = ref(db, `rooms/${roomCode}`)
    const unsub = onValue(
      gameRef,
      (snapshot) => {
        const data = snapshot.val()
        if (!data) {
          // Room deleted or never existed — kick everyone back to home
          sessionStorage.removeItem('kyc_room')
          setInGame(false)
          setRoomCode('')
          setGameState(null)
          return
        }
        setGameState(data)
      },
      (err) => {
        console.error('Firebase error:', err)
        setFirebaseError(true)
      }
    )
    return () => unsub()
  }, [roomCode, inGame])

  const enterRoom = (code, name) => {
    sessionStorage.setItem('kyc_room', code)
    sessionStorage.setItem('kyc_name', name)
    setRoomCode(code)
    setPlayerName(name)
    setInGame(true)
  }

  const leaveRoom = () => {
    sessionStorage.removeItem('kyc_room')
    setInGame(false)
    setRoomCode('')
    setGameState(null)
  }

  // Member: remove self from players list then leave
  const exitRoom = async () => {
    if (!roomCode || !playerId) return
    await remove(ref(db, `rooms/${roomCode}/players/${playerId}`))
    leaveRoom()
  }

  // Host: transfer host to next player then leave self
  const exitRoomAsHost = async () => {
    if (!roomCode || !playerId) return
    const snap = await get(ref(db, `rooms/${roomCode}/players`))
    const players = snap.val() || {}
    const others = Object.keys(players).filter(id => id !== playerId)
    if (others.length > 0) {
      // Transfer host, remove self
      await update(ref(db, `rooms/${roomCode}`), { hostId: others[0] })
    }
    await remove(ref(db, `rooms/${roomCode}/players/${playerId}`))
    leaveRoom()
  }

  // Host only: wipe the entire room
  const deleteRoom = async () => {
    if (!roomCode) return
    await remove(ref(db, `rooms/${roomCode}`))
    leaveRoom()
  }

  if (firebaseError) {
    return (
      <div className="game-bg flex items-center justify-center min-h-screen p-4">
        <BackgroundLayer />
        <div className="card max-w-md w-full text-center" style={{ zIndex: 1, position: 'relative' }}>
          <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-xl font-black">!</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Firebase not configured</h2>
          <p className="text-white/50 text-sm mb-3">
            Copy <code className="text-grab font-mono">.env.example</code> to{' '}
            <code className="text-grab font-mono">.env</code> and fill in your Firebase credentials.
          </p>
          <p className="text-white/30 text-xs">See SETUP.md for step-by-step instructions.</p>
        </div>
      </div>
    )
  }

  if (window.location.search.includes('demo=race')) {
    return <div className="game-bg"><BackgroundLayer /><RaceDemo /></div>
  }

  const isHost = gameState?.hostId === playerId
  const phase = inGame ? (gameState?.phase || 'lobby') : 'home'
  const myTeamId = getTeamForPlayer(gameState?.teams, playerId)
  const myTeam = myTeamId ? gameState?.teams?.[myTeamId] : null

  const commonProps = {
    playerId, playerName, roomCode, gameState, isHost,
    enterRoom, leaveRoom, exitRoom, exitRoomAsHost, deleteRoom, myTeamId, myTeam,
  }

  const screens = {
    home: Home,
    lobby: Lobby,
    teamassign: TeamAssign,
    drawing: Drawing,
    roundreveal: RoundReveal,
    podium: Podium,
  }

  const Screen = screens[phase] || Home
  const inGamePhase = inGame && phase !== 'home' && phase !== 'lobby' && phase !== 'drawing'

  return (
    <div className="game-bg">
      <BackgroundLayer />
      <div className="mx-auto w-full" style={{ maxWidth: '1200px', height: '100%' }}>
        <Screen {...commonProps} />
      </div>

      {/* Floating exit button for in-game phases */}
      {inGamePhase && (
        <ExitMenu
          isHost={isHost}
          onExit={isHost ? exitRoomAsHost : exitRoom}
          onDelete={deleteRoom}
        />
      )}
    </div>

  )
}
