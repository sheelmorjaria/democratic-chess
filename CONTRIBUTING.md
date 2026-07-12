# Contributing to DemocraticChess

First off, thanks for taking the time to contribute! 🎉

## Development Environment
1. Ensure you have Node.js, PostgreSQL, and Redis installed.
2. Fork the repository and create your branch from `main`.
3. Run `npm install` in both `client/` and `server/` directories.
4. Use `npm run dev` to start local development.

## Coding Standards
- We use **ESLint** and **Prettier**. Ensure your code is formatted before committing.
- Use TypeScript strictly (no `any` types unless absolutely necessary).
- Backend: Follow RESTful principles for HTTP routes, and keep Socket.io event logic in dedicated controllers.
- Frontend: Use functional React components with Hooks. Keep chess logic (`chess.js`) separate from UI components.

## Pull Request Process
1. Update the `README.md` or documentation with details of changes to the interface, if applicable.
2. Ensure all tests pass (if applicable).
3. Request review from a maintainer.
4. PRs will be merged once approved and CI checks pass.
