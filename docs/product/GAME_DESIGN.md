# Sonko — Game Design & Mechanics (Ejjinja)

> **Source of Truth:** `src/game/courtLayout.ts`, `src/scene3d/sonko3DGameEngine.ts`, `src/game/weather.ts`, `src/game/progression.ts`, `server.ts`.

---

## 1. Court Layouts (`src/game/courtLayout.ts`)

Sonko supports two chalk court grids normalized in `(nx, ny) ∈ [0, 1]` space (mapped onto 3D ground coordinates by `courtNormalizedToWorld`):

### Classic 10 (`courtSize = 10`, 8 rows from baseline `y ≈ 0.855` up to `y ≈ 0.085`)
1. **Row 0:** `1` (Single)
2. **Row 1:** `2` (Single)
3. **Row 2:** `3` (Left) + `4` (Right) — **Twin Straddle**
4. **Row 3:** `5` (Single)
5. **Row 4:** `6` (Left) + `7` (Right) — **Twin Straddle**
6. **Row 5:** `8` (Single)
7. **Row 6:** `9` (Left) + `10` (Right) — **Twin Straddle**
8. **Row 7 (`HOME`):** Semi-circular turnaround arc (`id: 99`, `isHome: true`) — **Rest / Turnaround**

### Quick 5 (`courtSize = 5`, 4 rows from `y ≈ 0.84` up to `y ≈ 0.14`)
1. **Row 0:** `1` (Single)
2. **Row 1:** `2` (Left) + `3` (Right) — **Twin Straddle**
3. **Row 2:** `4` (Single)
4. **Row 3:** `5` (Single)
*(No semicircular `HOME` tile in Quick 5; turnaround occurs at the top of the course.)*

---

## 2. Turn Phase State Machine (`TurnPhase`)

Each active turn progresses strictly through these states in `sonko3DGameEngine.ts`:

```text
TOSS_AIM ──▶ STONE_FLIGHT ──(CLEAN/BULLSEYE)──▶ HOP_OUT ──▶ TURN_HOME ──▶ HOP_BACK
                │                                  │                         │
          (MISS/LINE_FOUL)                   (FOUL/BALANCE=0)          (PICKUP_STONE)
                ▼                                  ▼                         ▼
          FOUL_RECOVERY ◀──────────────────────────┘                     HOP_EXIT
                │                                                            │
                ▼                                                            ▼
          PLAYER_SWITCH ◀──── (Optional CLAIM_AIM ─▶ CLAIM_FLIGHT) ◀── ROUND_CLEAR
```

1. **`TOSS_AIM`:** Player stands at baseline `(0.5, 0.945)` aiming horizontally (`aimAngleOffset ∈ [-0.42, 0.42]`) and charging power (`aimPower` oscillates between `0.06` and `1.0` at `0.72/sec`).
2. **`STONE_FLIGHT`:** Parabolic 3D stone trajectory (`flightTime = 0.56s`, `gravity = 2.6`) affected by crosswind (`windX * dt * 1.45` before first bounce). On 1st ground bounce:
   - **Puddle hit:** Splash + heavy damping (`vz = 0.2`, `vx *= 0.34`, `vy *= 0.38`).
   - **Entebbe sand (`entebbe_sand`):** Soft damping (`vz = 0.16`, `vx *= 0.08`, `vy *= 0.08`).
   - **Packed murram / stone / courtyard:** Crisp bounce (`vz = 0.34`, `vx *= 0.22`, `vy *= 0.22`).
   - On 2nd touch (`stoneBounces >= 2`), stone stops and landing is evaluated.
3. **Landing Evaluation (`evaluateStoneLanding`):**
   - Line tolerance: `0.019` at `ndere_night`, `0.016` at all other venues.
   - **`BULLSEYE`:** Inside target square and within `0.38` normalized distance from center (`+60` pts, `perfectTosses += 1`).
   - **`CLEAN`:** Inside target square respecting inner margin (`+25` pts).
   - **`LINE_FOUL`:** Within square bounds + tolerance, but on or too close to chalk border → `FOUL_RECOVERY`.
   - **`OUT` / wrong square:** → `FOUL_RECOVERY`.
4. **`HOP_OUT` (`buildHopSequence`):** Player hops forward row-by-row:
   - **Rule:** You MUST **skip the square containing your stone** (`stonePlacedSquareId`) and **never step in an opponent's House**.
   - **Your own / team's House (`HOUSE_REST`):** Allows comfortable `TWO_FEET` rest (restores balance to `100`).
   - **Twin row with one blocked square:** Hop onto the remaining single square on **`ONE_FOOT`**.
   - **Unblocked twin row:** Straddle both squares on **`TWO_FEET`**.
   - Each completed hop awards `+15` pts and restores `+14` balance (or sets `100` on `TWO_FEET`).
5. **`TURN_HOME`:** `0.34s` 180° pivot at the top of the court before hopping back.
6. **`HOP_BACK` → `PICKUP_STONE`:** Hopping back row-by-row stops right before the stone's row (`triggersPickupAfterLand`). Pressing `E` / `Enter` / `Space` / Clicking scoops the stone (`+40` pts, `+18` balance), then resumes `HOP_BACK` (skipping the stone square—though note: once picked up, remaining return rows lead to `HOP_EXIT` and final leap to baseline).
7. **`HOP_EXIT` → `ROUND_CLEAR`:** Final jump to baseline `(0.5, 0.945)`.
   - Clears target square: `roundsCleared += 1`, `streak += 1`, awards `100 + streak * 25` pts.
   - Completing final square (`5` or `10`): `+250` pts; wins competitive modes or unlocks Solo final Victory House throw.
8. **`CLAIM_AIM` → `CLAIM_FLIGHT` (House / *Ekizimbe*):**
   - Triggered in offline/local play at **mid-court** (clearing Square `5` in Classic 10 or Square `3` in Quick 5 when team owns `0` Houses) or upon completing Solo cycle; in **Online 1v1**, triggered server-side when clearing Square `5`/`3` or finishing Square `10`/`5` (or qualifying round milestones).
   - Player turns away from court (`facingYaw = 0`) and tosses **blind over the shoulder** (`aimAngleOffset` auto-sways `sin(t * 2.1) * 0.24`).
   - If the stone settles cleanly inside an unclaimed, non-`HOME` square (`evaluateClaimLanding`): square becomes team's **House (`Ekizimbe`)**, awarding `+180` pts!

---

## 3. Single-Foot Balance & Foul Rules

### Single-Foot Balance (`balance ∈ [0, 100]`)
- Active whenever standing still on **`LEFT_FOOT`** or **`RIGHT_FOOT`** during `HOP_OUT`, `HOP_BACK`, `PICKUP_STONE`, or `HOP_EXIT`.
- **Random sway + Wind + Puddle instability:**
  - `roundDifficulty = (0.28 + (targetSquare / courtSize) * 0.34) * (inPuddle ? 1.32 : 1)`
  - Crosswind adds `windX * 1.1 * dt` sway.
  - Player counters sway with **`A` / `D`** or **`Left` / `Right`** arrows (`±1.65 * dt`) or mobile left/right lean buttons (`±0.24`).
  - If `|balanceSway| > 0.65`, balance drains at `|balanceSway| * 32 * dt`; otherwise recovers at `+10 * dt`. Reaching `0` causes `"Lost balance on one foot!"`.

### Foul Triggers (`FOUL_RECOVERY`)
- Stone misses target square or touches chalk line (`LINE_FOUL`).
- Clicking/stepping onto the stone square (`stonePlacedSquareId`).
- Clicking/stepping into a rival team's House (`houses[sq] !== activeTeam`).
- Balance hitting `0` on one foot.
- Penalty: `fouls += 1`, `streak = 0`, turn passes to next player/team.

---

## 4. Controls (`SettingsModal.tsx` & `SonkoGameExperience.tsx`)

| Action | Desktop Controls | Mobile / Touch Controls |
| --- | --- | --- |
| **Aim** | Move pointer horizontally over court, or `A` / `D` / `←` / `→` | Touch drag / aim |
| **Charge & Toss** | Hold Left-Click, `Space`, or `Enter` (`>= 110ms`), release | Touch Hold & Release |
| **Hop** | Click target square, `Space`, `W` / `↑` (out), `S` / `↓` (back) | Tap **HOP** button or tap tile |
| **Balance Lean** | Hold `A` / `←` or `D` / `→` | Tap **◀ Lean** / **Lean ▶** buttons |
| **Scoop Stone** | `E`, `Enter`, `Space`, or Click stone | Tap **SCOOP** button |
| **Pause / Camera** | `Esc` (Pause/Resume), `C` (Cycle camera), `H` (Toggle View Bar) | On-screen HUD buttons |

---

## 5. Weather & Wind Gameplay Effects (`src/game/weather.ts`)

| Weather Condition | Wind Strength | Rain / Fog | Puddles (`puddleSquares`) |
| --- | --- | --- | --- |
| `clear` | `0.05` (calm) | None | `0` |
| `breezy` | `0.55` (moderate crosswind) | None | `0` |
| `misty_dew` | `0.14` | Morning mist | `1` |
| `light_rain` | `0.42` | Light rain (`0.38`) | `2` |
| `storm_shower` | `0.78` (strong gust drift) | Heavy rain (`0.88`) + thunder | `3` |

---

## 6. Match Cowries Formula (`computeMatchRewards` in `src/game/progression.ts`)

- `roundsCowries = roundsCleared × 12`
- `bullseyeCowries = perfectTosses × 15`
- `housesCowries = housesOwned.length × 20`
- `winBonusCowries = won ? (mode === 'ONLINE_1V1' ? 85 : mode === 'TEAM_2V2' ? 60 : difficulty === 'HARD' ? 75 : difficulty === 'NORMAL' ? 50 : 35) : 12`
- `totalEarned = Math.max(10, Math.round(raw × venueMultiplier))`
  - Venue multipliers: Kampala `1.0x`, Entebbe `1.2x`, Jinja/Trading Centre `1.35x`, Ndere `1.5x`.
