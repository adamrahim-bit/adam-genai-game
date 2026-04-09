import React, { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, push, onValue } from 'firebase/database'

export default function Chat({ roomCode, playerId, playerName, myTeamId, myTeam, teams }) {
  const [tab, setTab] = useState('team')
  const [text, setText] = useState('')
  const [teamMsgs, setTeamMsgs] = useState([])
  const [globalMsgs, setGlobalMsgs] = useState([])
  const [globalUnread, setGlobalUnread] = useState(0)
  const [teamUnread, setTeamUnread] = useState(0)
  const bottomRef = useRef(null)
  const tabRef = useRef(tab)
  tabRef.current = tab

  useEffect(() => {
    if (!myTeamId) return
    const unsub = onValue(ref(db, `rooms/${roomCode}/chat/${myTeamId}`), (snap) => {
      const data = snap.val()
      const msgs = data ? Object.values(data).sort((a, b) => a.ts - b.ts) : []
      setTeamMsgs(msgs)
      if (tabRef.current !== 'team' && msgs.length > 0) {
        setTeamUnread((n) => n + 1)
      }
    })
    return () => unsub()
  }, [roomCode, myTeamId])

  useEffect(() => {
    const unsub = onValue(ref(db, `rooms/${roomCode}/chat/global`), (snap) => {
      const data = snap.val()
      const msgs = data ? Object.values(data).sort((a, b) => a.ts - b.ts) : []
      setGlobalMsgs(msgs)
      if (tabRef.current !== 'global' && msgs.length > 0) {
        setGlobalUnread((n) => n + 1)
      }
    })
    return () => unsub()
  }, [roomCode])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [teamMsgs, globalMsgs, tab])

  const switchTab = (t) => {
    setTab(t)
    if (t === 'team') setTeamUnread(0)
    if (t === 'global') setGlobalUnread(0)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const path = tab === 'team'
      ? `rooms/${roomCode}/chat/${myTeamId}`
      : `rooms/${roomCode}/chat/global`
    await push(ref(db, path), {
      uid: playerId,
      name: playerName,
      teamId: myTeamId,
      text: text.trim(),
      ts: Date.now(),
    })
    setText('')
  }

  const msgs = tab === 'team' ? teamMsgs : globalMsgs

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[
          { id: 'team', label: 'Team', unread: teamUnread },
          { id: 'global', label: 'All', unread: globalUnread },
        ].map(({ id, label, unread }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className="flex-1 py-2 text-xs font-semibold relative transition-colors"
            style={tab === id
              ? { color: myTeam?.color || '#00B14F', borderBottom: `2px solid ${myTeam?.color || '#00B14F'}` }
              : { color: 'rgba(255,255,255,0.3)' }
            }
          >
            {label}
            {unread > 0 && (
              <span
                className="absolute top-1 right-3 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: myTeam?.color || '#00B14F', color: 'black' }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {msgs.length === 0 && (
          <p className="text-center text-white/20 text-xs mt-4">
            {tab === 'team' ? 'Chat with your team here' : 'Chat with everyone here'}
          </p>
        )}
        {msgs.map((msg, i) => {
          const isMe = msg.uid === playerId
          const senderTeam = teams?.[msg.teamId]
          const teamColor = senderTeam?.color || 'rgba(255,255,255,0.4)'
          return (
            <div key={i} className={`flex gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white mt-0.5"
                style={{ background: teamColor }}
              >
                {msg.name?.[0]?.toUpperCase()}
              </div>
              <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-[10px] mb-0.5 font-medium" style={{ color: teamColor }}>
                    {msg.name}
                    {tab === 'global' && senderTeam && (
                      <span className="text-white/20 font-normal"> · {senderTeam.name}</span>
                    )}
                  </span>
                )}
                <div
                  className="px-2.5 py-1.5 rounded-2xl text-xs text-white leading-snug"
                  style={{
                    background: isMe
                      ? `rgba(${hexToRgb(myTeam?.color || '#00B14F')}, 0.25)`
                      : 'rgba(255,255,255,0.08)',
                    borderBottomRightRadius: isMe ? 4 : undefined,
                    borderBottomLeftRadius: !isMe ? 4 : undefined,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="flex gap-2 p-2 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tab === 'team' ? 'Message your team...' : 'Message everyone...'}
          maxLength={120}
          className="flex-1 rounded-xl px-3 py-1.5 text-white text-xs outline-none transition-colors"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            caretColor: 'white',
            WebkitTextFillColor: 'white',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
          style={{ background: myTeam?.color || '#00B14F', color: 'black' }}
        >
          Send
        </button>
      </form>
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
