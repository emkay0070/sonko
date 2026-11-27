# Sonko — Long-Term Vision

> **Status:** Strategic Vision Blueprint (Updated with Founder Alignment Input)  
> **Ground-Truth Discipline:** This document intentionally looks beyond today's browser game toward Sonko's full multi-year ambition. Throughout every section, **Current Reality** (what exists in code today), **Strategic Direction** (intended platform evolution), and **Speculative Proposals / Aspirations** (not committed release milestones or guarantees) are explicitly separated.

---

## Executive Horizon

Sonko starts with **one beloved Ugandan courtyard game**—hopscotch with a river stone (**Ejjinja**)—executed in rich, browser-native 3D.

The long-term ambition has two inseparable pillars:
1. **Cultural & Experiential Depth:** Grow Sonko into East Africa's premier interactive cultural play, storytelling, social, and competitive ecosystem—a place that revisits Ugandan childhood friendships, rivalries, and shared memories so new generations can live them across traditional games and increasingly expansive worlds (culminating long-term in an **open-world experience**).
2. **Commercial & Entrepreneurial Value:** Build Sonko into a **commercially successful gaming property** capable of generating significant income, creating substantial entrepreneurial value, fueling real-world tournaments, and proving what can be built from limited beginnings.

---

## 1. Traditional Games Ecosystem

### A. Ejjinja (Sonko Courtyard Hopscotch) — *Foundation*
- **Current Reality (`IMPLEMENTED`):** Full 3D adaptation of Ugandan hopscotch with 5-square (`Quick 5`) and 10-square (`Classic 10`) courts, stone aiming/tossing, wind drift, rain puddles, single-foot balance, stone scooping, blind over-the-shoulder House (*Ekizimbe*) claiming, 4 regional venue profiles, 5 3D settings, AI bots (`Easy`, `Normal`, `Hard`), local `2P`, `2v2 Cranes vs Waves`, and WebSocket `Online 1v1`.
- **Long-Term Direction:** Refine physics feel, add trick-shot/accuracy challenges, tournament rulesets (best-of-3 sets, timed clocks, ranked matchmaking), and seasonal court variations while keeping Ejjinja the flagship anchor sport.

### B. Kisenda — *Proposed Second Flagship Game*
- **Current Reality (`PLANNED — Not in Repo`):** Mentioned in founder direction as a planned traditional Ugandan game. Zero `Kisenda` code, rules, or assets currently exist in the repository.
- **Strategic Direction:** Introduce **Kisenda** as a distinct playable traditional game inside the same Ugandan courtyard/world ecosystem, sharing player identity, Cowrie progression, cosmetics, and social spaces while showcasing unique traditional mechanics.
- **`[OPEN FOR FOUNDER INPUT]`:** Establish canonical regional ruleset for Kisenda (board/ground layout, turn structure, winning conditions, regional variants across Uganda, and control mapping for mouse/touch/keyboard).

### C. Broader Ugandan & East African Traditional Games
- **Current Reality (`PLANNED`):** Not yet represented in code.
- **Strategic Direction:** Over time, Sonko can become an anthology platform for authentic traditional childhood and community games—such as *Omweso* (strategic board play), *Duulu* / marbles, *Kwepena* (dodgeball), *Kati*, rope-skipping rhythm games, or bottle-top (*kabalagala* / *ekifuba*) flick games—curated in consultation with elders, teachers, and local players so every addition preserves real rules rather than generic mini-games.

### D. Diverse Play Modes: Arcade, Practice, & Missions
- **Current Reality:**
  - `IMPLEMENTED`: Practice/Solo runs, rotating Daily Missions (7 mission templates), 17 progression badges.
  - `PLANNED`: Dedicated **Practice / Training Drills** (e.g., wind-compensation tossing, balance endurance, House-claim precision), **Arcade Time-Attack / Endless Streaks**, and multi-game **Daily Quests**.

---

## 2. Social World

### Current Reality Today
- `IMPLEMENTED`: Expressive 4-character courtside presence (`Kato`, `Namukasa`, `Auma`, `Ssemakula`), lip-synced voice banter, local 2P & 2v2 team play, shareable private Online 1v1 room links (`?room=CODE`), Quick Match public queue, Avatar Customizer (hair, Kitenge primary/accent colors), Courtyard Stall cosmetics, and an anonymous-ID Global Top-10 Leaderboard.
- **Missing Today:** Persistent user accounts/profiles, friends lists, chat/emotes, persistent social lobbies, player-owned compounds, and live spectating.

### Long-Term Social Vision (`PLANNED`)
1. **Persistent Player Identities:** Verified handles, customizable 3D avatars, regional/home-court badges, career statistics, and collectible outfits/stones that carry across every traditional game in Sonko.
2. **Friendships & Communities:** Friend codes/lists, squad invites, private compound hangouts, and community clubs grouped by school, alumni group, neighborhood, or diaspora chapter.
3. **Interactive Social Spaces:** Transforming 3D worlds (like the Primary Schoolyard or Trading Centre) from match-only backdrops into shared social plazas where players can meet, warm up, watch nearby courts, and customize shared spaces.
4. **Virtual Assets & Creator Ecosystem:** Expanding the existing developer-gated **Creator Studio & Asset Manager** (`?studio=1`) into a curated community creation pipeline where Ugandan 3D artists, musicians, and voice actors can submit authentic props, regional courts, Kitenge patterns, and local language voice packs.
5. **Live Spectating & Shared Moments:** Spectators sitting courtside (extending the existing sideline character model), live tournament viewing rooms, replay sharing, and reaction emotes during tense House-claim throws.

---

## 3. Competitive Ecosystem

### Current Reality Today
- `IMPLEMENTED`:
  - `Quick Match` modal (offline local/bot setup across 5 worlds and weather/daylight modes).
  - `Online 1v1` private 5-character rooms + FIFO public Quick Match queue + rematch voting.
  - `Uganda Tour` (`TourModal.tsx` — 4-venue regional completion checklist).
  - `Global Leaderboard` (single global score board storing top 200 players in `/data/leaderboard.json`).

### Long-Term Competitive Ladder (`PLANNED`)
A multi-tiered structure mirroring how real sports grow in Uganda—from schoolyard bragging rights to national recognition:

1. **Tier 1 — Casual & Quick Matches:** Instant skill-matched 1v1 and 2v2 queues across all traditional games, with optional daily ranked windows.
2. **Tier 2 — Direct Challenges & Neighborhood Rivalry:** Head-to-head asynchronous or live challenge links, rematch series, and friend ladders.
3. **Tier 3 — Structured Online Tournaments:** Weekend brackets, seasonal cups (e.g., *Rainy Season Cup*, *Ndere Festival Open*), and knockout/Swiss formats with authoritative server anti-cheat validation.
4. **Tier 4 — Schools & Community Competitions:** Verified school teams, inter-house competitions, and university/community leagues—building naturally on Sonko's existing Primary Schoolyard aesthetic and 2v2 *Cranes vs Waves* team foundation.
5. **Tier 5 — Parish, District & Regional Representation:** Players pledging allegiance to a Ugandan parish, town, or district (Kampala, Wakiso/Entebbe, Jinja, Gulu, Mbarara, Mbale, etc.)—turning individual match wins into collective regional pride and district leaderboards.
6. **Tier 6 — National Championships & Ranked Progression:** Seasonal divisions, verified national champions, title belts/stencils, and Hall of Fame archives.

---

## 4. Real-World Impact

One of Sonko's most distinctive ambitions is closing the loop between **digital gameplay** and **physical Ugandan life**.

### Clearly Established vs. Proposed Possibilities
- **Established in Current Product:** Digital preservation of Ejjinja rules and terminology (`/how-to-play`), faithful architectural/environmental representation (`PHOTOREALISM_WORLD_REFERENCE.md`), and low-barrier free access (browser + offline PWA).
- **Proposed Long-Term Impact Pathways (`PLANNED / SPECULATIVE`):**
  1. **Real-World Traditional Sports Competitions:** Hosting live physical Sonko and Kisenda community tournaments in Kampala, Entebbe, Jinja, and regional hubs—where digital qualifiers or promotional brackets connect directly to real chalk courts on murram ground.
  2. **Schools & Educational Institutions:** Partnering with primary and secondary schools to pair physical break-time heritage sports clubs with digital practice/rule guides, celebrating Ugandan cultural heritage alongside standard school athletics.
  3. **Local Communities & Youth Activation:** Community courtyard pop-ups, neighborhood events at cultural venues (e.g., cultural centres, parks, trading centres), and youth mentorship around both traditional sports and 3D game creation/digital arts.
  4. **Sponsors, Partners & Live Broadcasts:** Co-branded community cups with Ugandan telecoms, beverage/consumer brands, or cultural institutions, featuring livestreamed finals, local commentary, and hybrid online-plus-courtyard festivals.
  5. **Cultural Preservation & Revival:** Building a documented, playable digital archive of East African traditional games—capturing regional rule variations, Luganda/Luo/Runyankole/Lusoga/Ateso courtyard calls, and oral history before they fade.

---

## 5. Technological & Platform Ambition (`ASPIRATION — Not Committed Milestones`)

**Current Reality (`IMPLEMENTED`):** Sonko exists **solely as a browser-based React + Three.js WebGL web application and Workbox offline PWA**. Mobile wrappers, console builds, and open-world streaming systems do **not** exist in code today.

Over the long term, the founder envisions Sonko expanding well beyond its initial browser implementation:

1. **Browser Gaming *(Initial Foundation — `IMPLEMENTED`)***
   - Zero-install desktop and mobile browser access + offline PWA play, establishing gameplay feel, multiplayer, community traction, and initial monetization.
2. **Mobile Gaming *(Long-Term Platform Direction — `PLANNED`)***
   - Dedicated native or packaged mobile experiences tailored for touch-first play, push-based friend challenges, and high-growth East African and global mobile markets.
3. **Console Gaming *(Long-Term Platform Direction — `PLANNED`)***
   - Living-room and controller-native adaptations bringing local couch competition (`2P`, `2v2`) and seasonal Ugandan sports championships onto major console ecosystems.
4. **More Ambitious Immersive Experiences *(Long-Term Creative Aspiration)***
   - Richer physics, full-character storytelling, lifelike courtyard crowds, expressive audio-visual immersion, and deeper environmental interactivity.
5. **Open-World Experience *(Flagship Long-Term Creative Aspiration)***
   - Evolving from discrete match-arena scenes into a seamless, explorable **open-world Ugandan neighborhood/region**—where players walk or ride between compounds, primary schoolyards, bustling trading centres, and lakeside shores, encountering friends, rivalries, side stories, *Ejjinja*, *Kisenda*, and emergent childhood adventures in one continuous living world.

> **Reality Guardrail:** Mobile, console, advanced immersive editions, and open-world architecture are **long-term creative and strategic aspirations**, not current capabilities or committed release dates. Each step depends on validating gameplay, technical scalability, and commercial traction in earlier phases.

---

## 6. Commercial Ambition, Sustainability & Growth

> *Full exploration appears in [`docs/business/BUSINESS_AND_SUSTAINABILITY.md`](../business/BUSINESS_AND_SUSTAINABILITY.md).*

- **Current Established Baseline (`IMPLEMENTED`):** Free-to-play web & PWA model supported by Google AdSense / H5 Games Ads (with explicit consent controls and non-monetary Cowries progression). No paid store or real-money transactions exist today.
- **Founder Commercial Ambition *(Internal Strategic Direction)*:** Sonko is intentionally designed to become a **commercially successful gaming property** capable of generating significant income and creating substantial entrepreneurial value—never purely a non-commercial preservation project.
- **Proposed Future Revenue & Growth Pillars (`SPECULATIVE — Not Committed Business Decisions`):**
  - Branded tournament & venue sponsorships (telecoms, youth/sports brands, cultural venues).
  - Curated, purely cosmetic or multi-platform commercial models (e.g., mobile/console releases, optional cosmetic passes—preserving skill-fair competition with zero pay-to-win).
  - Creator revenue sharing for Ugandan 3D artists, textile (*Kitenge*) designers, and voice talent.
  - Geographic expansion: Kampala & Uganda core → East African Community (Kenya, Tanzania, Rwanda) → African diaspora & global gaming audiences.

---

## 7. Phased Evolution Summary *(Subject to Validation — No Fixed Release Dates)*

| Horizon | Focus | Key Milestones |
| --- | --- | --- |
| **Now (Current Baseline)** | Browser Foundation & Trust | Align copy/world naming conflicts, stabilize browser/PWA performance & `/ws` multiplayer, lock visual/gameplay quality of Ejjinja across all 5 worlds. |
| **Near-Term** | Depth, Retention & Backend | Real database + accounts, dedicated Practice/Tutorial mode, expanded Daily Missions, ranked 1v1 validation, and true Story Mode creative kickoff. |
| **Mid-Term** | Multi-Game, Social & Mobile | Launch **Kisenda** alongside **Ejjinja**, add Friends/Challenges, Spectator mode, structured online Brackets / School Cups, and explore mobile expansion. |
| **Long-Term** | Multi-Platform, Real-World & Open World | District/Parish leagues, additional traditional East African games, live hybrid digital-physical tournaments, console/immersive editions, and the long-term **open-world Ugandan childhood experience**. |

---

## Key Questions for Founder Alignment

1. Which comes first after stabilizing Ejjinja: **authentic Story Mode** or **Kisenda (second traditional game)**?
2. Should **accounts and persistent databases** precede tournaments and friends lists?
3. What level of **physical-world tournament/school partnership** is planned in early growth versus pure online/mobile expansion?
4. Which regional languages beyond English and current Luganda/mixed banter terms should be prioritized in future voice packs and Story Mode?
5. What commercial milestones should govern moving from **browser foundation** toward **mobile**, **console**, and eventually **open-world** development?
