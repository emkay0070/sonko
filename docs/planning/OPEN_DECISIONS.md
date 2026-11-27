# Sonko — Open Decisions Register

> **Purpose:** Captures every unresolved product, creative, cultural, and technical decision uncovered during the repository audit so the founder can lock direction before future engineering begins.

---

## 1. Identity, Story & Cultural Scope
1. **Personal Origin Details (`SONKO_ORIGIN_AND_IDENTITY.md`):**
   - What personal founder story, founding date/place, and early development milestones should be recorded as Sonko's canonical origin?
2. **True Story Mode Creative Direction (`STORY_AND_NARRATIVE.md`):**
   - What is the narrative plot, protagonist focus, tone, and chapter structure for the planned **Story Mode**?
   - Should the existing 4-stop venue circuit (`TourModal.tsx`) be renamed **"Uganda Tour"** so *"Story Mode"* is reserved for a genuine narrative campaign?
3. **Character Roster Consistency:**
   - Should AI bot/2v2 opponents (`Amina`, `Mugisha` in `sonko3DGameEngine.ts`) be unified with the 4 rigged/voiced character identities (`Kato`, `Namukasa`, `Ssemakula`, `Auma`), or should `Amina` and `Mugisha` get distinct character models and `.txt` dialogue banks?

---

## 2. Traditional Games & Worlds
4. **Kisenda Canonical Ruleset (`SONKO_LONG_TERM_VISION.md`):**
   - Which regional Ugandan version of **Kisenda** should be canonical, what are its exact win/foul rules, and how should it sit alongside **Ejjinja** inside `/play` (mode switcher vs. multi-game hub)?
5. **World Naming & Copy Alignment (`Trading Centre` vs. `Jinja Rain Garden`):**
   - Confirm whether **`Trading Centre`** (`trading_centre`) permanently replaces *"Jinja Rain Garden"* across `HomePage`, `AboutPage`, `index.html`, `adsenseCompliance.ts`, and `CourtVenueId` (`jinja_rain`), OR whether a separate 6th Jinja Rain Garden scene will be built later.
6. **Online Lobby World Selection:**
   - Should `OnlineLobbyModal` allow selecting `Primary Schoolyard` (currently only accessible via `QuickMatchModal` offline) alongside the other 4 worlds?

---

## 3. Technical, Infrastructure & Cleanup
7. **Canonical Hosting Architecture (`server.ts` vs. `vercel.json`):**
   - Will production run on a persistent Node.js host (`server.ts` supporting `/ws` + APIs), OR split a static frontend (`vercel.json`) from a dedicated WebSocket/API backend?
8. **Database & Accounts Timing:**
   - When should flat-file `/data/*.json` and anonymous `localStorage` IDs migrate to a real database + user authentication (required before persistent Friends, Tournaments, and District Leagues)?
9. **AdSense Configuration Conflict:**
   - Should `ca-pub-8832384771899504` remain baked into `index.html` / `ads.txt` / `adsenseCompliance.ts` or be strictly env-driven (`VITE_ADSENSE_CLIENT_ID`) so local/staging builds cleanly default to the Dev Ad Simulator?
10. **Unused `@google/genai` / `GEMINI_API_KEY` Stub:**
    - Was Gemini intended for a planned feature (e.g., AI coaching, dynamic voice banter, or Story Mode), or should the unused dependency/env stub be removed?
11. **Legacy Code & Asset Cleanup Approval:**
    - Approve archiving/removing `SonkoCanvas.tsx`, `courtyardRenderer.ts`, inert `arrivalPlaying` hooks, `pineForestEnvironment.ts`, and unused `/public/assets/` files (`Trailer_Park.usdz`, `gislinge_viking_boat.glb`, `honda_odyssey...glb`, etc.) in a dedicated cleanup pass.

---

## 4. Long-Term Vision & Business
12. **Priority Order Between Major Milestones:**
    - After stabilizing Ejjinja, what is the exact priority order among: (a) Accounts & Database, (b) True Story Mode, (c) Kisenda, (d) Online Tournaments / School Leagues?
13. **Physical-World & Commercial Strategy:**
    - Which partnership path is preferred first (school heritage programs, telecom/brand tournament cups, or purely organic online community growth), and should Sonko remain 100% ad-funded or later explore optional cosmetic/supporter monetization?
