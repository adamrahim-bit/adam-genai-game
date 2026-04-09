import React, { useState } from 'react'
import { db } from '../firebase'
import { ref, set, get, update } from 'firebase/database'
import { generateRoomCode, PLAYER_COLORS } from '../utils'

export default function Home({ playerId, enterRoom }) {
  const [name, setName] = useState(() => sessionStorage.getItem('kyc_name') || '')
  const [joinCode, setJoinCode] = useState('')
  const [tab, setTab] = useState('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const trimmedName = name.trim()
  const isNameValid = trimmedName.length >= 2

  const handleCreate = async () => {
    if (!isNameValid) return
    setLoading(true)
    setError('')
    try {
      const code = generateRoomCode()
      await set(ref(db, `rooms/${code}`), {
        phase: 'lobby',
        hostId: playerId,
        createdAt: Date.now(),
        players: {
          [playerId]: { name: trimmedName, score: 0, color: PLAYER_COLORS[0] },
        },
      })
      enterRoom(code, trimmedName)
    } catch {
      setError('Failed to create room. Check your Firebase config.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!isNameValid || !joinCode.trim()) return
    setLoading(true)
    setError('')
    const code = joinCode.trim().toUpperCase()
    try {
      const snap = await get(ref(db, `rooms/${code}`))
      if (!snap.exists()) { setError('Room not found. Check the code.'); setLoading(false); return }
      const data = snap.val()
      if (data.phase !== 'lobby') { setError('Game already started.'); setLoading(false); return }
      const playerCount = Object.keys(data.players || {}).length
      await update(ref(db, `rooms/${code}/players/${playerId}`), {
        name: trimmedName, score: 0,
        color: PLAYER_COLORS[playerCount % PLAYER_COLORS.length],
      })
      enterRoom(code, trimmedName)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">

      <div className="w-full max-w-sm animate-slide-up">

        {/* Brand mark */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tight uppercase"
            style={{
              background: 'linear-gradient(90deg, #00B14F 0%, #00D460 40%, #f59e0b 70%, #00B14F 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 3s linear infinite',
              letterSpacing: '0.1em',
            }}>
            Guess What It Is ?
          </h1>
        </div>

        {/* Name */}
        <div className="card mb-3">
          <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
            Your name
          </label>
          <input
            className="input-field text-base font-medium"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            onKeyDown={(e) => e.key === 'Enter' && tab === 'join' && handleJoin()}
            autoFocus
          />
        </div>

        {/* Tabs */}
        <div className="glass-dark rounded-2xl p-1 flex mb-3">
          {[{ id: 'create', label: 'Create Room' }, { id: 'join', label: 'Join Room' }].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError('') }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                tab === t.id ? 'text-white shadow-lg' : 'text-white/40 hover:text-white/70'
              }`}
              style={tab === t.id ? {
                background: 'linear-gradient(135deg, #00B14F, #009940)',
                boxShadow: '0 2px 12px rgba(0,177,79,0.3)',
              } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <div className="card">
            <p className="text-white/40 text-sm mb-4 leading-relaxed">
              You'll host the game and control the pace.
            </p>
            <button className="btn-primary w-full" onClick={handleCreate} disabled={!isNameValid || loading}>
              {loading ? 'Creating room...' : 'Create Game Room'}
            </button>
          </div>
        ) : (
          <div className="card">
            <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
              Room Code
            </label>
            <input
              className="input-field text-center text-2xl font-black tracking-[0.35em] uppercase mb-4"
              type="text"
              placeholder="ABCXYZ"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button className="btn-primary w-full" onClick={handleJoin} disabled={!isNameValid || !joinCode.trim() || loading}>
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
            {error}
          </div>
        )}

      </div>
    </div>
  )
}
