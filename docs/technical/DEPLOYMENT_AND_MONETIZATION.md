# Sonko — Deployment, Configuration & Monetization

> **Source of Truth:** `package.json`, `.env.example`, `vercel.json`, `vite.config.ts`, `index.html`, `server.ts`, `server/adsenseCompliance.ts`, `src/game/adService.ts`, `/public/{ads.txt,robots.txt,sitemap.xml}`.

---

## 1. Environment Variables (`.env.example`)

| Variable | Scope | Purpose |
| --- | --- | --- |
| `PORT` | Server | HTTP + WebSocket listening port (default `3000`; must be `3000` in AI Studio runtime). |
| `SONKO_STUDIO_KEY` | Server | Optional access key for mutating Creator Studio `/api/models/*`, `/api/assets/*`, and `/api/voices/*` endpoints (`x-sonko-studio-key`). |
| `VITE_ADSENSE_CLIENT_ID` | Client | AdSense publisher ID (e.g., `ca-pub-...`). Leave blank to activate the Development Ad Simulator in `AdService`. |
| `ADSENSE_CLIENT_ID` | Server | Server-side AdSense publisher ID injected into HTML/ads compliance checks (`server/adsenseCompliance.ts`). |
| `VITE_ADSENSE_DISPLAY_SLOT` | Client | Optional slot ID for display ads on editorial pages. |
| `VITE_ADBREAK_FREQUENCY` | Client | Optional Google H5 Games `adConfig` frequency string (default `'120s'`). |
| `GEMINI_API_KEY` | Config Stub | Present in `.env.example` and `metadata.json` (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`), **not currently used anywhere in code**. |

---

## 2. Deployment Topology & Known Hosting Conflict

### Runtime Scripts (`package.json`)
- `npm run dev` → `tsx server.ts` (Full-stack Node + Express + `/ws` + Vite HMR/dev middleware).
- `npm run build` → `vite build` (Builds `dist/`, runs Workbox SW generation, and prerenders `/`, `/how-to-play`, `/about`, `/privacy`, `/terms`, `/contact`, `/play` HTML snapshots via `src/seo/staticPrerender.ts`).
- `npm run start` → `NODE_ENV=production tsx server.ts` (Serves `dist/` + all `/api/*` + `/ws` + writable `/data` & `/public`).

### Critical Conflict: Node Full-Stack (`server.ts`) vs. Static Hosting (`vercel.json`)
- `vercel.json` configures static SPA rewrites (`"source": "/((?!api/|assets/|models/|dialogues/|ws).*)"` → `"/index.html"`) and references domain `https://sonko-ug.vercel.app` (`robots.txt`, `sitemap.xml`, `routeMeta.ts`).
- **However**, Vercel static deployment (`dist/` alone) does **not** run the stateful Express + `ws` server (`server.ts`) or persist `/data/*.json` and `/public/models/`.
- **Impact when hosted statically without `server.ts`:**
  - `Online 1v1` (`/ws`) cannot connect.
  - `Global Leaderboard` (`/api/leaderboard`), `Contact Form` (`/api/contact`), `Monetization Tokens` (`/api/monetization/*`), and `Asset/Model Uploads` fail or fall back gracefully (`ContactPage` shows fallback email `support@sonkogame.com`).
- **Recommendation:** Deploy full-stack Node hosting (Fly.io, Railway, Cloud Run, Render, or VPS with persistent volume) for live multiplayer/leaderboards, OR split static frontend + dedicated backend URL (`VITE_API_BASE` / `VITE_WS_URL` not yet parameterized).

---

## 3. AdSense & Google H5 Games Ads Architecture

### Compliance Layer (`server/adsenseCompliance.ts` & `index.html`)
- Injects/validates `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=...">` and meta tags (`google-adsense-account`).
- Serves verified `/ads.txt` (`google.com, pub-8832384771899504, DIRECT, f08c47fec0942fa0`).
- **Explicit Policy Guardrails (`adService.ts`):**
  - Display ads appear **only** on editorial pages (`/`, `/how-to-play`, `/about`), **never** on `/play`, `/privacy`, `/terms`, `/contact`, or `404`.
  - Rewarded ads are strictly opt-in (`double_match`, `mission_reroll`, `bonus_chest`).
  - Interstitials (`interstitial`) only trigger between finished matches when clicking `Play Again` or `Main Menu`, gated by: ≥ 2 matches played, ≥ `120s` cooldown, max `8`/day, and never during active `PLAYING` phase.
- **Consent Propagation:** `ConsentBanner.tsx` and `SettingsModal.tsx` update `settings.adPersonalizationConsent` (`'unset' | 'personalized' | 'non_personalized'`), which sets `window.adsbygoogle.requestNonPersonalizedAds = 1` and configures `adConfig({ preloadAdBreaks: 'on' })`.

### Known Configuration Conflict: Hardcoded `ca-pub-8832384771899504` vs. `.env.example`
- `.env.example` instructs developers: *"Leave blank during development to use the built-in Development Ad Simulator."*
- **Conflict:** `index.html` hardcodes `ca-pub-8832384771899504` directly in `<head>`, `public/ads.txt` hardcodes `pub-8832384771899504`, and `server/adsenseCompliance.ts` sets `DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-8832384771899504'`, while `src/game/adService.ts` reads `import.meta.env.VITE_ADSENSE_CLIENT_ID`. If `VITE_ADSENSE_CLIENT_ID` is blank, `AdService` uses `DevAdSimulatorAdapter` in-game while `index.html` still loads the Google AdSense tag for `ca-pub-8832384771899504`.

---

## 4. SEO & Crawler Configuration
- `src/seo/routeMeta.ts` dynamically updates `<title>`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph, and Twitter tags on route transitions.
- `src/seo/staticPrerender.ts` bakes route-specific SEO HTML + JSON-LD structured data during `vite build`.
- `public/robots.txt` explicitly allows `Mediapartners-Google`, `Google-Display-Ads-Bot`, `Googlebot`, blocks `/api/`, and links `https://sonko-ug.vercel.app/sitemap.xml`.
