# Sonko — Story, Characters & Narrative Direction

> **Critical Boundary:** Sonko's **real-world cultural origin** (why the project exists) is documented separately in [`docs/vision/SONKO_ORIGIN_AND_IDENTITY.md`](../vision/SONKO_ORIGIN_AND_IDENTITY.md). This file covers **in-game characters, dialogue, Tour progression, and the unestablished Story Mode**.

---

## 1. Current Narrative State: Honest Summary

**There is currently NO narrative Story Mode campaign in Sonko.**

- **What exists today:** `TourModal.tsx` displays a modal titled **"Story · Uganda Courtyard Tour"** with subtitle *"4-Stop Regional Circuit"*. Mechanically, it is a venue checklist (`kampala_murram`, `entebbe_sand`, `jinja_rain`, `ndere_night`) awarding regional stamps and higher Cowrie multipliers (`1.0x` → `1.5x`). There are no scripted chapters, cutscenes, rivals with evolving plotlines, or branching narrative progression.
- **Unestablished Story Lore:** No canonical in-game plot has been written yet. Any future Story Mode narrative is recorded below as an **open creative direction** rather than inventing unofficial lore.

---

## 2. Established Character Roster (`src/scene3d/characters.ts` & `sonko3DGameEngine.ts`)

Four playable/courtside 3D character rigs stand around every match (`CHARACTER_SLOTS` / `SLOT_ORDER`):

| Slot ID | Display Name | Default Visual Profile (`characters.ts`) | Role in Match |
| --- | --- | --- | --- |
| `kato` | **Kato** | Boy (`fade` hair, green jersey `#16A34A`, gold trim `#FACC15`, sandals) | Slot 0 — Lead human player (`You` / `Player 1`). Holds stone on Title Menu. |
| `namukasa` | **Namukasa** | Girl (`braids`, sunset-orange tunic `#EA580C`, cyan trim `#38BDF8`, barefoot/sandals) | Slot 1 — Opponent slot in 2P/Bot/Online, sideline reactor in Solo. |
| `ssemakula` | **Ssemakula** | Boy (`afro`, royal blue `#2563EB`, white/gold trim) | Slot 2 — Teammate slot (`Kato (Cranes)`) in `TEAM_2V2` or sideline cheerer. |
| `auma` | **Auma** | Girl (`bun`, bright coral/crimson `#E11D48`, cream trim, barefoot) | Slot 3 — Rival slot (`Mugisha (Waves)`) in `TEAM_2V2` or sideline cheerer. |

### Character Naming Dualism (Observed Conflict)
- In `characters.ts`, `/public/dialogues/*.txt`, and Creator Studio (`UgandanCompoundViewport.tsx`), the 4 characters are **`Kato`**, **`Namukasa`**, **`Ssemakula`**, and **`Auma`**.
- In `sonko3DGameEngine.ts` (`createInitialPlayers`), AI opponents and 2v2 teams are named **`Amina (Bot)`**, **`Amina (Waves)`**, **`Kato (Cranes)`**, and **`Mugisha (Waves)`**, mapped onto `SLOT_ORDER` indices (`1 -> namukasa`, `2 -> ssemakula`, `3 -> auma`). Thus `"Amina"` speaks with Namukasa's dialogue bank and `"Mugisha"` speaks with Auma's dialogue bank (`auma.txt` / `ssemakula.txt` mismatch). This is flagged in [`docs/planning/OPEN_DECISIONS.md`](../planning/OPEN_DECISIONS.md).

---

## 3. Dialogue Banks & Voice System (`/public/dialogues/*.txt` & `src/game/dialogueLoader.ts`)

All 4 character slots load structured plain-text dialogue banks parsed by category tag (`[CATEGORY]`):

| Category Tag | Trigger Context |
| --- | --- |
| `INTRO` | Match start (`leadSlot` greets courtyard) |
| `AIM` | Periodic pre-toss focus banter (`turnCount > 1`) |
| `THROW` | Launching the river stone |
| `GOOD_TOSS` | Clean landing inside target square |
| `BULLSEYE` | Center bullseye landing |
| `WOBBLE` | Single-foot balance drops below `45%` |
| `ANNOYED` | Foul committed or missed House claim |
| `HOUSE_CLAIM` | Successful blind *Ekizimbe* claim |
| `LAUGH` | Sideline rival reacts playfully to a foul (`60%` speech trigger) |
| `CHEER` | Sideline cheering on streaks (`>= 2`) |
| `WIN` | Match victory celebration |

Voices mix subtle Luganda/Ugandan English playground expressions (*"Komawo!"*, *"Ekizimbe!"*, *"Tugende!"*) using Web Audio formant synthesis + optional `SpeechSynthesis` + custom `.mp3/.ogg/.wav` studio overrides (`src/game/voiceEngine.ts`), paired with floating 3D speech bubbles (`subtitlesEnabled`) and jaw/lip-sync animation.

---

## 4. Open Creative Direction: Future Story Mode (`[OPEN FOR FOUNDER INPUT]`)

Before writing chapters or cinematics for a true **Story Mode**, the following creative questions remain open for founder decision:
1. **Protagonist & Tone:** Should Story Mode follow one rising neighborhood kid (e.g., Kato/player avatar) advancing from a local Kampala compound → Primary Schoolyard → Entebbe → Trading Centre → Ndere Cultural Festival, or switch perspectives across friends?
2. **Narrative Themes:** Coming-of-age friendship, inter-school championship stakes, preserving courtyard spaces, or cross-generational mentorship (elders teaching *Ejjinja* and *Kisenda*)?
3. **Delivery Format:** Illustrated dialogue overlays between matches, in-engine 3D camera cutscenes, or voice-acted episodic chapters?
4. **Relationship to `TourModal`:** Should the current 4-stop regional tour be renamed **"Uganda Regional Tour"** once a true narrative **"Story Campaign"** is designed?
