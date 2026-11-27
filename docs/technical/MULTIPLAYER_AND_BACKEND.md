# Sonko — Multiplayer & Backend Architecture

> **Source of Truth:** `server.ts` (2,796 lines), `src/game/onlineClient.ts`, `src/game/leaderboard.ts`, `src/game/adService.ts`, `src/game/modelPersistence.ts`.

---

## 1. Server Runtime Overview (`server.ts`)

Sonko runs a **single unified Node.js process** (Express + `http.createServer` + `ws` `WebSocketServer`) on port `3000`:
- In **development** (`npm run dev`), `server.ts` mounts Vite's `createServer({ middlewareMode: true })` for TypeScript/React compilation while serving `/api/*`, `/ws`, and static `/public/*` folders.
- In **production** (`npm run start`), `server.ts` serves prebuilt `dist/` assets (with `Cache-Control` headers: immutable for `/assets/` and `/models/`, no-store for `sw.js`) alongside `/api/*` and `/ws`.

---

## 2. REST API Surface (`server.ts`)

### Health & Compliance
- `GET /api/health` — Returns `{ status: 'ok', activeRooms, waitingQueue, ... }`.
- `GET /ads.txt` — Dynamically validated AdSense `ads.txt` response (`server/adsenseCompliance.ts`).

### Leaderboard (`/data/leaderboard.json`)
- `GET /api/leaderboard?playerId=...` — Returns top `10` entries, `totalPlayers`, plus caller's `yourEntry` & `yourRank`.
- `POST /api/leaderboard` — Validates `playerId`, `name` (≤ 24 chars), `score`, `venue`, `mode`, `wins`, `bullseyes`, `houses`; keeps highest `bestScore` per `playerId` and trims store to top `200`.

### Loadouts & Creator Studio (`/data/loadouts.json`, `/public/models/`, `/public/assets/`)
- `GET /api/loadout/:profileId` — Reads saved cosmetic loadout JSON.
- `PUT /api/loadout/:profileId` — Persists loadout JSON.
- `GET /api/models/manifest` — Lists active custom overrides (`kato`, `namukasa`, `ssemakula`, `auma`, `stone`, `surface`, `prop`), PBR surface maps, built-in style overrides, and voice clip manifest.
- `POST /api/models/upload` *(Studio-gated)* — Uploads `.glb`/`.gltf`/`.usdz`/`.zip` into `/public/models/`.
- `POST /api/models/surface-upload` *(Studio-gated)* — Uploads PBR texture maps (`albedo`, `normal`, `roughness`, `ao`) for `surface`.
- `POST /api/models/duplicate` *(Studio-gated)* — Clones an existing custom model slot to another slot.
- `POST /api/models/assign-asset` *(Studio-gated)* — Assigns an existing `/public/assets/` file into a model slot.
- `DELETE /api/models/:slot` *(Studio-gated)* — Clears a model slot override.
- `PUT /api/models/appearance/:slot` *(Studio-gated)* — Saves built-in character preset overrides (`skinTone`, `outfitStyle`, `shoeStyle`).
- `POST /api/voices/upload` *(Studio-gated)* — Uploads custom `.mp3`/`.ogg`/`.wav`/`.m4a`/`.webm` voice clip per character & dialogue category.
- `DELETE /api/voices/:slot` *(Studio-gated)* — Clears custom voice clips.
- `GET /api/assets/list` — Lists folders and 3D/texture files inside `/public/assets/`.
- `POST /api/assets/folders`, `DELETE /api/assets/folders/:folder`, `POST /api/assets/upload`, `PATCH /api/assets/move`, `DELETE /api/assets/file` *(Studio-gated)* — Full Asset Library file management.

### Monetization & Reward Tokens (`/data/monetization.json`)
- `POST /api/monetization/session` — Registers an ad reward opportunity (`double_match`, `mission_reroll`, `bonus_chest`, `interstitial`) and issues a single-use server `token` with daily limits.
- `POST /api/monetization/claim-reward` — Verifies single-use token, increments daily claim counter (`bonus_chest`: 1/day, `mission_reroll`: 2/day, `double_match`: 1 per `matchId`), and returns authorized Cowrie payout (`bonus_chest`: 60–140 Cowries).

### Publisher Contact (`/data/contact-messages.json`)
- `POST /api/contact` — Validates name, email, topic, and message (`10..2000` chars), appends submission to `/data/contact-messages.json`.

---

## 3. Online 1v1 WebSocket Protocol (`/ws`)

Managed by `server.ts` (`WebSocketServer({ server, path: '/ws' })`) and `src/game/onlineClient.ts`:

### Room Lifecycle & Matchmaking
- **`room:create`:** Creates a 5-character room code (excluding ambiguous `0/O/1/I`), assigns caller Slot `0`, records `courtSize` (`5` or `10`), `venue`, and player cosmetics.
- **`room:quickmatch`:** Pairs player via `waitingQueue` on matching `(courtSize, venue)` or creates a new waiting public room.
- **`room:join`:** Validates 5-char code, assigns caller Slot `1`, broadcasts `room:start` and `room:state` to both clients.
- **Disconnect / Cleanup:** Stale waiting or empty rooms auto-expire (`ROOM_TTL_MS`), and opponent disconnect notifies remaining player (`onlineOpponentConnected = false`).

### Authoritative Server Turn & Physics Handling
1. **Live Telemetry Relay:** `player:aim`, `player:hop`, `player:pickup`, `player:balance` relay low-latency opponent animations/status to the peer.
2. **`player:toss` (Server-Computed Landing):**
   - Server uses shared `courtLayout.ts` math (`evaluateStoneLanding`, `evaluateClaimLanding`) + room `windX` + server jitter to compute canonical `(targetX, targetY)`, preventing client-side aim spoofing.
   - Server broadcasts `game:toss` with authoritative landing coordinates so both clients animate identical stone arcs.
3. **`player:toss_result` & `player:turn_end`:**
   - Server updates authoritative `score`, `targetSquare`, `streak`, `perfectTosses`, `houses`, and `roundsCleared`.
   - Checks House (*Ekizimbe*) eligibility (`CLAIM_AIM`) and match win (`targetSquare >= courtSize`), emitting `game:claim_phase`, `game:turn_advance`, or `game:over`.
4. **`room:rematch`:** Tracks `rematchVotes: [boolean, boolean]`; when both `[true, true]`, resets board/scores with fresh weather puddles & wind and emits `room:rematch_start`.

---

## 4. Persistence Model & Current Limitations

| Data Store | Mechanism | Current Limitations |
| --- | --- | --- |
| **Leaderboard, Loadouts, Monetization, Contact** | Synchronous/async local JSON files under `/data/*.json` | Not suitable for horizontal scaling, serverless hosts (e.g., Vercel ephemeral filesystem), or high write concurrency. |
| **Uploaded Studio Models & Voices** | Local disk (`/public/models/`, `/public/assets/`) + Browser IndexedDB (`sonko_models_v1`) | Disk writes fail on read-only serverless platforms; local IDB changes do not sync across devices. |
| **Online 1v1 Rooms** | Single-process in-memory `Map<string, ServerRoom>` | Lost on server restart; cannot span multiple Node instances without Redis/shared pub-sub. |
| **Player Identity** | Unsigned browser UUID in `localStorage` | No authentication, account recovery, or cross-device sync. |
