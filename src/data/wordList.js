export const WORD_LIST = [
  { word: 'GROUP ORDER',     category: 'Grab', hint: '👥 Best feature to use with your colleagues' },
  { word: 'ROBOT DELIVERY',  category: 'Grab', hint: '🤖 Your food arrives on wheels, no human needed' },
  { word: 'GRAB COIN',       category: 'Grab', hint: '🪙 Earn these with every ride or order' },
  { word: 'BASKET',          category: 'Grab', hint: '🧺 Fill it up before you checkout' },
  { word: 'RESERVE',         category: 'Grab', hint: '📅 Claim your table before someone else does' },
  { word: '5 STAR EATS',     category: 'Grab', hint: '⭐ Grab\'s handpicked top-rated restaurants' },
  { word: 'STORE BADGE',     category: 'Grab', hint: '🏅 A verified merchant earns this mark' },
  { word: 'GRAB UNLIMITED',  category: 'Grab', hint: '♾️ Save more on your orders' },
  { word: 'DINE OUT',        category: 'Grab', hint: '🍽️ Enjoy discounts when eating at a restaurant' },
  { word: 'QUALITY BADGE',   category: 'Grab', hint: '✅ A stamp of excellence for food merchants' },
  { word: 'MYSTERY REWARDS', category: 'Grab', hint: '🎁 You won\'t know what\'s inside until you tap it' },
  { word: 'DRONE DELIVERY',  category: 'Grab', hint: '🚁 Parcel magically appears to you' },
  { word: 'CHOPE',           category: 'Grab', hint: '🪑 Reserve a spot at a restaurant' },
  { word: 'JAYA GROCER',     category: 'Grab', hint: '🛒 Our partner in MY' },
  { word: 'LOKALIFE',        category: 'Grab', hint: '🏙️ Discover local experiences and things to do nearby' },
  { word: 'GRABEXPRESS',     category: 'Grab', hint: '📦 Same day delivery' },
  { word: 'VOUCHER',         category: 'Grab', hint: '🎫 Redeemable discount you apply at checkout' },
  { word: 'HELMET',          category: 'Grab', hint: '🪖 Safety gear for our DAX' },
  { word: 'GRABFOOD',        category: 'Grab', hint: '🍔 Order from hundreds of restaurants to your door' },
  { word: 'GRABBIKE',        category: 'Grab', hint: '🏍️ Most used delivery vehicle' },
  { word: 'GRABCAR',         category: 'Grab', hint: '🚗 Brings you from anywhere to anywhere' },
]

export const getRandomWordIndex = (usedIndices = []) => {
  const available = WORD_LIST.map((_, i) => i).filter((i) => !usedIndices.includes(i))
  if (available.length === 0) return Math.floor(Math.random() * WORD_LIST.length)
  return available[Math.floor(Math.random() * available.length)]
}
