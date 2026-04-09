import React from 'react'
import { getInitials } from '../utils'

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
}

export default function PlayerAvatar({ name = '?', color = '#7c3aed', size = 'md', className = '' }) {
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{
        backgroundColor: color,
        boxShadow: `0 0 24px ${color}55`,
      }}
    >
      {getInitials(name)}
    </div>
  )
}
