# Sonko — Feature Status Matrix

> **Classification Key:**
> - `IMPLEMENTED`: Built, wired, and functional in the current codebase.
> - `PARTIALLY IMPLEMENTED`: Core exists, but gaps, wiring mismatches, or limitations prevent full end-to-end fulfillment.
> - `PLANNED`: Strategic product/vision feature not yet built in code.
> - `EXPERIMENTAL`: Developer-facing, environment-stubbed, or gated capability.
> - `DEPRECATED`: Superseded or disabled legacy code/assets remaining in the repository.

---

## 1. Gameplay & Traditional Games

| Feature | Classification | Code Evidence & Notes |
| --- | --- | --- |
| **Sonko (Ejjinja) Core Hopscotch Mechanics** | `IMPLEMENTED` | 5- & 10-square grids, stone toss, wind/puddle physics, hop sequences, single-foot balance, scoop, blind House (*Ekizimbe*) claim (`courtLayout.ts`, `sonko3DGameEngine.ts`). |
| **Game Modes: `SOLO`, `VS_BOT`, `TWO_PLAYER`, `TEAM_2V2`** | `IMPLEMENTED` | Full offline/local support with 3 AI difficulties (`EASY`, `NORMAL`, `HARD`). |
| **Online 1v1 Multiplayer (`/ws`)** | `IMPLEMENTED` | Private 5-char rooms, `?room=CODE` deep links, public Quick Match FIFO queue, authoritative server toss evaluation, rematch voting (`server.ts`, `onlineClient.ts`). |
| **Regional Tour Mode (`TourModal`)** | `PARTIALLY IMPLEMENTED` | Labeled `"Story · Uganda Courtyard Tour"`; works as a 4-venue completion stamp tracker (`1.0x`–`1.5x` Cowries), **not** a narrative story campaign. |
| **In-Game Narrative Story Mode** | `PLANNED` | No chapters, plot, cutscenes, or scripted progression exist yet. |
| **Kisenda (Second Traditional Game)** | `PLANNED` | Zero files, rules, or assets in repo; part of Long-Term Vision. |
| **Additional Ugandan Traditional Games** | `PLANNED` | Part of Long-Term Vision (`SONKO_LONG_TERM_VISION.md`). |
| **Practice Drills & Arcade Challenge Modes** | `PLANNED` | Beyond basic `SOLO` match runs, dedicated drills/arcade ladders do not exist. |

---

## 2. 3D Engine, Worlds & Characters

| Feature | Classification | Code Evidence & Notes |
| --- | --- | --- |
| **Three.js 3D Courtyard Engine** | `IMPLEMENTED` | `ugandanCompoundScene.ts`, `sonkoCourt3D.ts`, PBR textures, wind shaders, 8 camera presets, WebGL fallback. |
| **5 Selectable 3D Worlds (`WorldPlaceId`)** | `PARTIALLY IMPLEMENTED` | `kampala_compound`, `primary_schoolyard`, `entebbe_lakeside`, `trading_centre`, `ndere_festival` work in `QuickMatchModal`, but `OnlineLobbyModal` only exposes 4 `CourtVenueId`s; public copy still calls `trading_centre` *"Jinja Rain Garden"*; some optional `/public/assets/worlds/` files are missing on disk. |
| **Dynamic Weather & Daylight System** | `IMPLEMENTED` | 5 daylight presets + 7 weather modes affecting lighting, sky, tree wind, rain particles, puddles, bounce, and balance (`weather.ts`). |
| **4 Character Rigs, Emotions & Voice Engine** | `IMPLEMENTED` | `Kato`, `Namukasa`, `Ssemakula`, `Auma` procedural rigs, lip-sync, `/public/dialogues/*.txt` banks, Web Audio SFX & formant voices (`voiceEngine.ts`, `audio.ts`). *(Note: 2v2/Bot names `Amina`/`Mugisha` map onto `namukasa`/`auma` slots.)* |
| **Creator Studio & Asset Manager** | `EXPERIMENTAL` | Works in dev or when `SONKO_STUDIO_KEY` allows (`?studio=1`, `Shift+U`); 7 model slots, `.glb`/`.usdz`/`.zip`/PBR uploads, humanoid auto-rig, `.glb` export, IndexedDB VFS (`AssetManager.tsx`, `humanoidAutoRig.ts`). |
| **Legacy 2D Canvas Engine** | `DEPRECATED` | `src/game/SonkoCanvas.tsx` and `src/game/courtyardRenderer.ts` are unused remnants replaced by Three.js. |
| **Primary Schoolyard Vehicle Arrival Intro** | `DEPRECATED` | Disabled in `worldEnvironments.ts` (`arrivalActive = false`), though stale UI hooks and editorial text still reference it. |
| **Pine Forest Environment Loader** | `DEPRECATED` | `pineForestEnvironment.ts` references `/assets/worlds/kampala_compound/pine_forest.usdz` which is absent on disk. |

---

## 3. Progression, Economy & Social

| Feature | Classification | Code Evidence & Notes |
| --- | --- | --- |
| **Cowries Economy & Courtyard Stall** | `IMPLEMENTED` | 5 stones, 5 Kitenge/barkcloth outfits, 4 House stencils, non-monetary browser progression (`progression.ts`, `CourtyardStallModal.tsx`). |
| **Avatar Customizer** | `IMPLEMENTED` | 4 hair styles + swatch/hex primary & accent colors (`CharacterCustomizerModal.tsx`). |
| **Daily Login Streak & Treasure Chest** | `IMPLEMENTED` | 7-day Cowrie ladder + Day 7 bonus + interactive `DailyTreasureChest.tsx`. |
| **Daily Missions + Rewarded Reroll** | `IMPLEMENTED` | 7 rotating date-seeded missions + up to 2 daily ad rerolls (`dailyMission.ts`, `DailyMissionCard.tsx`). |
| **17 Achievements + Toast Alerts** | `IMPLEMENTED` | `COURTYARD`, `TOUR`, and `COLLECTION` tiers (`achievements.ts`, `AchievementsModal.tsx`, `AchievementToast.tsx`). |
| **Global Top-10 Leaderboard** | `IMPLEMENTED` | Server-persisted `/data/leaderboard.json` storing top 200 scores, anonymous `playerId` (`GlobalLeaderboard.tsx`). |
| **Accounts, Auth & Cloud Save** | `PLANNED` | Currently anonymous browser `localStorage` UUID only; no login or cross-device profile sync. |
| **Friends, Clubs, Spectating, Social Hubs** | `PLANNED` | Envisioned in `SONKO_LONG_TERM_VISION.md`; none built today. |
| **Tournaments, School & District Leagues** | `PLANNED` | Envisioned in `SONKO_LONG_TERM_VISION.md`; none built today. |

---

## 4. Platform, Infrastructure, SEO & Monetization

| Feature | Classification | Code Evidence & Notes |
| --- | --- | --- |
| **Editorial Content Site & Legal Pages** | `IMPLEMENTED` | `/`, `/how-to-play`, `/about`, `/privacy`, `/terms`, `/contact` (`SiteLayout.tsx`, `pages/*`). |
| **Offline PWA & Install Flow** | `IMPLEMENTED` | Workbox precache + runtime caching + iOS/Android install helper (`vite.config.ts`, `usePWAInstall.ts`). |
| **Static SEO Prerendering & Sitemap** | `IMPLEMENTED` | Build-time HTML snapshot generation (`staticPrerender.ts`), `routeMeta.ts`, `robots.txt`, `sitemap.xml`. |
| **Google AdSense & H5 Games Ads** | `PARTIALLY IMPLEMENTED` | Adapter, Consent Banner, Compliance checks, and single-use server reward tokens exist; **conflict** between `.env.example` (blank = Dev Simulator) and hardcoded `ca-pub-8832384771899504` in `index.html` / `adsenseCompliance.ts`. |
| **Full-Stack Deployment Readiness** | `PARTIALLY IMPLEMENTED` | `server.ts` works on persistent Node runtime, but conflicts with static `vercel.json` config (no `/ws` or `/data/*.json` persistence on Vercel static). |
| **Gemini AI Integration (`@google/genai`)** | `EXPERIMENTAL` | Dependency, `.env.example` key, and `metadata.json` capability exist as an unused stub; zero runtime calls implemented. |
