# 🤝 DemocraticChess (Working Title)

A real-time, synchronous democratic chess application allowing teams to compete against other teams or individuals. Teams democratically vote on legitimate moves while communicating through integrated live text and voice chat.

## 🌟 Unique Value Proposition
Unlike traditional "Vote Chess" which is asynchronous (taking days per move), DemocraticChess is synchronous. Teams debate and vote on moves in real-time under blitz/fast time controls, experiencing the thrill of an esports "coach room" together.

## 🛠 Tech Stack
- **Frontend:** React (Next.js), `react-chessboard`, `chess.js`
- **Backend:** Node.js, Express, Socket.io
- **Database:** PostgreSQL (Prisma ORM), Redis (Ephemeral game state)
- **Voice/Video:** WebRTC via LiveKit
- **Mobile Deployment:** Capacitor (wrapping the React web app)

## 🚀 Quick Start
### Prerequisites
- Node.js v18+
- PostgreSQL
- Redis

### Installation
1. Clone the repo: `git clone https://github.com/yourusername/democratic-chess.git`
2. Install server dependencies: `cd server && npm install`
3. Install client dependencies: `cd client && npm install`
4. Set up environment variables (see `.env.example` in both directories)
5. Run development servers: `npm run dev` in both `client` and `server`

## 📖 Documentation
- [Architecture & Game Loop](./ARCHITECTURE.md)
- [Socket Events API](./SOCKET_EVENTS.md)
- [Project Roadmap](./ROADMAP.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
