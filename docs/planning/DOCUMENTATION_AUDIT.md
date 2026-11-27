# Sonko — Repository & Documentation Audit (Phase 1)

> **Audit Date:** 2026-11-27  
> **Scope:** Full repository inspection across `src/`, `server.ts`, `server/`, `public/`, `data/`, `docs/`, and root configuration files.  
> **Note on Version Control:** No `.git` directory exists in the workspace (`git status` unavailable). Pre-snapshot commit history and rationale are therefore not recoverable from git and are noted where founder clarification is needed.

---

## 1. Existing Documentation Inventory

Prior to this consolidation:
- **Root `README.md`:** Did not exist (added during this consolidation to index `/docs/`).
- **Pre-existing docs:** Only **1** file existed: `/docs/PHOTOREALISM_WORLD_REFERENCE.md`.

### Evaluation of `/docs/PHOTOREALISM_WORLD_REFERENCE.md`
- **Status:** **ACCURATE & VALUABLE (Preserved Intact)**
- **Findings:** Faithfully captures the photorealistic Ugandan aesthetic principles, camera framing, PBR material discipline, and deliberate rejection of out-of-place Western/suburban props across **Kampala Compound**, **Primary Schoolyard**, **Trading Centre**, **Entebbe Lakeside**, and **Ndere Night Yard**.
- **Minor Gap:** Does not cover gameplay rules, multiplayer, progression economy, monetization, PWA, or backend architecture. Now cross-referenced from `/docs/README.md` and `/docs/world/WORLD_DESIGN.md`.

---

## 2. Outdated / Inaccurate Public Copy vs. Code Reality

1. **`"Jinja Rain Garden"` vs. `Trading Centre` (`HomePage.tsx`, `AboutPage.tsx`, `index.html`, `server/adsenseCompliance.ts`):**
   - Public web copy and SEO metadata describe **"Jinja Rain Garden"** as one of the 5 3D settings and never mention **Trading Centre**.
   - In actual code (`src/game/progression.ts`, `src/scene3d/worldEnvironments.ts`, `src/components/QuickMatchModal.tsx`), **Trading Centre** (`trading_centre`) replaced the Jinja garden scene and maps onto `venueId: 'jinja_rain'`. Meanwhile `TourModal.tsx` and `OnlineLobbyModal.tsx` display `VENUE_SPECS.jinja_rain.name` (**"Trading Centre"**) while using key `'jinja_rain'` (`rain_garden` achievement icon/text still says *"Jinja Monsoon Master"* / *"Rain Runner"*).
2. **"Primary Schoolyard Arrival Animation" Claim (`AboutPage.tsx`, `server/adsenseCompliance.ts`):**
   - Website copy claims Primary Schoolyard includes a vehicle *"arrival animation"*.
   - Code in `src/scene3d/worldEnvironments.ts` (line 152, 730–741) explicitly marks `arrivalActive = false` (`"Legacy arrival state kept inert for backward API compatibility"`), and `PHOTOREALISM_WORLD_REFERENCE.md` explicitly mandates *"no out-of-place arrival vehicle"*. Still-wired UI overlays (`arrivalPlaying` in `SonkoGameExperience.tsx` & `UgandanCompoundViewport.tsx`) never activate.
3. **"Story · Uganda Courtyard Tour" Naming (`TourModal.tsx`):**
   - Labeled `"Story"` in UI even though there is zero narrative story mode—only a 4-stop regional venue stamp tracker.

---

## 3. Duplicate & Conflicting Technical Decisions

| # | Conflict Area | Side A | Side B |
| --- | --- | --- | --- |
| **C1** | **Hosting Topology** | `vercel.json` + static HTML prerendering + `sonko-ug.vercel.app` URLs (`robots.txt`, `sitemap.xml`, `routeMeta.ts`) imply static serverless hosting. | `server.ts` relies on stateful Node Express + `/ws` WebSocket rooms + writable `/data/*.json` & `/public/models/` disk files. |
| **C2** | **AdSense Client ID vs. Dev Simulator** | `.env.example` says leave `VITE_ADSENSE_CLIENT_ID` / `ADSENSE_CLIENT_ID` blank to use Dev Ad Simulator. `adService.ts` checks `VITE_ADSENSE_CLIENT_ID`. | `index.html`, `public/ads.txt`, and `server/adsenseCompliance.ts` (`DEFAULT_ADSENSE_CLIENT_ID`) hardcode `ca-pub-8832384771899504`. |
| **C3** | **4 Venues vs. 5 Worlds** | `CourtVenueId` has **4** entries (`kampala_murram`, `entebbe_sand`, `jinja_rain`, `ndere_night`) used in Tour, Online Lobby, Leaderboard. | `WorldPlaceId` has **5** entries (`kampala_compound`, `primary_schoolyard`, `entebbe_lakeside`, `trading_centre`, `ndere_festival`). Online Lobby cannot pick `primary_schoolyard` directly. |
| **C4** | **Character Roster Names** | `characters.ts`, `public/dialogues/*.txt`, and Creator Studio define **`Kato`, `Namukasa`, `Ssemakula`, `Auma`**. | `sonko3DGameEngine.ts` names bots/teammates **`Amina (Bot)`**, **`Amina (Waves)`**, **`Kato (Cranes)`**, **`Mugisha (Waves)`**—mapping `Amina` onto `namukasa`'s slot and `Mugisha` onto `auma`'s slot. |
| **C5** | **Unused Gemini Capability** | `package.json` includes `@google/genai` (`^2.4.0`), `.env.example` lists `GEMINI_API_KEY`, `metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`. | Zero imports or API calls to `@google/genai` or `GEMINI_API_KEY` exist anywhere in `src/` or `server.ts`. |
| **C6** | **2D vs. 3D Engine Files** | Active product uses Three.js (`UgandanCompoundViewport.tsx` + `sonko3DGameEngine.ts`). | Unused 2D engine `src/game/SonkoCanvas.tsx` (1,862 lines) and `src/game/courtyardRenderer.ts` (1,339 lines) remain in `src/game/`. |

---

## 4. Previously Undocumented Implemented Features

Until this documentation effort, **all** of the following implemented systems had zero dedicated documentation:
- Full 3D gameplay engine (`sonko3DGameEngine.ts`) including wind drift, rain puddles, balance meter, stone scooping, and blind over-the-shoulder House (*Ekizimbe*) tossing.
- Complete WebSocket `/ws` multiplayer server & authoritative toss evaluation (`server.ts`, `onlineClient.ts`).
- Offline-capable Workbox PWA setup (`vite.config.ts`, `usePWAInstall.ts`, `OfflineIndicator.tsx`, `PWAInstallButton.tsx`).
- Progression & economy systems: Cowries currency, Courtyard Stall (5 stones, 5 outfits, 4 stencils), Avatar Customizer, 17 Achievements, 7-Day Daily Streak + animated `DailyTreasureChest`, 7 rotating Daily Missions, and Global Top-10 Leaderboard (`/api/leaderboard`).
- Creator Studio & 3-Pane Asset Manager (`AssetManager.tsx`, `humanoidAutoRig.ts`, `modelLoader.ts`, `modelPersistence.ts`, IndexedDB VFS, voice `.mp3/.ogg` overrides).
- Procedural Web Audio synthesizer (`audio.ts`) and lip-synced formant/speech voice engine (`voiceEngine.ts`, `/public/dialogues/*.txt`).
- Google AdSense / H5 Games Ads service, server reward token verification (`/api/monetization/*`), Dev Ad Simulator, Consent Banner, and static SEO prerenderer.

---

## 5. Deprecated, Inert, or Orphaned Code & Assets

### Deprecated / Inert Code
- `src/game/SonkoCanvas.tsx` & `src/game/courtyardRenderer.ts` — Legacy 2D Canvas hopscotch implementation; unmounted anywhere.
- `arrivalPlaying` / `skipArrivalSequence` / `getArrivalCameraTarget` (`worldEnvironments.ts`, `ugandanCompoundScene.ts`, `UgandanCompoundViewport.tsx`, `SonkoGameExperience.tsx`) — Inert arrival sequence stub; `arrivalActive` is hardcoded `false`.
- `src/scene3d/pineForestEnvironment.ts` — Imported by `ugandanCompoundScene.ts`, attempts to load `/assets/worlds/kampala_compound/pine_forest.usdz` which does **not** exist in `/public/assets/`.

### Orphaned / Missing Asset References Observed
Comparing `find public` against scene loader calls (`worldEnvironments.ts`, `compoundProps.ts`, `distantWorld.ts`):
- **Files present on disk in `/public/assets/` not referenced by active scenes:**
  - `/public/assets/props/Trailer_Park.usdz` (explicitly excluded by `PHOTOREALISM_WORLD_REFERENCE.md`)
  - `/public/assets/vehicles/honda_odyssey_2021_low_detail_asian_market.glb`
  - `/public/assets/worlds/entebbe_lakeside/gislinge_viking_boat.glb` (explicitly replaced/excluded in favor of `fishing_boat.glb` per `PHOTOREALISM_WORLD_REFERENCE.md`)
  - `/public/assets/worlds/entebbe_lakeside/rock_formation_scan_2.usdz`
  - `/public/assets/worlds/entebbe_lakeside/Scanned_Plants_and_Grass_Free_Download.usdz`
  - `/public/assets/worlds/trading_centre/Low-Poly_Simple_Wooden_Crate.usdz` (scene loads `.glb` variant)
- **Files referenced in code that do not currently exist on disk in `/public/assets/`** (silently skipped by optional asset loaders or fallback geometry):
  - `/assets/worlds/kampala_compound/pine_forest.usdz`
  - `/assets/worlds/kampala_compound/bicycle.glb` & `bicycle_classic.glb`
  - `/assets/worlds/kampala_compound/chicken_coop_free.glb`, `chicken__1_.glb`, `a_chicken_in_low_poly.glb`
  - `/assets/worlds/ndere_festival/luo_hut.usdz`

---

## 6. Planned Features Mentioned in Vision/Config Not Yet Implemented
- **Kisenda** (proposed traditional Ugandan game — zero occurrences in repo).
- **Narrative Story Mode** (chapters, plot, canonical character arcs, cutscenes).
- **Accounts, Friends Lists, Direct Challenges, Live Spectating, & Social Plazas.**
- **Structured Tournaments, School Cups, Parish/District/National Leagues.**
- **Practice / Training Drills & Arcade Modes.**
- **Physical-World Event Sync & Branded Sponsorship Tooling.**
- **Server-Side Gemini AI Features** (stubbed in `.env.example` / `package.json` / `metadata.json` only).

---

## 7. Missing Historical Decisions (Due to Absent Git History)
Because `.git` is absent from the workspace, the following historical rationales are inferred from code comments rather than commit logs and remain open for founder verification:
- Exact reason `Jinja Rain Garden` became `Trading Centre` while retaining `venueId: 'jinja_rain'`.
- Whether `@google/genai` was added as starter boilerplate or reserved for a planned AI feature (e.g., dynamic commentary/Story Mode/Kisenda referee).
- Whether `vercel.json` or `server.ts` reflects the intended production hosting plan.
