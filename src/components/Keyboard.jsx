import React from 'react'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

export default function Keyboard({ guessedLetters = {}, wrongLetters = {}, onGuess, disabled = false }) {
  return (
    <div className="w-full space-y-1">
      {ROWS.map((row) => (
        <div key={row} className="flex justify-center gap-0.5 lg:gap-1">
          {row.split('').map((letter) => {
            const isCorrect = !!guessedLetters[letter]
            const isWrong = !!wrongLetters[letter]
            const isUsed = isCorrect || isWrong

            return (
              <button
                key={letter}
                onClick={() => onGuess(letter)}
                disabled={disabled || isUsed}
                className={`
                  w-7 h-8 lg:w-9 lg:h-10 rounded-md lg:rounded-lg font-bold text-xs lg:text-sm transition-all duration-150
                  ${isCorrect
                    ? 'bg-emerald-500 text-white cursor-not-allowed'
                    : isWrong
                    ? 'bg-red-500/40 text-red-300 cursor-not-allowed line-through'
                    : disabled
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-white/15 text-white hover:bg-white/30 active:scale-90'
                  }
                `}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
