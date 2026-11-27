# Sonko — Product Philosophy

These principles combine evidence distilled from Sonko's codebase, UI architecture, copy, and `docs/PHOTOREALISM_WORLD_REFERENCE.md` with the founder's product and entrepreneurial direction. They govern how Sonko makes design, creative, and business tradeoffs.

---

## 1. Cultural Storytelling Through Childhood Memories
- Sonko exists not merely to digitize a rulebook, but to **revisit and tell the stories of many Ugandans** through the games, friendships, rivalries, and everyday moments of childhood—making that world accessible to new generations.
- Every place, prop, textile, sound, and rule must belong authentically to Uganda: murram red earth, cassava gardens, jackfruit and mango trees, iron-sheet verandas, Lake Victoria wooden fishing boats, *duka* trading stalls, and Ndere courtyard lanterns rather than generic stock shortcuts.
- Mechanics honor authentic courtyard play (*Ejjinja*, skipping the stone square, scooping on return, and blind *Ekizimbe* House claiming).

## 2. Tactile, Grounded World Presence
- **Full-Viewport Immersion:** In `/play`, the 3D Ugandan courtyard fills the entire viewport immediately from the title menu—characters stand around the chalk court ready for play, not behind static splash banners.
- **Photorealism Through Restraint:** Following `PHOTOREALISM_WORLD_REFERENCE.md`, worlds prioritize believable PBR roughness, ground contact shadows, clear sightlines for gameplay, wind-animated foliage, and atmospheric lighting rather than over-saturated cartoon neon or visual clutter.

## 3. Cultural Authenticity & Commercial Ambition Together
- Sonko rejects the false choice between cultural depth and commercial success. Cultural storytelling and building a **commercially successful, high-value gaming property** are co-equal pillars.
- **Fair Play Integrity:** In current implementation, gameplay remains accessible with zero pay-to-win—all Courtyard Stall cosmetics unlock via **Cowries** earned through skill, streaks, missions, and optional rewarded breaks (`TermsPage.tsx`). Any future commercial models must preserve competitive fairness.
- **Clean Content/Play Separation:** Editorial pages (`/`, `/how-to-play`, `/about`, `/privacy`, `/terms`, `/contact`) carry genuine cultural and rulebook value cleanly separated from active match controls (`server/adsenseCompliance.ts`), and private founder motivations stay in internal strategy docs rather than public marketing copy.

## 4. Browser Foundation Stepping Toward Larger Horizons
- **Browser-First & Offline-Ready Today:** Playable immediately in any WebGL-capable browser with Workbox PWA offline support so Solo, VS Bot, 2P Local, and 2v2 work even on intermittent connections, plus graceful WebGL fallback recovery (`UgandanCompoundViewport`).
- **Built to Grow Across Platforms:** Browser gaming is Sonko's intentional launchpad—not its ceiling. Architecture and world design aim long-term toward mobile, console, deeper immersive experiences, and an eventual open-world Ugandan childhood experience as traction and resources justify each leap.

## 5. Living Social Warmth
- Childhood games live through friendship and rivalry. Even single-player matches keep four expressive characters (`Kato`, `Namukasa`, `Auma`, `Ssemakula`) reacting courtside to wobbles, fouls, bullseyes, and streaks with facial expressions, body language, and voiced banter.
