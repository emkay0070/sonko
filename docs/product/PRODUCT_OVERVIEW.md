# Sonko — Product Overview

> **Scope:** Accurate record of Sonko as implemented today.

---

## 1. What Exists Today

**Sonko — Ugandan Courtyard Hopscotch** is a dual-surface web application served from a single React SPA and Express/Vite runtime:

1. **Editorial Cultural & Publisher Website (`/`, `/how-to-play`, `/about`, `/privacy`, `/terms`, `/contact`)**
   - Introduces Ugandan Sonko (*Ejjinja*) rules, courtyard heritage, world previews, legal/privacy transparency, and publisher support (`SiteLayout.tsx`, `HomePage.tsx`, `HowToPlayPage.tsx`, `AboutPage.tsx`, `PrivacyPage.tsx`, `TermsPage.tsx`, `ContactPage.tsx`).
   - Statically prerendered at build time via `src/seo/staticPrerender.ts` and `vite.config.ts` for search crawlers and Google AdSense verification.

2. **Full-Viewport 3D Game Hub (`/play`)**
   - Powered by `SonkoGameExperience.tsx`, `UgandanCompoundViewport.tsx`, and `sonko3DGameEngine.ts`.
   - Renders a live 3D Ugandan courtyard immediately behind the main menu, supporting 5 play modes, 5 selectable 3D worlds, dynamic weather and daylight presets, Cowries progression, Courtyard Stall & Avatar customization, 17 achievements, 7-day login streak chests, daily missions, global leaderboard, offline PWA support, and a gated 3D Creator Studio (`?studio=1`).

---

## 2. Primary Routes (`src/router.tsx` & `src/seo/routeMeta.ts`)

| Route | Component | Purpose |
| --- | --- | --- |
| `/` | `HomePage` | Editorial landing page, world showcase, rules preview, Play CTA (`→ /play`). |
| `/play` | `SonkoGameExperience` | Full-screen 3D WebGL Sonko game, modals, online lobby, and optional `?room=CODE` / `?studio=1` entry. |
| `/how-to-play` | `HowToPlayPage` | Complete illustrated guide: toss (*Ejjinja*), hops, balance, scoop, blind House (*Ekizimbe*), fouls, and controls. |
| `/about` | `AboutPage` | Cultural heritage, Kampala-to-Ndere tour overview, fair virtual economy statement. |
| `/privacy` | `PrivacyPage` | Local browser storage disclosure, Google AdSense / H5 consent options, online/leaderboard data handling. |
| `/terms` | `TermsPage` | Fair play, non-monetary Cowries rules, Creator Studio IP rules, ad availability terms. |
| `/contact` | `ContactPage` | Publisher contact form (`POST /api/contact` storing to `/data/contact-messages.json`) + `support@sonkogame.com`. |
| `*` | `NotFoundPage` | Client-side fallback route (`404`). |

---

## 3. Target Audience Today
- Players familiar with Ugandan/East African courtyard hopscotch seeking an authentic digital version.
- Casual browser and mobile PWA players looking for tactile physics, short matches, and local/online multiplayer.
- Friends and families playing together locally (`2P Local`, `2v2`) or across distances (`Online 1v1` invite rooms).
- Creators/developers using Creator Studio (`?studio=1`) to test custom `.glb`/`.usdz` characters, stones, props, and surface PBR textures.

---

## 4. Current Scope Boundaries
- **One playable traditional game:** Sonko courtyard hopscotch (**Ejjinja**). (**Kisenda** and other traditional games are not yet implemented.)
- **No user accounts or login:** Player identity relies on browser `localStorage` (`sonko_player_id_v1`, `sonko_player_name_v1`, `sonko_progression_v1`) and IndexedDB (`sonko_models_v1`).
- **Regional tour, not narrative campaign:** `TourModal.tsx` tracks completion stamps across 4 venues; a story-driven campaign does not yet exist.
