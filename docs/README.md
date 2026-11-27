# Sonko Documentation Hub

Welcome to the canonical documentation system for **Sonko — Ugandan Courtyard Hopscotch**.

This documentation separates **what exists in the codebase today**, **where conflicts or technical debt exist**, and **what belongs to the long-term product and cultural vision**. No planned feature is presented as implemented, and open founder decisions are explicitly marked.

---

## Quick Navigation by Role

| Role | Recommended Reading Order |
| --- | --- |
| **Founder / Product Lead** | 1. [Origin & Identity](./vision/SONKO_ORIGIN_AND_IDENTITY.md) → 2. [Long-Term Vision](./vision/SONKO_LONG_TERM_VISION.md) → 3. [Open Decisions](./planning/OPEN_DECISIONS.md) → 4. [Documentation Audit](./planning/DOCUMENTATION_AUDIT.md) |
| **Game Designer / Creative** | 1. [Product Philosophy](./vision/SONKO_PRODUCT_PHILOSOPHY.md) → 2. [Game Design](./product/GAME_DESIGN.md) → 3. [World Design](./world/WORLD_DESIGN.md) → 4. [Story & Narrative](./world/STORY_AND_NARRATIVE.md) |
| **Engineer / Technical** | 1. [Technical Architecture](./technical/TECHNICAL_ARCHITECTURE.md) → 2. [Multiplayer & Backend](./technical/MULTIPLAYER_AND_BACKEND.md) → 3. [Deployment & Monetization](./technical/DEPLOYMENT_AND_MONETIZATION.md) → 4. [Feature Status](./planning/FEATURE_STATUS.md) |
| **Partnerships / Business** | 1. [Product Overview](./product/PRODUCT_OVERVIEW.md) → 2. [Long-Term Vision](./vision/SONKO_LONG_TERM_VISION.md) → 3. [Business & Sustainability](./business/BUSINESS_AND_SUSTAINABILITY.md) |

---

## Complete Documentation Index

### 1. Vision & Identity (`/docs/vision/`)
- [`SONKO_ORIGIN_AND_IDENTITY.md`](./vision/SONKO_ORIGIN_AND_IDENTITY.md) — Why Sonko exists, cultural roots, what Sonko actually is, the intended player experience, and how real-world origin differs from the planned in-game Story mode.
- [`SONKO_LONG_TERM_VISION.md`](./vision/SONKO_LONG_TERM_VISION.md) — Strategic ambition across Traditional Games (*Ejjinja*, *Kisenda*, etc.), Social World, Competitive Ecosystem, Real-World Impact, and Business Sustainability.
- [`SONKO_PRODUCT_PHILOSOPHY.md`](./vision/SONKO_PRODUCT_PHILOSOPHY.md) — Core design, authenticity, realism, and accessibility principles governing Sonko.

### 2. Current Product & Gameplay (`/docs/product/`)
- [`PRODUCT_OVERVIEW.md`](./product/PRODUCT_OVERVIEW.md) — Product scope, routes, target audience, and current experience today.
- [`GAME_MODES.md`](./product/GAME_MODES.md) — Solo, VS Bot, 2P Local, 2v2 Cranes vs Waves, Online 1v1, Uganda Tour, and planned modes.
- [`GAME_DESIGN.md`](./product/GAME_DESIGN.md) — Ground-truth mechanics, court grids (5 & 10 squares), turn state machine, toss physics, balance, scoop, blind House (*Ekizimbe*) claim, and scoring.
- [`PLAYER_JOURNEY.md`](./product/PLAYER_JOURNEY.md) — Onboarding, Cowrie economy, Courtyard Stall, Avatar Customizer, Daily Streak & Treasure Chest, Daily Missions, Achievements, and Global Leaderboard.

### 3. World, Narrative & Social (`/docs/world/`)
- [`WORLD_DESIGN.md`](./world/WORLD_DESIGN.md) — 5 playable 3D worlds, 4 gameplay/tour venue profiles, daylight and weather systems, and copy/scene discrepancies.
- [`PHOTOREALISM_WORLD_REFERENCE.md`](./PHOTOREALISM_WORLD_REFERENCE.md) — *(Existing preserved technical-art bible)* Visual ground-truth, composition, lighting, PBR material, and asset discipline rules for Sonko's 3D worlds.
- [`STORY_AND_NARRATIVE.md`](./world/STORY_AND_NARRATIVE.md) — Current Tour circuit, character roster (*Kato*, *Namukasa*, *Auma*, *Ssemakula*, *Amina*, *Mugisha*), dialogue banks, and open Story Mode creative direction.
- [`SOCIAL_EXPERIENCE.md`](./world/SOCIAL_EXPERIENCE.md) — Current local/online social features versus proposed community plazas, friendships, and spectating.

### 4. Technical & Operations (`/docs/technical/`)
- [`TECHNICAL_ARCHITECTURE.md`](./technical/TECHNICAL_ARCHITECTURE.md) — Tech stack, 3D WebGL engine, auto-rigging, Creator Studio & Asset Manager, Audio/Voice engines, PWA offline caching, and static SEO prerendering.
- [`MULTIPLAYER_AND_BACKEND.md`](./technical/MULTIPLAYER_AND_BACKEND.md) — Express REST APIs, `/ws` WebSocket room protocol, JSON persistence, and scaling constraints.
- [`DEPLOYMENT_AND_MONETIZATION.md`](./technical/DEPLOYMENT_AND_MONETIZATION.md) — Build/start topology, Vercel vs Node server conflict, Google AdSense & H5 Games Ads integration, reward tokens, and consent.

### 5. Audit, Truth & Planning (`/docs/planning/`)
- [`DOCUMENTATION_AUDIT.md`](./planning/DOCUMENTATION_AUDIT.md) — Full Phase 1 repository audit: existing docs, conflicts, deprecated/inert code & orphaned assets, undocumented implemented systems, and missing history.
- [`FEATURE_STATUS.md`](./planning/FEATURE_STATUS.md) — Feature-by-feature classification (`IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, `PLANNED`, `EXPERIMENTAL`, `DEPRECATED`).
- [`PRODUCT_ROADMAP.md`](./planning/PRODUCT_ROADMAP.md) — Sequenced, realistic roadmap from current build to multi-game ecosystem.
- [`OPEN_DECISIONS.md`](./planning/OPEN_DECISIONS.md) — Unresolved creative, product, and technical decisions requiring founder review.

### 6. Business (`/docs/business/`)
- [`BUSINESS_AND_SUSTAINABILITY.md`](./business/BUSINESS_AND_SUSTAINABILITY.md) — Current free-to-play ad-supported baseline versus speculative future partnerships, tournaments, and expansion models.

---

## Documentation Rules

1. **Ground truth first:** Every technical claim in `/docs/product/`, `/docs/technical/`, and `/docs/planning/FEATURE_STATUS.md` reflects direct inspection of `src/`, `server.ts`, `public/`, `data/`, and config files.
2. **Explicit separation:** Current reality, planned roadmap items, and speculative long-term ideas are always labeled separately.
3. **Preserve history:** Pre-existing documentation (`PHOTOREALISM_WORLD_REFERENCE.md`) is preserved intact and referenced directly.
