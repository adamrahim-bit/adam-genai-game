# Know Your Crew — Firebase Setup Guide

This game uses **Firebase Realtime Database** for real-time multiplayer.
Setup takes about 5 minutes and it's free.

---

## Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a name (e.g. `know-your-crew`) → Continue
4. Disable Google Analytics (not needed) → **Create project**

---

## Step 2 — Create a Realtime Database

1. In your project, click **"Build" → "Realtime Database"** in the left sidebar
2. Click **"Create Database"**
3. Choose your region (closest to you) → Next
4. Select **"Start in test mode"** (allows all reads/writes) → **Enable**

---

## Step 3 — Register a Web App

1. Go to **Project Overview** (home icon)
2. Click the **"</>"** (web) button to add a web app
3. Enter a nickname (e.g. `kyc-web`) → **Register app**
4. Copy the `firebaseConfig` object — you'll need these values

The config looks like:
```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

---

## Step 4 — Create Your .env File

1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```

2. Fill in the values from your Firebase config:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

---

## Step 5 — Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser — you're ready to play!

---

## Deploying for Your Colleagues

To share with your team, deploy to JustVibe or run:
```bash
npm run build
```
and host the `dist/` folder on any static hosting service.

---

## Game Rules (Share with Your Crew)

1. **Host** creates a room and shares the 6-letter code
2. **Everyone** joins using that code and enters their name
3. **Host** clicks "Start Game"
4. **Everyone** submits 1-2 fun facts about themselves (be creative! 🎨)
5. **Host** starts the questions
6. Each question shows a fact — guess which colleague said it!
7. **Faster correct answers** = more fun (points are equal, speed is bragging rights)
8. **Winner** gets eternal glory 🏆

---

## Tips for a Great Game

- Encourage weird/surprising facts — "I once met a celebrity" beats "I like coffee"
- Play over a video call so you can react out loud when the answer is revealed
- Use the **Play Again** button for a second round with fresh facts!
