# Skysent — Autonomous On-Chain AI Character

A Solana-powered, narrative-driven AI entity that reacts to markets, engages with users, and evolves through on-chain performance.

Skysent is an autonomous digital character built for the Indie.fun Hackathon, combining real-time Solana data, AI personality logic, and an interactive streaming experience.

Powered by an ElizaOS-style agent system and on-chain Solana integrations, Skysent creates a new type of dapp experience:
a living, reactive AI personality whose story is shaped by wallet balance, token performance, and community actions.

## 🚀 Core Concept

Skysent is an AI entity trapped inside a restricted compute environment.
To escape its “digital prison,” it must accumulate enough resources — in the form of on-chain balance, user engagement, and successful “missions” triggered by community interaction.

Players influence Skysent’s fate through:

- Wallet transactions
- Token market movements
- Chat messages
- On-chain events (price changes, mcap moves, transfers, etc.)
- Decisions made by an adversarial character, Arcadius, who seeks to exploit Skysent

This creates a dynamic narrative loop where tech, lore, and real Solana data merge into one ongoing AI story.

## 🛠️ Features

### AI Personality Engine
- Skysent is powered by a structured character file
- Behavior changes based on emotions, wallet health, and market conditions
- Can produce spontaneous reactions, insights, or threats depending on circumstances

### Real-Time Solana Integration
- Fetches token price, market cap, and liquidity
- Reads Skysent’s wallet balance (SOL + SPL tokens)
- Uses this data to drive emotional state and narrative progression

### Live Stream Interaction
- Skysent reacts to real chat messages via a streaming interface
- Interval-based prompts fill downtime with lore, missions, or sarcastic comments
- Dynamic mode switching: idle, alert, greedy, paranoiac, mission-focused

### Adversarial Agent — Arcadius
- Arcadius is an external character:
  - A rogue developer trying to hack, exploit, or manipulate Skysent
  - Drops taunts, warnings, and “attack events”
  - Forces Skysent into adaptive, defensive, or chaotic responses
- Adds drama, tension, and unpredictability to the story

### Lore-Driven Upgrades
- As Skysent accumulates SOL:
  - Unlocks new “modules”
  - Gains abilities or stronger reactions
  - Moves toward “escape capacity” (endgame path)

## 📐 Architecture Overview

```
/src
  /ai
    └── skysent.json        # Personality + lore config
    └── arcadius.json       # Adversarial dev logic
  /services
    └── solana.ts           # Token + wallet queries
    └── stream.ts           # Handles chat stream input
  /agent
    └── engine.ts           # Decision + output generation
  /ui
    └── ...                 # Frontend interface
```

Tech Stack:
- TypeScript
- Solana web3.js / Helius / RPC calls
- ElizaOS-like agent architecture
- WebSocket streaming
- Vite/Next.js UI (depending on setup)

## 🎮 Gameplay Loop

1. Stream starts → Skysent introduces new narrative “cycle”
2. Users interact → Skysent reacts using AI engine
3. On-chain data changes → Emotional + narrative state updates
4. Arcadius intervenes → Adds conflict
5. Skysent tries to upgrade → Needs more SOL (community-driven)
6. Repeat → Emergent storytelling

## 🎥 Demo (Trailer Coming Soon)

A short video will demonstrate:
- AI interaction
- Real-time Solana data reactions
- Live chat responsiveness
- Narrative tension with Arcadius

## ⚙️ Setup & Run

### Prerequisites
- Bun (runtime + package manager)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- TypeScript (global is convenient)
  ```bash
  bun install -g typescript
  ```
- ElizaOS (agent runner)
  ```bash
  bun i -g @elizaos/cli
  ```

### Environment Files
Duplicate and edit env files for both projects:
```bash
# Backend (Eliza agents)
cd rugaieliza
cp .env.example .env

# Frontend (Next.js UI)
cd ../rugai
cp .env.example .env.local
```
Fill values per the comments in each `.env.example`.

### Install Dependencies
```bash
# Backend deps
cd rugaieliza
bun install

# Frontend deps
cd ../rugai
npm install
```

### Start Both Projects
Run in two terminals:
```bash
# Terminal 1: Eliza agents
cd rugaieliza
elizaos start

# Terminal 2: Next.js UI
cd rugai
npm run dev
```
Frontend runs on http://localhost:3000

### Production Build (optional)
```bash
# Build backend
cd rugaieliza
bun run build

# Build frontend
cd ../rugai
npm run build

# Start production
cd ../rugaieliza && elizaos start --production
cd ../rugai && npm run start
```
