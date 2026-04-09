export const PLAYER_COLORS = [
  '#00B14F', // Grab Green
  '#2563eb', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
]

// Image assets for teams that have custom icons
export const TEAM_IMAGES = {
  'Durian':    '/team-durian.png',
  'Pandan':    '/team-pandan.png',
  'Laksa':     '/team-laksa.png',
  'Teh Tarik': '/team-teh-tarik.png',
}

// Returns the image path for a team name (with or without "Team " prefix), or null
export const getTeamImage = (teamName) =>
  TEAM_IMAGES[teamName?.replace('Team ', '')] || null

export const TEAM_NAMES = [
  'Durian', 'Pandan', 'Laksa', 'Teh Tarik',
  'Cendol', 'Satay', 'Rendang', 'Roti Canai',
  'Sambal', 'Nasi Lemak',
]
export const TEAM_COLORS = [
  '#00B14F', '#2563eb', '#f59e0b', '#ec4899',
  '#06b6d4', '#f97316', '#8b5cf6', '#10b981',
  '#ef4444', '#a16207',
]

export const generateRoomCode = () =>
  Math.random().toString(36).substr(2, 6).toUpperCase()

export const getPlayerId = () => {
  let id = sessionStorage.getItem('kyc_player_id')
  if (!id) {
    id = Math.random().toString(36).substr(2, 12)
    sessionStorage.setItem('kyc_player_id', id)
  }
  return id
}

export const shuffleArray = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const getInitials = (name = '') =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

// Randomly split playerIds into teams of ~2, scaling team count with players
export const assignTeams = (playerIds) => {
  const shuffled = shuffleArray([...playerIds])
  const total = shuffled.length
  // Aim for ~3 per team — keeps teams small enough to discuss, large enough to matter
  const numTeams = Math.min(TEAM_NAMES.length, Math.max(2, Math.round(total / 3)))
  const teams = {}
  const baseSize = Math.floor(total / numTeams)
  const extras = total % numTeams
  let idx = 0
  for (let t = 0; t < numTeams; t++) {
    const size = baseSize + (t < extras ? 1 : 0)
    const members = shuffled.slice(idx, idx + size)
    idx += size
    teams[`team_${t}`] = {
      name: `Team ${TEAM_NAMES[t]}`,
      color: TEAM_COLORS[t],
      memberIds: members,
      score: 0,
    }
  }
  return teams
}

// Return the teamId for a given player
export const getTeamForPlayer = (teams = {}, playerId) =>
  Object.keys(teams).find((tid) => (teams[tid].memberIds || []).includes(playerId)) || null
