# Sonko — World & Environment Design

> **Visual Reference Bible:** See [`docs/PHOTOREALISM_WORLD_REFERENCE.md`](../PHOTOREALISM_WORLD_REFERENCE.md) for the authoritative technical-art specification (camera composition, PBR materials, asset discipline, and Ugandan architectural proportions).  
> **Source of Truth:** `src/game/progression.ts`, `src/scene3d/worldEnvironments.ts`, `src/scene3d/ugandanCompoundScene.ts`, `src/scene3d/primarySchoolyardScene.ts`, `src/scene3d/entebbeLakesideScene.ts`, `src/scene3d/terrain.ts`.

---

## 1. Dual Architecture: 5 3D Worlds vs. 4 Gameplay Venues

Sonko currently separates **3D visual settings (`WorldPlaceId`)** from **gameplay physics/tour rule profiles (`CourtVenueId`)**:

### A. The 5 Selectable 3D Worlds (`WORLD_PLACES` in `src/game/progression.ts`)

| World ID (`WorldPlaceId`) | Display Name | Mapped `CourtVenueId` | Scene Composition & Assets |
| --- | --- | --- | --- |
| `kampala_compound` | **Kampala Compound** | `kampala_murram` | Brick veranda house, red murram courtyard, banana garden, jackfruit/papaya trees, chickens (`chicken__1_.glb`, `a_chicken_in_low_poly.glb`). |
| `primary_schoolyard` | **Primary Schoolyard** | `kampala_murram` | Dedicated `primarySchoolyardScene.ts` module: primary school classroom wing, open playground grass, flagpoles, assemblies/murram court. |
| `entebbe_lakeside` | **Entebbe Lakeside** | `entebbe_sand` | Dedicated `entebbeLakesideScene.ts`: Lake Victoria cove shoreline, sandy court surface, docked `fishing_boat.glb`, tropical reeds/palms. |
| `trading_centre` | **Trading Centre** | `jinja_rain` | Bustling rural Ugandan market corridor: corrugated-roof *duka* shops, `market_stall.glb`, `drink_booth.glb`, `bananas_with_a_surprise.glb`, `low-poly_simple_wooden_crate.glb`, `low_poly_2013_toyota_hiace.glb` matatu, `honda_prelude_bp1.glb`, `bicycle_classic.glb`. |
| `ndere_festival` | **Ndere Night Yard** | `ndere_night` | Cultural courtyard bathed in lantern glow, woven seating, drums, traditional thatched hut (`luo_hut.usdz` if present in assets), night sky ambience. |

### B. The 4 Gameplay / Tour Venue Profiles (`VENUE_SPECS`)

| `CourtVenueId` | Name | Cowrie Multiplier | Surface / Physics / Weather Behavior |
| --- | --- | --- | --- |
| `kampala_murram` | **Kampala Murram Compound** | `1.0x` | Firm packed earth, crisp stone bounce (`vz = 0.34`), calm default wind (`0`), standard line tolerance (`0.016`). |
| `entebbe_sand` | **Entebbe Lakeside Sand** | `1.2x` | Soft sand absorbs bounce (`vz = 0.16`, `vx/vy *= 0.08`), constant lakeside crosswind (`baseWind >= 0.04`). |
| `jinja_rain` | **Trading Centre** *(formerly Jinja Rain Garden in editorial copy)* | `1.35x` | Rainy/storm-prone weather bias (`auto` resolves to `light_rain` / `storm_shower` depending on period), rain puddles dampen stone and destabilize one-foot balance (`1.32x`). |
| `ndere_night` | **Ndere Lantern Courtyard** | `1.5x` | Night/evening lighting preset (`auto` resolves to twilight/night sky), forgiving chalk line tolerance (`0.019`). |

---

## 2. Documented World Naming & Copy Conflicts (From Audit)

1. **`Trading Centre` vs. `Jinja Rain Garden` Conflict:**
   - **In 3D Code & Gameplay (`worldEnvironments.ts`, `progression.ts`, `QuickMatchModal.tsx`):** The 5th world is **Trading Centre** (`trading_centre`), mapped onto `venueId: 'jinja_rain'`.
   - **In Marketing & Legal/Info Copy (`HomePage.tsx`, `AboutPage.tsx`, `index.html`, `server/adsenseCompliance.ts`):** The text still lists **"Jinja Rain Garden"** as the lush tropical garden world and omits Trading Centre.
   - *Resolution needed:* See [`docs/planning/OPEN_DECISIONS.md`](../planning/OPEN_DECISIONS.md).
2. **Legacy Arrival Sequence Conflict:**
   - `AboutPage.tsx` and `adsenseCompliance.ts` still state that Primary Schoolyard has a car "arrival animation".
   - `worldEnvironments.ts` (`arrivalActive = false`) and `PHOTOREALISM_WORLD_REFERENCE.md` deliberately disabled and deprecated it (`"Legacy arrival state kept inert for backward API compatibility"`).

---

## 3. Daylight, Sky & Dynamic Weather Engine

Controlled live from `UgandanCompoundViewport` View Dock or `QuickMatchModal` (`src/game/weather.ts`, `src/scene3d/ugandanCompoundScene.ts`, `src/scene3d/weatherTextures.ts`, `src/scene3d/treeWind.ts`):
- **Daylight Presets (`PeriodPreset`):**
  - `auto`: Derives from device local clock (`morning` 06–10, `midday` 11–15, `golden` 16–18, `night` 19–05) or forces evening at `ndere_night`.
  - Explicit overrides: `morning`, `midday`, `golden`, `night`.
- **Weather Modes (`WeatherMode`):** `auto`, `random`, `clear`, `breezy`, `misty_dew`, `light_rain`, `storm_shower`.
- **Visual & Physical Coupling:**
  - Procedural `Sky` shader turbidity/elevation/azimuth + hemisphere/sun lights + fog density.
  - GPU tree-wind vertex shader (`applyNaturalWindShader` in `treeWind.ts`) driven by wind strength.
  - Wetness sheen on terrain & props (`applyTerrainWeatherWetness`), rendered court puddle decals (`puddleSquares`), and falling rain streak particles (gated by `settings.dynamicWeather`).

---

## 4. Camera Presets & Framing (`ugandanCompoundScene.ts`)

8 built-in camera presets (`CompoundCameraPreset`):
- Match presets: `play` (default dynamic follow), `aim_target` (low behind-throw angle), `top_aim` (overhead chalk view), cycled via `C` key or Match Camera bar.
- Exploration presets: `courtyard`, `characters`, `ground_low`, `veranda`, `overhead`, plus free right-drag `OrbitControls` and Creator Studio view dock (`H` toggle).
