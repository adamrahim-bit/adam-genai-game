import React from 'react'
import PlayerAvatar from './PlayerAvatar'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ players = {}, highlightId }) {
  const sorted = Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <div className="space-y-2">
      {sorted.map((player, i) => (
        <div
          key={player.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            player.id === highlightId
              ? 'bg-grab/20 border border-grab/40'
              : 'bg-white/5 border border-white/5'
          }`}
        >
          <span className="w-6 text-center text-lg">
            {i < 3 ? MEDALS[i] : <span className="text-white/30 text-sm font-bold">{i + 1}</span>}
          </span>
          <PlayerAvatar name={player.name} color={player.color} size="sm" />
          <span className="flex-1 font-semibold text-white truncate">{player.name}</span>
          <span className="font-black text-grab tabular-nums">{player.score || 0}</span>
        </div>
      ))}
    </div>
  )
}
