# Sonko — Origin and Identity

> **Status:** Updated with Founder Alignment Input  
> **Note on Repository & Privacy Scope:** No `.git` commit history exists in this workspace (only `docs/PHOTOREALISM_WORLD_REFERENCE.md` and application source/copy). This document incorporates direct alignment context supplied by the founder. **Sections covering private commercial goals and personal founder legacy are internal founder-facing documentation and are not intended as public marketing copy.** Unrecorded personal anecdotes or biographical dates are never invented.

---

## A. Sonko's Origin

### 1. Cultural & Personal Inspiration
Sonko draws directly from **Sonko** (Ugandan courtyard and schoolyard hopscotch) and is deeply inspired by **childhood memories**. Across Uganda's primary school compounds, red-earth (*murram*) verandas, lakeside beaches, and trading-centre alleyways, generations of children drew numbered chalk grids on packed earth, picked up a smooth river pebble (**Ejjinja**), and tested their aim, balance, rhythm, and daring to claim squares as their own **House (*Ekizimbe*)**.

Crucially, the founder's intention is **not simply to recreate a single game's rules**:
- It is an opportunity to revisit and **tell the stories of many Ugandans** through the games, friendships, rivalries, and shared experiences of childhood.
- It aims to revisit a living part of Ugandan life that many people experienced firsthand and make those memories vibrant and accessible to **new generations**.

This cultural root is embedded throughout the current codebase:
- In `src/pages/AboutPage.tsx`, `src/pages/HowToPlayPage.tsx`, and `src/pages/HomePage.tsx`, Sonko is framed as a living celebration of Ugandan primary school break-time energy and evening compound play.
- In `docs/PHOTOREALISM_WORLD_REFERENCE.md`, the visual philosophy rejects generic suburban tropes in favor of specific Ugandan architectural, soil, botanical, and social details: red-orange murram dirt, hand-drawn whitewashed chalk grids, corrugated iron roofs, cassava patches, jackfruit trees, wooden *duka* stalls, Lake Victoria fishing boats, and Ndere cultural centre lantern courtyards.

### 2. The Problem & Opportunity
Across the world—and across rapidly urbanizing East African cities—traditional outdoor childhood games face two simultaneous pressures:
1. **Cultural erosion & fading intergenerational transmission:** Outdoor street and schoolyard games—and the friendships, rivalries, and everyday stories woven around them—are rarely given the polish, depth, or permanence afforded to Western or East Asian sports and video games.
2. **Underrepresentation in interactive 3D worlds & commercial gaming:** African everyday spaces—schoolyards, dusty trading centres, village verandas, lakeshore coves—are seldom built as joyful, playable, photorealistic worlds or scaled into commercially viable gaming properties where players recognize their own environment, clothing (*Kitenge*, barkcloth), names (*Kato*, *Namukasa*, *Auma*, *Ssemakula*), and idioms.

Sonko addresses both the cultural opportunity and the market opportunity: preserving authentic courtyard play while building toward a major, enduring gaming property.

### 3. Original Idea & How It Evolved (Observed in Codebase)
Inspecting the repository reveals a clear technical and creative evolution:
1. **2D Courtyard Prototype (Legacy/Deprecated):** Early files `src/game/SonkoCanvas.tsx` and `src/game/courtyardRenderer.ts` implemented a 2D HTML5 Canvas version of Sonko hopscotch. Those files remain in the repository unused.
2. **Transition to 3D Ugandan Compound (`Three.js`):** The experience was rebuilt around a real-time Three.js 3D courtyard (`src/scene3d/ugandanCompoundScene.ts`, `sonko3DGameEngine.ts`), adding articulated character animation, facial emotions, lip-synced voice dialogue banks, weather/daylight dynamics, and PBR textures.
3. **Expansion from One Compound to Five Regional Environments:** The single Kampala courtyard grew into a five-world architecture (`kampala_compound`, `primary_schoolyard`, `entebbe_lakeside`, `trading_centre`, `ndere_festival`) supported by an in-app **Creator Studio & Asset Manager** for importing custom `.glb`/`.usdz` models, textures, and voice clips.
4. **Full Web Platform, Multiplayer & Offline PWA:** Around the core game, the project added a WebSocket 1v1 multiplayer server, global leaderboard, Cowries progression economy, Courtyard Stall, daily streaks and missions, editorial SEO pages, Google AdSense / H5 Games Ads readiness, and Workbox PWA offline installation.

### 4. Dual Core Motivation: Cultural Storytelling & Commercial Ambition
To represent Sonko accurately, **four distinct dimensions** of the founder's motivation must be kept separate rather than collapsed into a single label:

1. **Cultural Inspiration *(Core Mission)*:** Revisiting Ugandan childhood memories—the friendships, neighborhood rivalries, chalk-line arguments, and shared joy—and making those stories accessible to new generations in Uganda, across the diaspora, and globally.
2. **Commercial Ambition *(Internal Strategic Context — Not Public Marketing Copy)*:** Sonko is **not** intended solely as a non-commercial cultural preservation project. The founder holds an explicit financial and entrepreneurial ambition for Sonko to become a **commercially successful gaming property** capable of generating significant income and creating substantial entrepreneurial value. Cultural storytelling and commercial success are both central drivers of the project. *(No speculative financial targets or guarantees are assumed here.)*
3. **Long-Term Technological & Platform Ambition *(Aspiration — Not Existing Features)*:** Browser gaming is Sonko's deliberate starting foundation—not its final boundary. Long-term platform aspirations span **mobile gaming**, **console gaming**, **more ambitious immersive experiences**, and an eventual **open-world experience** rooted in Ugandan life (detailed in [`SONKO_LONG_TERM_VISION.md`](./SONKO_LONG_TERM_VISION.md)).
4. **Personal Founder Legacy *(Internal Founder-Facing Only)*:** On a deeply personal level, Sonko represents the founder's own entrepreneurial journey. Years from now, the founder wants to look back, remember the young person who struggled through the early stages of building something meaningful from limited beginnings, and see how far that perseverance, ambition, and growth eventually took him.

> **`[NOTE ON BIOGRAPHICAL DETAILS]`:** Specific personal childhood anecdotes, exact founding dates, and early team milestones remain unrecorded in the repository and are deliberately left uninvented unless the founder chooses to add them directly.

---

## B. What Sonko Actually Is

### 1. Clear Definition
**Sonko** is a browser-native 3D cultural sports game and emerging gaming property—currently centered on a complete single- and multiplayer adaptation of Ugandan courtyard hopscotch (**Ejjinja**)—founded to revisit Ugandan childhood stories and built to grow into a commercially sustainable, multi-game, multi-platform ecosystem.

### 2. Core Identity Pillars
- **Identity:** Authentic Ugandan childhood games, friendships, and rivalries transformed into tactile 3D skill-based play and a scalable gaming property.
- **Purpose:** Revisit and tell Ugandan childhood stories so new generations can experience them, while building a commercially successful, high-craft gaming brand from Uganda to the world.
- **Audience:**
  - Ugandan and East African youth, students, and adults who grew up with courtyard games.
  - Younger generations discovering traditional play through modern interactive worlds.
  - The global East African diaspora seeking connection to home, language, and shared childhood memories.
  - Casual and competitive gamers worldwide looking for fresh, physics-driven traditional sports beyond familiar Western templates.
- **Cultural Roots:** Ugandan schoolyard and compound traditions—*Ejjinja* (river stone), *Ekizimbe* (House), *Kitenge* and royal barkcloth attire, local place identities (Kampala, Entebbe, Jinja/Trading Centres, Ndere), and local character voices (*Kato*, *Namukasa*, *Auma*, *Ssemakula*).

### 3. Unique Value & Differentiators
Unlike conventional hyper-casual browser games or generic sports titles:
1. **Real Traditional Rules, Not Skin-Deep Reskins:** Sonko implements the actual tactical depth of Ugandan hopscotch—including opponent House blocks, shared 2v2 teamwork, crosswind drift, rainwater puddles that dampen bounce and disturb balance, and blind backward House claiming.
2. **Living Cultural Worlds:** Matches happen inside recognizable East African spaces shaped by time of day, Ugandan rain showers, Lake Victoria breezes, marimba/amadinda-inspired audio, and sideline friends who react, cheer, and laugh.
3. **Zero-Install Web & Offline Reach:** Plays immediately in desktop or mobile browsers, installs as an offline-capable PWA (critical for mobile and intermittent connectivity), and supports solo, local pass-and-play, 2v2, and live online 1v1.

---

## C. The Sonko Experience

What playing Sonko is meant to feel like—both today and as the platform matures:

1. **Childhood Memories Reawakened:** Every detail—chalk dust bursts on bare packed earth, a bouncing river stone, barefoot or sandal landings, the rhythm of *one-two-one-two* hops—is tuned to trigger instant recognition for anyone who played in a schoolyard or home compound.
2. **Traditional Games as Living Skill Sports:** Rather than passive nostalgia, Sonko rewards mastery: judging arc power under wind, holding single-foot balance as puddles slick the square, executing clean scoops, and placing high-value Houses that choke an opponent's path.
3. **Friendship & Social Banter:** Even in solo or bot play, the courtyard is never sterile. *Kato*, *Namukasa*, *Auma*, and *Ssemakula* stand courtside, react emotionally to wobbles and fouls, cheer streaks, and deliver warm neighborhood banter. Locally, two friends can share one screen (`2P Local`), or pair up in `2v2 Cranes vs Waves`.
4. **Rivalry & Competition:** Every clean toss builds streak multipliers; every House reshapes the board; online 1v1 rooms and the Global Top-10 Leaderboard turn neighborhood bragging rights into measurable rank.
5. **Community & Regional Identity:** Choosing between Kampala's murram compound, a bustling primary schoolyard, Entebbe's windy lakeside cove, a busy trading centre, or Ndere's lantern-lit cultural courtyard roots each match in real Ugandan geography.
6. **Discovery & Progression:** Players earn **Cowries** for skill, consistency (7-day login chests), and daily missions, spending them at the Courtyard Stall on carved river stones, Kitenge outfits, hair styles, and chalk House stencils.
7. **The Bridge Between Digital and Physical Play:** Digital play is not meant to replace the physical courtyard—it teaches the rules clearly (via `/how-to-play` and guided turn prompts), keeps terminology alive, and builds toward a future where digital rankings and community events reconnect with real schoolyards and physical tournaments.

---

## D. Product Origin Story vs. In-Game Story Mode

It is essential to keep **two completely separate concepts distinct**:

| Concept | Definition | Current Status in Repo |
| --- | --- | --- |
| **1. Sonko's Product Origin Story** *(Real World)* | Why the creator built Sonko, its cultural inspiration, and its evolution from 2D prototype to 3D Ugandan courtyard platform. | **Defined at cultural/product level** in this document; personal founder origin milestones remain **`[OPEN FOR FOUNDER INPUT]`**. |
| **2. In-Game "Story Mode"** *(Planned Game Mode)* | A playable narrative campaign inside the game with chapters, character arcs, dialogue progression, and story stakes. | **NOT YET ESTABLISHED.** What the UI currently labels *"Story · Uganda Courtyard Tour"* (`TourModal.tsx`) is a **4-stop regional venue checklist** (`kampala_murram` → `entebbe_sand` → `jinja_rain` → `ndere_night`) awarding regional stamps and Cowrie multipliers—**not** a scripted narrative campaign. |

### Faithful Record of Existing Narrative Elements
Today, the codebase contains:
- **Four named courtyard characters:** `Kato`, `Namukasa`, `Auma`, and `Ssemakula` (`src/scene3d/characters.ts`), plus AI match personas `Amina` and `Mugisha` (`src/scene3d/sonko3DGameEngine.ts`).
- **Event-triggered dialogue banks** (`/public/dialogues/{kato,namukasa,auma,ssemakula}.txt`) with categories `INTRO`, `AIM`, `THROW`, `GOOD_TOSS`, `BULLSEYE`, `WOBBLE`, `ANNOYED`, `HOUSE_CLAIM`, `LAUGH`, `CHEER`, and `WIN`.
- **No established plot, villain, chapter lore, or cutscenes.**

Accordingly, any future **Story Mode** narrative remains an **open creative direction** (see [`docs/world/STORY_AND_NARRATIVE.md`](../world/STORY_AND_NARRATIVE.md) and [`docs/planning/OPEN_DECISIONS.md`](../planning/OPEN_DECISIONS.md)) rather than inventing unapproved canonical lore.
