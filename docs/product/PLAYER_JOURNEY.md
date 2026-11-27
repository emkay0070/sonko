# Sonko — Player Journey & Progression

> **Source of Truth:** `src/game/progression.ts`, `src/game/dailyStreak.ts`, `src/game/dailyMission.ts`, `src/game/achievements.ts`, `src/game/leaderboard.ts`, and modals in `src/components/`.

---

## 1. End-to-End Player Loop

```text
Landing / Discovery (/ or /how-to-play)
   │
   ▼
Enter Courtyard (/play) ──▶ Live 3D Title Menu (Daily Mission + Streak Badge + Consent)
   │
   ├─▶ Quick Match / Uganda Tour / Online 1v1
   │
   ▼
Active 3D Match ──▶ Toss, Hop, Balance, Scoop, Blind House Claim
   │
   ▼
Game Over Summary ──▶ Cowries + 2× Ad Bonus Option + Mission/Badges + Leaderboard Sync
   │
   ▼
Courtyard Stall & Avatar Customizer ──▶ Unlock & Equip Stones, Outfits, Hair, Stencils
```

---

## 2. Starting State (`INITIAL_PROGRESSION`)
- **Cowries:** `60`
- **Starter Gear:** `river_pebble` (River Pebble), `kampala_school` (Kampala School Kit), `basket_weave` (Basket Weave Stencil)
- **Avatar Defaults:** Hair `braids`, Primary `#15803D`, Accent `#FBBF24`
- **Persistence Key:** `localStorage['sonko_progression_v1']`

---

## 3. Daily Streak & Treasure Chest (`src/game/dailyStreak.ts`, `DailyStreakModal.tsx`, `DailyTreasureChest.tsx`)

- **Trigger:** Automatically checked on `/play` load (`claimDailyLoginStreak`); awards once per local calendar day (`YYYY-MM-DD`).
- **7-Day Ladder:**
  - Day 1: `+25` Cowries
  - Day 2: `+35` Cowries
  - Day 3: `+50` Cowries
  - Day 4: `+65` Cowries
  - Day 5: `+85` Cowries
  - Day 6: `+110` Cowries
  - Day 7: `+150` Cowries **+ `100` Week Bonus** (`250` total on Day 7)
- **Missed Day Behavior:** If `dayDiff > 1`, streak resets to Day 1 (`wasReset = true`), keeping `longestStreak`.
- **Interactive Chest UI:** `DailyTreasureChest.tsx` provides an animated brass-latched chest with cowrie burst particles and count-up reveal.
- **Optional Rewarded Bonus Chest:** Inside `DailyStreakModal`, players can watch an optional sponsor/rewarded ad (`bonus_chest`, 1 per day via `/api/monetization/claim-reward`) for `+60` to `+140` extra Cowries.

---

## 4. Daily Courtyard Missions (`src/game/dailyMission.ts`, `DailyMissionCard.tsx`)

Deterministic daily mission seeded by calendar date across **7 mission templates**:

| Metric | Target Range | Cowrie Reward |
| --- | --- | --- |
| `ROUNDS` | Clear `5` or `7` rounds today | `45` or `60` |
| `BULLSEYES` | Land `2` or `3` bullseyes today | `55` or `70` |
| `HOUSES` | Claim `2` Houses (*Ekizimbe*) today | `65` |
| `WINS` | Win `1` or `2` matches today | `50` or `75` |

- **Rewarded Reroll (`mission_reroll`):** Up to `2` times per day, players can watch a rewarded ad to cycle to an uncompleted alternative mission template via `/api/monetization/claim-reward`.

---

## 5. Achievements (`src/game/achievements.ts`, `AchievementsModal.tsx`)

**17 total achievements** across 3 categories, rewarding both skill milestones and collection completion:

| Category | Count | Examples & Thresholds |
| --- | --- | --- |
| **COURTYARD** | 9 | *First Chalk Mark* (`rounds >= 1`, +25), *Smooth Hopper* (`rounds >= 25`, +80), *Bullseye Aim* (`bullseyes >= 1`, +35), *Master Tosser* (`bullseyes >= 15`, +110), *Property Owner* (`houses >= 1`, +40), *Courtyard Landlord* (`houses >= 10`, +120), *Steady Nerve* (`bestStreak >= 5`, +75), *Weekend Champion* (`wins >= 1`, +45), *Legend of the Yard* (`wins >= 20`, +160) |
| **TOUR** | 6 | 4 individual venue victories (*Kampala*, *Entebbe*, *Jinja*, *Ndere*, +50 to +70 each), *Pearl of Africa Champion* (all 4 venues, +200), *Cranes & Waves* (`2v2` win, +90) |
| **COLLECTION** | 2 | *Courtyard Fashionista* (3 outfits unlocked, +85), *Stone Collector* (all 5 stones unlocked, +130) |

Unlocking triggers `AchievementToast.tsx` notifications and credits Cowries immediately.

---

## 6. Courtyard Stall & Avatar Customizer (`CourtyardStallModal.tsx`, `CharacterCustomizerModal.tsx`)

### Courtyard Stall Catalogs (`src/game/progression.ts`)
- **River Stones (`5`):** River Pebble (0), Lake Cowrie Shell (75), Kisoro Soapstone (130), Terracotta Ember (190), Sunburst Sandstone (260).
- **Kitenge Outfits (`5`):** Kampala School Kit (0), Entebbe Sun Kitenge (80), Jinja River Indigo (140), Buganda Barkcloth (210), Ndere Royal Regalia (320).
- **House Stencils (`4`):** Basket Weave (0), Kampala Sunburst (70), Royal Drums (120), Crested Crane Crown (180).

### Avatar Customizer (`AvatarCustomization`)
- **Hair Styles (`4`):** `braids`, `afro`, `bun`, `fade`.
- **Colors:** 8 curated Primary tunic swatches + native HTML `<input type="color">` picker; 8 curated Accent headband/sash swatches + custom color picker; plus one-click *"Match [Equipped Outfit]"*.

---

## 7. Global Leaderboard (`src/game/leaderboard.ts`, `GlobalLeaderboard.tsx`)

- **Automatic Sync:** Finishing any match with `score > 0` automatically submits the player's score to `POST /api/leaderboard` alongside their `localStorage` anonymous `playerId` (`sonko_player_id_v1`) and display nickname (`sonko_player_name_v1`, max 24 chars).
- **Display:** Top 10 global entries shown on the main menu sidebar (`Top 10 Global Scores`), showing rank medal, player name, venue, mode tag, wins, bullseyes, and personal rank (`You #N · X pts`). Server retains top `200` players sorted by `bestScore` descending.
