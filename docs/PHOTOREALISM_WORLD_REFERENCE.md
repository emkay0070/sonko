# SONKO — Photorealism World Design & Upgrade Reference (Must Reference)

> **Core Design Mandate**: The visual identity of Sonko is **grounded photorealism** anchored in authentic Ugandan environments, physically based rendering (PBR), tactile surface detail, and natural equatorial lighting. When upgrading any scene from reference artwork or concept previews, **adopt the composition, mood, foliage density, lighting warmth, and storytelling of the preview—never replace photorealistic PBR materials with flat, cel-shaded, or plastic stylized surfaces.**

---

## 1. Universal Photorealism Standards (All Worlds)

1. **Preserve Gameplay & Close-Up Realism**
   - Never alter court dimensions, `groundHeightAt(x, z)` playable court physics, character skeleton rigs, camera collision/presets, multiplayer sync, or existing high-detail PBR materials that already work well (e.g., Kampala's laterite murram, brick mortar, plastered walls, mabati roof, and scanned Oak trees).
2. **Multi-Channel PBR Materials Everywhere**
   - Every ground surface, bark, rock, wall, wood, and hero leaf material must include at minimum:
     - **Albedo Map** (`THREE.SRGBColorSpace`, seamless multi-octave `fbmTile` + natural color variation).
     - **Tangent-Space Normal Map** (`THREE.NoColorSpace`, derived from heightfields for real light-catching micro-relief).
     - **Roughness Map** (`THREE.NoColorSpace`, physically accurate dielectric contrast—e.g. waxy leaf `0.38–0.55`, dry sand/soil `0.78–0.96`, wet shoreline/mud `0.14–0.32`).
     - **AO Map** (on ground/rock/masonry surfaces for grounded crevice darkening).
   - Adjacent parts must maintain clear specular/roughness separation (`>= 0.25` contrast between bark/rock/foliage/water/metal).
3. **Zero Tiling Repetition & Grounding**
   - Pair repeating PBR textures (`anisotropy >= 4`) with world-space GLSL `onBeforeCompile` macro breakup (tonal patches, moisture gradients, sun-bleached vs shaded earth) so large surfaces never show visible repeating seams.
   - Ground every prop (rocks, trees, tufts, furniture, stalls) slightly into terrain with grass/pebble/sand skirts or contact darkening—nothing should ever look pasted onto a surface.
4. **Natural Lighting, Sky & Atmospheric Depth**
   - Use `ACESFilmicToneMapping`, `RoomEnvironment` IBL, directional sunlight with crisp shadow bounds (`PCFSoftShadowMap`), warm/cool `HemisphereLight` bounce, and horizon-matched exponential fog (`FogExp2`).
   - Clouds must use **multi-octave FBM volumetric lighting** (bright sunlit cream tops + cool blue-grey shadow undersides), never flat white circles.
   - Distant horizons (hills, islands, treelines) must use **atmospheric aerial perspective** (desaturated sage/slate/mist tones blending smoothly into sky haze) rather than sharp solid-color geometry.
5. **Runtime & Software-WebGL Parity**
   - `isSoftwareGl` only tunes pixel ratio, shadows, and frame pacing—scene geometry, textures, lights, and materials remain identical for all users.
   - Track and `.dispose()` all created geometries, textures, and materials cleanly.

---

## 2. Scene-by-Scene Photorealism Upgrade Specifications

### World 1: Entebbe Lakeside (`entebbe_lakeside`) — *Reference: `world_entebbe_lakeshore_1795599934486.jpg`*
**Direction to Preserve**: Curved golden sandy beach cove, left sandy palm-lined peninsula jutting into the bay, white chalk hopscotch court directly on beach sand, right cove palms framing the foreground, wooden fishing boat anchored in the cove, open distant Lake Victoria horizon.

**Photorealism Upgrades**:
- **Beach Sand (`Albedo + Normal + Roughness + AO`)**:
  - Seamless multi-octave `fbmTile` wind-blown sand ripples, dark mineral mica grains, tiny crushed shell flecks, and micro-pitting.
  - World-space tonal macro variation (sun-bleached dry upper beach `#e4c795` vs golden compacted sand) and realistic capillary **wet-sand shoreline band** (`roughness: 0.16–0.26`, darkened damp albedo) hugging `entebbeShoreZ(x)`.
- **Lake Victoria Water (`MeshStandardMaterial` + custom GLSL)**:
  - Per-pixel analytical `shoreZAt(x)` feathering (`alpha -> 0` smoothly at shore edge with zero polygon sawtooth clipping).
  - Realistic **Fresnel sky reflection** (`pow(1.0 - N·V, 4.0)`) + **sun-glint specular highlights** across multi-directional scrolling wave normals.
  - Domain-warped **lacy organic surf foam** breaking onto the sand and around the boat hull, grading naturally from translucent sandy-shallows (`#6cc5b8`) into authentic Lake Victoria emerald-teal (`#167c8f`) and deep cerulean (`#0a5273`).
- **Coconut Palms**:
  - **Trunks**: `256x512` weathered coastal palm bark **Albedo + Normal + Roughness** maps (sun-bleached grey-brown fibers, ring-scar indentations, vertical cracks).
  - **Crown & Coconuts**: Fibrous petiole sheath base + multi-toned olive-green/dry-brown husked coconuts with normal-mapped fiber texture.
  - **Fronds**: Botanical **Albedo + Normal + Roughness** textures with raised spine ribs, subtle leaf-blade translucency backlit by sun, and weathered olive-emerald tones with sunlit tips.
- **Coastal Shrubs, Beach Grass & Boulders**:
  - Add **Normal + Roughness** maps (`0.38–0.54` waxy cuticle) to broadleaf shrubs, and interleave **Instanced Coastal Beach Grass Tufts** around shrub and palm bases.
  - Replace smooth boulders with **PBR Weathered Granite/Sandstone** (`Icosahedron` multi-frequency displacement + **Albedo + Normal + Roughness** maps with crevice darkening).
  - Natural pearlescent shells & matte coastal pebbles outside the court.
- **Sky, Clouds & Distant Islands**:
  - Multi-octave FBM volumetric cumulus clouds (warm sunlit tops + blue-grey shadowed bellies).
  - Misty aerial-perspective distant Lake Victoria headlands (`distantWorld.ts`) fading gently into horizon haze.

---

### World 2: Kampala Compound (`kampala_compound`) — *Reference: `hero_sonko_courtyard_play_1795599933272.jpg`*
**Direction to Preserve**: Intimate red-murram Ugandan family compound with plastered home, corrugated iron mabati veranda, exposed terracotta brick perimeter wall, Hero Mango Tree (*Omuyembe*), jerrycans, earthen water pot, and scanned Oak trees.

**Photorealism Upgrades (Strictly Additive)**:
- **Preserve Existing Close-Up PBR Surfaces**: Keep `murramAlbedo/Normal/Roughness/AO`, `brickAlbedo/Normal/Roughness`, `plasterAlbedo/Normal`, `mabatiAlbedo/Normal/Roughness`, `barkAlbedo/Normal`, and existing Oak LOD canopies untouched.
- **Matooke / Banana Tree Clusters**:
  - Add composite Ugandan banana plants (`TubeGeometry` layered fibrous pseudostems + hanging dark purple-red banana bell / green *matooke* bunch + curved broad banana leaves using `bananaLeafMap` paired with **Normal + Roughness** maps + subtle sunlit leaf translucency) tucked organically behind the brick wall corners and veranda flank.
- **Perimeter Grounding & Foliage Density**:
  - Enrich grass tufts (`grassTuftMap` + normal relief) and fallen dried mango leaves along the brick-wall footing and veranda concrete apron, deepening ambient occlusion at wall-to-soil contact.
- **Realistic Horizon Hills (`distantWorld.ts`)**:
  - Replace sharp flat-shaded grey-cone mountain ridges behind the compound with smooth sculpted rolling **Kampala green-and-laterite hills** dusted with distant treelines and soft equatorial haze.
- **Warm Afternoon Lighting Polish**:
  - Keep existing natural daylight clarity while ensuring warm golden rim bounce off the red murram onto the white plaster and brick mortar.

---

### World 3: Ndere Festival (`ndere_festival`) — *Reference: `world_ndere_lanterns_1795599935013.jpg`*
**Direction to Preserve**: Evening cultural courtyard festival under an equatorial night sky, keeping playable central Sonko court completely clear and legible.

**Photorealism Upgrades**:
- **Atmospheric Night Sky**:
  - Deep midnight-cobalt horizon gradient sky (`daylight/night` tuned cleanly), subtle twinkling starfield, and soft glowing crescent moon high over the festival treeline.
- **Architectural & Stage Craft**:
  - Keep `luo_hut.usdz` village huts and add a hero **PBR Timber Ndere Pavilion / Veranda Stage** (weathered wood grain **Albedo + Normal + Roughness**, thatched grass eaves, carved wooden `"NDERE"` signboard, woven wall hangings) on the flank/rear framing the court without blocking sightlines.
- **Warm Lanterns & Campfire Rig (Strict Light Budget)**:
  - Suspend realistic **catenary rope cables** (`TubeGeometry`) across timber posts carrying glowing warm **amber lantern cages** (emissive glass core + dark wrought iron cap/ribs), staying within `<= 3` shadow-casting lights (`1` moonlight key + `<= 2` warm bounce fills / instanced emissive glows).
  - Add a **stone-ringed courtyard campfire** in the rear social plaza with charred logs, flickering emissive embers, rising spark motes, and rough timber festival benches.
- **Cultural Instruments & Ground PBR**:
  - Place woven **Ngoma drums** (stretched hide normal/roughness + carved wood bodies + cord lacing) resting on **woven reed mats** (`reedMatAlbedo` + woven normal map) along the right edge.
  - Upgrade ground surface to dark swept festival earth (`Albedo + Normal + Roughness + AO`) catching warm amber pools beneath lanterns and cool moonlight rim highlights.

---

### World 4: Trading Centre (`trading_centre`)
**Direction to Preserve**: Bustling roadside Ugandan *duka* shopfronts, timber market stalls, drink booth, matatu hiace / sedan along the back avenue, banana crates, and classic bicycle.

**Photorealism Upgrades**:
- **Shopfront (`duka`) PBR Material Upgrade**:
  - Replace flat solid wall/roof colors (`buildTradingCentre` in `worldEnvironments.ts`) with weathered `plasterAlbedo/Normal`, `brickAlbedo/Normal/Roughness`, and rusted/galvanized `mabatiAlbedo/Normal/Roughness` maps from `pbrTextures.ts`, plus timber fascia beams and window mullions.
- **Street & Plaza Surface Realism**:
  - Add procedural weathered asphalt + red-murram shoulder gravel **Albedo + Normal + Roughness** maps to the rear road and concrete curb (replacing flat `#3f3b38` / `#9c8a78` colors) with subtle tire-track specular polish and dusty curb edges.
- **Market Grounding**:
  - Add woven sack/tarp props and ground dirt/wear contact darkening beneath market stalls and banana crates.

---

### World 5: Primary Schoolyard (`primary_schoolyard`) — *Reference: `ugandan_primary_school_ref_1795604000745.jpg`*
**Direction to Preserve**: Authentic Ugandan government primary school (UPE) red-murram assembly courtyard—**no Park, no Trailer Park, and no out-of-place arrival vehicle**. Chalk Sonko court drawn directly onto sunlit compacted laterite earth between flanking classroom blocks, opening out to a rear assembly square and grassy football pitch.

**Photorealism Upgrades**:
- **Murram-to-Savannah Sports Pitch Terrain**:
  - Seamless 96m x 96m PBR ground (`murramAlbedo/Normal/Roughness/AO` + `uv2`) transitioning organically via domain-warped GLSL into **FBM Savannah Couch Grass (`Albedo + Normal + Roughness`)** with a worn murram center path toward rear eucalyptus football goalposts and gentle green Wakiso horizon hills.
- **Ugandan Brick & Plaster Classroom Blocks (`P1–P6`)**:
  - Single-story fair-faced kiln-fired clay brick blocks (`brickAlbedo/Normal/Roughness`) raised on concrete veranda slabs (`veranda_surface.jpg` + dark mud-splash footing boots), square cream-plastered columns, upper plastered transom frieze with stenciled **`P1`–`P5`** class plaques and perforated terracotta breeze-blocks, barred steel casement windows, dark green painted doors, exposed eucalyptus rafters, corrugated galvanized **`mabati`** roofs with gutters/downpipes, hanging **wheel-rim school bell**, and a blue 500L rainwater harvesting tank.
- **Assembly Square Landmarks & Grounding**:
  - Hand-painted **School Noticeboard & Motto Monument** (with red-earth lower rain-splash & twin slate chalkboards), stepped **Assembly Flagpole with animated waving Ugandan National Flag**, **timber tire-swing frame**, Hero **Mango & Acacia shade trees** (`mangoLeafMap` + wind shader), full-canopy perimeter oaks, embedded murram pebbles, and instanced savannah grass tufts along every plinth and wall footing.

