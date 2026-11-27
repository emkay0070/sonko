# Sonko — Ugandan Courtyard Hopscotch

**Sonko** is a browser-native, offline-capable 3D adaptation of Uganda's traditional schoolyard and courtyard hopscotch game (played with a river stone, chalk grids, single-foot balance, and blind over-the-shoulder **House / *Ekizimbe*** claiming).

Built with React, TypeScript, Three.js, Tailwind CSS, Workbox PWA, and an Express + WebSocket multiplayer backend (`server.ts`), Sonko pairs an editorial web portal (`/`) with a full 3D courtyard game hub (`/play`).

---

## Documentation Hub

All authoritative product, vision, design, world, technical, business, and audit documentation lives in **`/docs/`**:

- **Start here:** [`docs/README.md`](./docs/README.md)
- **Founder Identity & Origin:** [`docs/vision/SONKO_ORIGIN_AND_IDENTITY.md`](./docs/vision/SONKO_ORIGIN_AND_IDENTITY.md)
- **Long-Term Vision:** [`docs/vision/SONKO_LONG_TERM_VISION.md`](./docs/vision/SONKO_LONG_TERM_VISION.md)
- **Current Feature Truth Matrix:** [`docs/planning/FEATURE_STATUS.md`](./docs/planning/FEATURE_STATUS.md)
- **Repository & Documentation Audit:** [`docs/planning/DOCUMENTATION_AUDIT.md`](./docs/planning/DOCUMENTATION_AUDIT.md)

---

## Quick Runbook (Verified Scripts)

- `npm run dev` — Starts `server.ts` (Express + `/ws` WebSocket server + Vite dev middleware) on port `3000`.
- `npm run build` — Runs `vite build` to produce the static/prerendered client bundle in `dist/` and Workbox service worker.
- `npm run start` — Starts `server.ts` in production mode (`NODE_ENV=production`) serving `dist/`, `/api/*`, and `/ws`.
- `npm run lint` — Runs `tsc --noEmit` TypeScript verification.

See [`docs/technical/DEPLOYMENT_AND_MONETIZATION.md`](./docs/technical/DEPLOYMENT_AND_MONETIZATION.md) for environment variables and hosting notes.
