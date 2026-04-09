export const WORD_LIST = [
  // Grab Products & Services
  { word: 'GRABFOOD', category: 'Grab', hint: '🍔 Order food to your door' },
  { word: 'GRABBIKE', category: 'Grab', hint: '🏍️ Two wheels, faster rides' },
  { word: 'GRABCAR', category: 'Grab', hint: '🚗 Private car ride' },
  { word: 'GRABPAY', category: 'Grab', hint: '💳 Digital wallet & payments' },
  { word: 'GRABEXPRESS', category: 'Grab', hint: '📦 Same-day parcel delivery' },
  { word: 'SUPERAPP', category: 'Grab', hint: '🦸 One app for everything' },

  // Grab Concepts
  { word: 'SURGE', category: 'Grab', hint: '📈 Price hike during peak hours' },
  { word: 'PROMO', category: 'Grab', hint: '🎁 Discount code magic' },
  { word: 'BOOKING', category: 'Grab', hint: '📋 Requesting a driver or food' },
  { word: 'CASHBACK', category: 'Grab', hint: '💸 Money that comes back to you' },
  { word: 'HELMET', category: 'Grab', hint: '🪖 Safety gear for bike riders' },
  { word: 'RATING', category: 'Grab', hint: '⭐ How was your ride or meal?' },
  { word: 'RECEIPT', category: 'Grab', hint: '🧾 Proof of your payment' },
  { word: 'DRIVER', category: 'Grab', hint: '🧑‍✈️ The person who picks you up' },
  { word: 'PICKUP', category: 'Grab', hint: '📍 Where your ride starts' },
  { word: 'NAVIGATION', category: 'Grab', hint: '🗺️ GPS-guided route to destination' },
  { word: 'WALLET', category: 'Grab', hint: '👛 Where your Grab credits live' },
  { word: 'VOUCHER', category: 'Grab', hint: '🎫 Redeemable discount ticket' },
  { word: 'MERCHANT', category: 'Grab', hint: '🏪 Restaurant or shop on the app' },
  { word: 'CHECKPOINT', category: 'Grab', hint: '📌 Safety stop along the route' },

  // Design & UX Terms
  { word: 'WIREFRAME', category: 'Design', hint: '🖊️ Basic blueprint of a screen' },
  { word: 'PROTOTYPE', category: 'Design', hint: '🔧 Clickable interactive mockup' },
  { word: 'FIGMA', category: 'Design', hint: '🎨 The designer\'s favourite tool' },
  { word: 'DARKMODE', category: 'Design', hint: '🌙 Night-friendly UI theme' },
  { word: 'LOADING', category: 'Design', hint: '⏳ The spinning circle of patience' },
  { word: 'ONBOARDING', category: 'Design', hint: '👋 First-time user experience flow' },
  { word: 'CHECKOUT', category: 'Design', hint: '💰 Final step before paying' },
  { word: 'BUTTON', category: 'Design', hint: '🟢 The thing users tap to act' },
  { word: 'BANNER', category: 'Design', hint: '📣 Promotional strip across the screen' },
  { word: 'ICON', category: 'Design', hint: '📱 A tiny visual symbol' },
  { word: 'ANIMATION', category: 'Design', hint: '✨ Motion that brings UI to life' },
  { word: 'GESTURE', category: 'Design', hint: '👆 Swipe, pinch, tap — user actions' },
  { word: 'FEEDBACK', category: 'Design', hint: '💬 User response to your design' },
  { word: 'HEATMAP', category: 'Design', hint: '🌡️ Where users tap most on screen' },
  { word: 'SPRINT', category: 'Design', hint: '🏃 Fast-paced work cycle' },
  { word: 'PERSONA', category: 'Design', hint: '🧑 Fictional user profile for research' },
  { word: 'FLOWCHART', category: 'Design', hint: '🔀 Diagram of user steps & decisions' },
  { word: 'TYPOGRAPHY', category: 'Design', hint: '🔤 The art of arranging text' },
  { word: 'CONTRAST', category: 'Design', hint: '⬛⬜ Dark vs light for readability' },
  { word: 'COMPONENT', category: 'Design', hint: '🧩 Reusable UI building block' },
]

export const getRandomWordIndex = (usedIndices = []) => {
  const available = WORD_LIST.map((_, i) => i).filter((i) => !usedIndices.includes(i))
  if (available.length === 0) return Math.floor(Math.random() * WORD_LIST.length)
  return available[Math.floor(Math.random() * available.length)]
}
