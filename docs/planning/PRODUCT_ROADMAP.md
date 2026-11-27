# Sonko — Product Roadmap

> **Planning Principle:** Sequences evolution cleanly from Sonko's verified current codebase toward the multi-game, social, competitive, and real-world vision in [`SONKO_LONG_TERM_VISION.md`](../vision/SONKO_LONG_TERM_VISION.md). Milestones beyond Phase 1 depend on founder decisions recorded in [`OPEN_DECISIONS.md`](./OPEN_DECISIONS.md).

---

## Phase 0 — Foundation & Trust Cleanup *(Immediate)*
*Zero risky rewrites; resolve audited discrepancies so product, copy, and architecture match.*
- Align public website copy (`HomePage`, `AboutPage`, `index.html`, `adsenseCompliance.ts`) with actual implemented **Trading Centre** world and remove stale `"arrival animation"` claim.
- Clarify `"Uganda Regional Tour"` vs future `"Story Mode"` naming, and unify character slot naming (`Namukasa`/`Auma` vs `Amina`/`Mugisha`).
- Archive or delete dead legacy code/assets (`SonkoCanvas.tsx`, `courtyardRenderer.ts`, inert arrival state, unused `.usdz`/`.glb` props, unused `@google/genai` stub if unneeded).
- Align AdSense `ca-pub` config vs Dev Simulator env behavior and settle Node (`server.ts`) vs static (`vercel.json`) hosting split.

## Phase 1 — Ejjinja Polish & Backend Hardening *(Near-Term)*
*Elevate the flagship game and make online multiplayer production-grade.*
- Replace flat-file `/data/*.json` storage with a proper database (e.g., PostgreSQL or Firestore) + user accounts/optional guest-to-account upgrade for cross-device Cowries, cosmetics, and verified leaderboards.
- Harden Online 1v1 (`/ws`): reconnect grace windows, turn timers/AFK handling, server-side hop/balance sanity checks, and seasonal/venue-filtered leaderboards.
- Add dedicated **Interactive Tutorial / Practice Drills** (wind-aiming range, balance challenge, House-claim trainer).

## Phase 2 — Narrative & Second Traditional Game *(Mid-Term)*
*Expand Sonko from one courtyard game into a cultural platform.*
- **In-Game Story Mode (`[Requires Creative Lock]`):** Scripted multi-stop regional narrative featuring *Kato*, *Namukasa*, *Auma*, and *Ssemakula* across the 5 Ugandan worlds.
- **Launch `Kisenda`:** Design, prototype, and ship Sonko's second authentic traditional Ugandan game sharing player avatars, Cowries, and worlds.
- Introduce **Arcade / Challenge Modes** (daily seeded wind challenges, endless clean-streak runs).

## Phase 3 — Social World & Competitive Ecosystem *(Growth)*
*Transform individual play into community rivalry and belonging.*
- Persistent player profiles, **Friend Lists**, direct `1v1` / `2v2` challenge invites, and safe quick-chat/emote wheel.
- **Live Spectating** inside 3D courtside seating + replay sharing.
- **Structured Tournaments & Leagues:** Weekend knockout cups, **School & University Cups**, and **Parish / District Representation** ladders.
- Curated **Community Creator Pipeline** expanding Creator Studio for Ugandan 3D artists, textile designers, and local-language voice packs.

## Phase 4 — Physical Courtyard Bridge & East African Expansion *(Long-Term)*
*Real-world impact and multi-country traditional games.*
- Hybrid **Digital-to-Physical Tournaments** (online qualifiers feeding live Ugandan courtyard finals, school heritage days, and festival events).
- Additional Ugandan & East African traditional games (*Omweso*, *Kwepena*, *Kati*, etc.).
- Regional localization (Luganda, Runyankole, Luo, Lusoga, Swahili) and East African / global diaspora expansion.
