# Sonko — Game Modes

> **Source of Truth:** `src/game/types.ts`, `src/scene3d/sonko3DGameEngine.ts`, `src/components/QuickMatchModal.tsx`, `src/components/TourModal.tsx`, `src/components/OnlineLobbyModal.tsx`.

---

## 1. Implemented Play Modes (`PlayMode`)

| Mode ID | Display Name | Players & Teams | Rules & Win Condition | Status |
| --- | --- | --- | --- | --- |
| `VS_BOT` | **VS Bot** | `Player 1` (Team 0) vs `Amina (Bot)` (Team 1) | First player to clear Square `5` or `10` wins the match (`finalizeMatch`). Supports `EASY`, `NORMAL`, `HARD` AI accuracy & wind compensation. | `IMPLEMENTED` |
| `SOLO` | **Solo** | `You` (Team 0) alone | Practice/mastery run. Completing the final square grants a **Victory House** blind toss (`cyclesCompleted >= 1`), then finalizes match victory (`You Win!`). | `IMPLEMENTED` |
| `TWO_PLAYER` | **2P Local** | `Player 1` (Team 0) vs `Player 2` (Team 1) | Turn-based hot-seat pass-and-play on the same device. First to clear the final square wins. | `IMPLEMENTED` |
| `TEAM_2V2` | **2v2** | **Team Cranes** (`You` + AI `Kato`) vs **Team Waves** (AI `Amina` + AI `Mugisha`) | Alternating turns across all 4 slots (`0 → 1 → 2 → 3`). Teammates share `teamTarget` and `Houses`; first team to clear the final square wins. | `IMPLEMENTED` |
| `ONLINE_1V1` | **Online 1v1** | Live human Slot 0 vs Slot 1 over WebSocket (`/ws`) | Private 5-character room codes, shareable `?room=CODE` invite URLs, or public FIFO **Quick Match** queue. Authoritative server turn & landing physics. | `IMPLEMENTED` |

---

## 2. Mode & Match Configuration (`QuickMatchModal.tsx`)

Before starting an offline/local match (`SOLO`, `VS_BOT`, `TWO_PLAYER`, `TEAM_2V2`), players configure:
1. **Mode:** `VS Bot`, `Solo`, `2P Local`, `2v2`
2. **Court Grid (`CourtSize`):** `5` squares (**Quick 5**, 4 rows) or `10` squares (**Classic 10**, 8 rows)
3. **Bot Difficulty (`Difficulty`):** `EASY`, `NORMAL`, `HARD` (shown when AI bots are active in `VS_BOT` or `TEAM_2V2`)
4. **World / Setting (`WorldPlaceId`):**
   - `kampala_compound` (Kampala Compound)
   - `primary_schoolyard` (Primary Schoolyard)
   - `entebbe_lakeside` (Entebbe Lakeside)
   - `trading_centre` (Trading Centre)
   - `ndere_festival` (Ndere Night Yard)
5. **Time of Day (`PeriodPreset`):** `auto`, `morning`, `midday`, `golden`, `night`
6. **Weather (`WeatherMode`):** `auto`, `random`, `clear`, `breezy`, `misty_dew`, `light_rain`, `storm_shower`

*(Online 1v1 uses `OnlineLobbyModal.tsx`, which selects `CourtSize` (`5` or `10`) and `CourtVenueId` (`kampala_murram`, `entebbe_sand`, `jinja_rain`, `ndere_night`) rather than all 5 `WorldPlaceId`s.)*

---

## 3. Regional Tour Mode (`TourModal.tsx`)

Labeled in UI as **"Story · Uganda Courtyard Tour"** (header `"4-Stop Regional Circuit"`):
- **Status:** `IMPLEMENTED` as a **4-venue completion circuit**, NOT a narrative story campaign.
- **Circuit Stops (`VENUE_SPECS` in `src/game/progression.ts`):**
  1. `kampala_murram` — **Kampala Murram Compound** (`1.0x` Cowries, low line tolerance, calm)
  2. `entebbe_sand` — **Entebbe Lakeside Sand** (`1.2x` Cowries, active Lake Victoria crosswind, soft sand dampens bounce)
  3. `jinja_rain` — **Trading Centre** (`1.35x` Cowries, market square surface with storm/puddle weather tendency)
  4. `ndere_night` — **Ndere Lantern Courtyard** (`1.5x` Cowries, torchlit night visibility, forgiving chalk tolerance `0.019`)
- **Progression:** Winning a `VS_BOT` or `TEAM_2V2` match at a venue awards that venue's **Regional Stamp** (`Stamps X/4`). Collecting all 4 unlocks the **Pearl of Africa Champion** achievement (`tour_grand_slam`).

---

## 4. Planned Future Modes (`PLANNED — Not Implemented`)

The following modes belong to Sonko's long-term vision (`docs/vision/SONKO_LONG_TERM_VISION.md`) and do **not** exist in the current codebase:
- **Story Campaign Mode:** Scripted chapters, narrative arcs, and character progression.
- **Kisenda Mode:** Separate traditional Ugandan game ruleset.
- **Training / Practice Drills:** Isolated skill challenges (precision tosses, high-wind drills, balance endurance).
- **Competitive Brackets & Ranked Seasons:** Scheduled tournaments, school/parish cups, and ranked MMR matchmaking.
- **Live Spectate Mode:** Joining active rooms as an observer.
