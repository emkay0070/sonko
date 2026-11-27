# Sonko — Technical Architecture

> **Source of Truth:** `package.json`, `vite.config.ts`, `tsconfig.json`, `server.ts`, `src/App.tsx`, `src/router.tsx`, `src/scene3d/`, `src/game/`.

---

## 1. Technology Stack

| Layer | Technology / Library | Version / Notes |
| --- | --- | --- |
| **UI Framework** | React + React DOM | `^19.0.0` |
| **Language** | TypeScript | `~5.8.2` (`tsc --noEmit` via `npm run lint`) |
| **Build & Dev Bundler** | Vite | `^8.0.1` |
| **3D Engine** | Three.js (`three`, `@types/three`) | `^0.187.0` (WebGL + `OrbitControls`, `Sky`, `RoomEnvironment`, `GLTFLoader`, `USDZLoader`, `GLTFExporter`, `DRACOLoader`) |
| **Styling & Motion** | Tailwind CSS v4 (`@tailwindcss/vite`), `motion`, `lucide-react` | `^4.1.14`, `^12.23.24`, `^0.546.0` |
| **Backend & Realtime** | Node.js, Express (`^4.21.2`), `ws` (`^8.18.0`), `multer` (`^2.1.1`), `jszip` (`^3.10.1`) | Served on port `3000` via `tsx server.ts` |
| **PWA & Offline** | `vite-plugin-pwa` (`^1.2.0`), Workbox | Precache + network-first/stale-while-revalidate asset caching |
| **Server Prerendering** | Custom Vite `closeBundle` plugin (`src/seo/staticPrerender.ts`) | Generates static HTML per editorial route in `dist/` |
| **Unused Stub Dep** | `@google/genai` (`^2.4.0`) | Installed in `package.json`; **not imported or invoked anywhere** |

---

## 2. Repository Module Layout

```text
/
├── server.ts                       # Express REST APIs, WebSocket /ws server, Vite dev/prod middleware
├── server/adsenseCompliance.ts     # Editorial compliance helpers, HTML injection, /ads.txt validation
├── vite.config.ts                  # React, Tailwind v4, PWA manifest/Workbox, static SEO prerender plugin
├── data/                           # Flat-file JSON persistence (loadouts, monetization, leaderboard, contact)
├── docs/                           # Consolidated documentation + PHOTOREALISM_WORLD_REFERENCE.md
├── public/
│   ├── assets/                     # 3D models (.glb/.usdz) & textures (veranda_surface.jpg)
│   ├── dialogues/                  # Character speech banks (kato, namukasa, auma, ssemakula .txt)
│   ├── models/                     # Creator Studio uploaded overrides + manifest.json
│   └── ads.txt, robots.txt, sitemap.xml, PWA icons
└── src/
    ├── App.tsx, router.tsx         # Client History API SPA router & route metadata sync
    ├── pages/                      # Editorial pages (Home, HowToPlay, About, Privacy, Terms, Contact, 404)
    ├── components/                 # Game HUD, UgandanCompoundViewport, AssetManager, all modals
    ├── game/                       # Court math, weather, audio, voice, progression, onlineClient, ads
    ├── scene3d/                    # Three.js engine, 5 worlds, procedural/GLB rigs, PBR & wind shaders
    ├── hooks/usePWAInstall.ts      # BeforeInstallPrompt & navigator.onLine hooks
    └── seo/                        # Route metadata & build-time HTML prerenderer
```

---

## 3. 3D Rendering & Simulation Pipeline (`src/scene3d/`)

- **Engine Split:**
  - `sonko3DGameEngine.ts`: Deterministic simulation loop (`update(dt)`), turn phase state machine, stone ballistics, court rule evaluation, single-foot balance, AI bot decisions, and WebSocket event reconciliation.
  - `ugandanCompoundScene.ts`: Owns the `THREE.WebGLRenderer`, camera presets + `OrbitControls`, `Sky` shader, hemisphere/directional shadow lighting, dust/rain particle systems, and lifecycle wiring across scenes.
- **5 World Builders (`worldEnvironments.ts`):**
  - Orchestrates `kampala_compound`, `primary_schoolyard` (`primarySchoolyardScene.ts`), `entebbe_lakeside` (`entebbeLakesideScene.ts`), `trading_centre`, and `ndere_festival`.
  - Uses procedural PBR texture generators (`pbrTextures.ts`), foliage/grass (`vegetation.ts`), shared GLSL vertex wind shaders (`treeWind.ts`), distant horizon rings (`distantWorld.ts`), compound architecture/props (`compoundArchitecture.ts`, `compoundProps.ts`), and terrain heightmaps (`terrain.ts`).
- **Character Rigging & Animation (`characters.ts`, `proceduralCharacter.ts`, `glbCharacterController.ts`, `humanoidAutoRig.ts`, `glbAppearance.ts`):**
  - Built-in procedural Ugandan child characters (`kato`, `namukasa`, `ssemakula`, `auma`) with full limb IK/keyframe poses (`IDLE_AIM`, `THROW_FOLLOW`, `HOP_LEFT_FOOT`, `HOP_RIGHT_FOOT`, `HOP_TWO_FEET`, `BEND_PICKUP`, `WALK_STRIDE`, `VICTORY_DANCE`, `EMOTE_LAUGH`, `EMOTE_ANNOYED`, `SIDELINE_CHEER`), facial expressions, and lip-sync jaw/mouth animation.
  - Supports replacing any character slot via Creator Studio using `humanoidAutoRig.ts` (normalizes proportions and auto-maps humanoid Mixamo/standard bone hierarchies on uploaded `.glb`/`.gltf`/`.usdz`).
- **Model Loading & Export (`modelLoader.ts`):**
  - Supports `.glb`, `.gltf`, `.usdz`, and `.zip` packages (plus DRACO decompression via `public/draco/` fallback or bundled loaders), caching decoded geometries/materials and exporting rigged characters back to `.glb` (`GLTFExporter`).
- **WebGL Recovery:**
  - `UgandanCompoundViewport.tsx` catches WebGL context creation failure or `webglcontextlost` and displays a styled recovery fallback without crashing the React tree.
- **Deprecated Legacy 2D Renderer (`DEPRECATED`):**
  - `src/game/SonkoCanvas.tsx` (1,862 lines) and `src/game/courtyardRenderer.ts` (1,339 lines) implement the older 2D HTML5 Canvas version and are **no longer mounted anywhere**.

---

## 4. Creator Studio & Asset Manager (`AssetManager.tsx`, `UgandanCompoundViewport.tsx`, `modelPersistence.ts`)

- **Access Control:**
  - Always unlocked in Vite dev mode (`import.meta.env.DEV`), OR when `SONKO_STUDIO_KEY` is configured/empty on the server and user passes `?studio=1` or presses `Shift + U` / clicks Studio in the View Bar.
  - Note: When `SONKO_STUDIO_KEY` is set on the server, mutating asset/model/voice routes require the `x-sonko-studio-key` header.
- **Capabilities:**
  - **7 Persisted Model Slots:** `kato`, `namukasa`, `ssemakula`, `auma`, `stone`, `surface` (court ground model or PBR maps: albedo/normal/roughness/AO), and `prop`.
  - **Dual Persistence:** Uploads persist to server disk (`/public/models/` + `/data/loadouts.json`) AND mirror locally inside browser **IndexedDB** (`sonko_models_v1`) so offline/custom edits survive locally.
  - **Asset Library Explorer (`AssetManager.tsx`):** 3-pane browser for `/public/assets/` supporting folder creation, uploads, drag/move between folders, deletion, and one-click assignment into any of the 7 active slots.
  - **Built-in Character Styling:** Live preset editor for skin tone, outfit color, and shoe style stored via `avatarLoadoutService.ts` / IndexedDB.

---

## 5. Audio & Voice Engines (`src/game/audio.ts`, `voiceEngine.ts`, `dialogueLoader.ts`)

- **Procedural Web Audio (`sonkoAudio`):** Zero-dependency Web Audio API synthesizer producing toss whooshes, murram/sand stone bounces, puddle splashes, amadinda/marimba pentatonic hop tones (escalating pitch per hop), scoop chimes, whistle/buzz fouls, House (*Ekizimbe*) chords, and victory fanfares.
- **Character Voice & Lip-Sync (`sonkoVoice`):**
  - Loads `/public/dialogues/{slot}.txt` event pools (`INTRO`, `BULLSEYE`, `WOBBLE`, `LAUGH`, etc.).
  - Plays custom uploaded studio audio clips (`.mp3`/`.ogg`/`.wav`) if assigned, else falls back to `SpeechSynthesis` + Web Audio formant chirps, exposing real-time RMS/envelope intensity (`getLipSyncIntensity`) to drive 3D character mouths and floating speech bubbles (`subtitlesEnabled`).

---

## 6. PWA & Offline Capability (`vite.config.ts`, `usePWAInstall.ts`, `OfflineIndicator.tsx`, `PWAInstallButton.tsx`)

- **Manifest (`registerType: 'autoUpdate'`):** Standalone fullscreen/portrait+landscape app (`Sonko`, theme `#3B1A10`, background `#1A0B07`, icons `192x192`, `512x512`, `maskable`).
- **Workbox Caching:**
  - Precache includes HTML, JS, CSS, SVG, icons, and `/dialogues/*.txt` (`maximumFileSizeToCacheInBytes: 6 MiB`).
  - `NetworkFirst` runtime caching for `/`, `/play`, `/how-to-play`, `/about`, `/privacy`, `/terms`, `/contact`.
  - `StaleWhileRevalidate` for `/models/*`, `/assets/*`, `/dialogues/*` (`maxEntries: 80`).
  - Excludes `/api/*` and `/ws` from navigation fallback (`navigateFallbackDenylist`).
- **Offline Play:** `Solo`, `VS Bot`, `2P Local`, and `2v2` run 100% client-side offline; `Online 1v1` and `Global Leaderboard` gracefully report offline status via `OfflineIndicator.tsx`.
