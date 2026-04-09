import React from 'react'

const BASE_PTS = 100
const PENALTY   = 50   // deducted per wrong guess
const MAX_WRONG = 3
const MAX_PTS   = BASE_PTS + MAX_WRONG * PENALTY  // 250

export default function LetterBoard({ word = '', guessedLetters = {}, wrongLetters = {}, wrongCount: wrongCountProp, revealed = false, typingPreview = '' }) {
  const wrongCount  = wrongCountProp !== undefined ? wrongCountProp : Object.keys(wrongLetters).length
  const currentPts  = MAX_PTS - wrongCount * PENALTY   // 250 → 200 → 150 → 100
  const pct         = (currentPts / MAX_PTS) * 100

  const chars   = word.toUpperCase().split('')
  const isSmall = word.length > 9

  // Map typed characters onto blank (non-revealed, non-space) slots in order
  const typedChars = typingPreview.toUpperCase().replace(/ /g, '').split('')
  let typedIdx = 0
  const previewMap = {} // position index → typed char
  chars.forEach((char, i) => {
    if (char === ' ') return
    if (revealed || guessedLetters[char]) return // already revealed, skip
    if (typedIdx < typedChars.length) {
      previewMap[i] = typedChars[typedIdx++]
    }
  })

  return (
    <div className="w-full">
      {/* Points meter */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: wrongCount === 0
                ? '#00B14F'
                : wrongCount === 1
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          />
        </div>
        <span
          className="text-sm font-black tabular-nums min-w-[52px] text-right transition-all"
          style={{
            color: wrongCount === 0 ? '#00B14F' : wrongCount === 1 ? '#f59e0b' : '#ef4444',
          }}
        >
          {currentPts} pts
        </span>
      </div>

      {/* Word blanks */}
      <div className="flex items-end justify-center gap-1.5 flex-wrap mb-3">
        {chars.map((char, i) => {
          if (char === ' ') {
            return <div key={i} className="w-4" />
          }
          const isRevealed = revealed || !!guessedLetters[char]
          const preview = !isRevealed ? previewMap[i] : null
          return (
            <div key={i} className="flex flex-col items-center">
              <span
                className={`font-black transition-all duration-300 ${
                  isSmall ? 'text-lg w-6' : 'text-2xl w-8'
                } text-center ${
                  isRevealed
                    ? revealed && !guessedLetters[char]
                      ? 'text-amber-400 animate-bounce-in'
                      : 'text-white animate-pop'
                    : preview
                      ? 'text-white/60'
                      : 'text-transparent'
                }`}
              >
                {isRevealed ? char : preview ?? '_'}
              </span>
              <div className={`h-0.5 mt-1 rounded-full ${isSmall ? 'w-6' : 'w-8'}`}
                style={{ background: isRevealed ? '#00B14F' : preview ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)' }} />
            </div>
          )
        })}
      </div>

      {/* Wrong letters */}
      {wrongCount > 0 && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className="text-white/30 text-xs">Wrong:</span>
          {Object.keys(wrongLetters).map((letter) => (
            <span
              key={letter}
              className="text-red-400 font-bold text-sm line-through opacity-70"
            >
              {letter}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
