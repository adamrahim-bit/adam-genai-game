import React, { useState } from 'react'
import RaceTrack from '../components/RaceTrack'

const INITIAL_TEAMS = {
  team_0: { name: 'Team Durian',    color: '#00B14F', score: 0, memberIds: ['a'] },
  team_1: { name: 'Team Pandan',    color: '#2563eb', score: 0, memberIds: ['b'] },
  team_2: { name: 'Team Laksa',     color: '#f59e0b', score: 0, memberIds: ['c'] },
  team_3: { name: 'Team Teh Tarik', color: '#ec4899', score: 0, memberIds: ['d'] },
}

const ROUNDS = [
  [
    { tid: 'team_0', succeeded: true,  pts: 250, heartsLeft: 3 },
    { tid: 'team_1', succeeded: true,  pts: 150, heartsLeft: 1 },
    { tid: 'team_2', succeeded: false, pts: 0,   heartsLeft: 0 },
    { tid: 'team_3', succeeded: true,  pts: 200, heartsLeft: 2 },
  ],
  [
    { tid: 'team_0', succeeded: true,  pts: 150, heartsLeft: 1 },
    { tid: 'team_1', succeeded: true,  pts: 250, heartsLeft: 3 },
    { tid: 'team_2', succeeded: true,  pts: 200, heartsLeft: 2 },
    { tid: 'team_3', succeeded: false, pts: 0,   heartsLeft: 0 },
  ],
  [
    { tid: 'team_0', succeeded: false, pts: 0,   heartsLeft: 0 },
    { tid: 'team_1', succeeded: true,  pts: 200, heartsLeft: 2 },
    { tid: 'team_2', succeeded: true,  pts: 250, heartsLeft: 3 },
    { tid: 'team_3', succeeded: true,  pts: 150, heartsLeft: 1 },
  ],
  [
    { tid: 'team_0', succeeded: true,  pts: 200, heartsLeft: 2 },
    { tid: 'team_1', succeeded: false, pts: 0,   heartsLeft: 0 },
    { tid: 'team_2', succeeded: true,  pts: 150, heartsLeft: 1 },
    { tid: 'team_3', succeeded: true,  pts: 250, heartsLeft: 3 },
  ],
]

export default function RaceDemo() {
  const [teams, setTeams] = useState(INITIAL_TEAMS)
  const [roundIdx, setRoundIdx] = useState(0)
  const [lastResults, setLastResults] = useState([])

  const applyRound = () => {
    const results = ROUNDS[roundIdx % ROUNDS.length]
    setLastResults(results)

    // Update scores — RaceTrack's useEffect detects the change and triggers animation
    setTeams((prev) => {
      const next = { ...prev }
      results.forEach(({ tid, pts }) => {
        next[tid] = { ...next[tid], score: (next[tid].score || 0) + pts }
      })
      return next
    })

    setRoundIdx((r) => r + 1)
  }

  const reset = () => {
    setTeams(INITIAL_TEAMS)
    setLastResults([])
    setRoundIdx(0)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-lg space-y-5 animate-slide-up">

        <div className="text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-1">Demo</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Race Track Animation</h1>
          <p className="text-white/40 text-sm mt-1">
            {roundIdx === 0 ? 'Press Next Round to start the race' : `Round ${roundIdx} complete`}
          </p>
        </div>

        {/* Last round results */}
        {lastResults.length > 0 && (
          <div className="card">
            <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3">
              Round {roundIdx} Results
            </p>
            <div className="space-y-1.5">
              {lastResults.map(({ tid, succeeded, pts, heartsLeft }) => {
                const team = teams[tid]
                return (
                  <div key={tid} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                    <span className="flex-1 text-white/70 text-sm font-medium">{team.name}</span>
                    {succeeded ? (
                      <>
                        <span className="text-sm">{'❤️'.repeat(heartsLeft)}{'🖤'.repeat(3 - heartsLeft)}</span>
                        <span className="font-black text-sm ml-2" style={{ color: team.color }}>+{pts}</span>
                      </>
                    ) : (
                      <span className="text-white/25 text-sm font-bold">+0</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* RaceTrack — no key= so it stays mounted and displayScores persists */}
        <RaceTrack teams={teams} teamResults={lastResults} totalRounds={4} />

        {/* Controls */}
        <div className="flex gap-3">
          <button className="btn-primary flex-1 text-sm" onClick={applyRound}>
            Next Round →
          </button>
          <button onClick={reset}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
