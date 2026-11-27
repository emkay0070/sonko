# Sonko — Business & Sustainability

> **Truthfulness & Scope Note:** Only **Free-to-Play Ad-Supported Web Access** and the **Non-Monetary Cowrie Economy** are established and implemented in code today (Section 1). Section 2 records the founder's internal commercial ambition (not intended for public marketing copy), and Section 3 outlines **speculative strategic possibilities**—with no invented financial targets, release dates, or guarantees of success.

---

## 1. Established & Implemented Model Today

### A. Free-to-Play Browser & PWA Access
- **Access Model:** 100% free across all routes, game modes, worlds, and Creator Studio features (with optional server `SONKO_STUDIO_KEY` gating for Creator Studio).
- **Monetization Infrastructure (`IMPLEMENTED / CONFIGURED`):**
  - **Google AdSense & Google H5 Games Ads Placement API** (`index.html`, `src/game/adService.ts`, `server/adsenseCompliance.ts`, `/public/ads.txt`).
  - **Placements:**
    1. Clean editorial display ad slots outside gameplay controls (`HomePage`, `HowToPlayPage`, `AboutPage` — disabled when `VITE_ADSENSE_CLIENT_ID` is unset or on non-eligible routes).
    2. Optional player-initiated **Rewarded Ads** (`double_match`, `mission_reroll`, `bonus_chest`) guarded by server-issued single-use HMAC/random tokens and daily caps.
    3. Frequency-capped **Interstitial Breaks** between matches (every 2 finished matches, ≥ `120s` cooldown, max `8`/day, never during active play).
  - **Privacy & Compliance:** Explicit user choice between `personalized` and `non_personalized` ads (`ConsentBanner.tsx`, `SettingsModal.tsx`), full `PrivacyPage`, `TermsPage`, and `ContactPage`.

### B. Non-Monetary Virtual Economy (`Cowries`)
- **Explicit Rule (`src/pages/TermsPage.tsx`, Section 3):**
  > *"Cowries have no real-world monetary value, cannot be purchased for cash, cannot be redeemed for money or real goods, and are non-transferable between accounts or devices."*
- All Courtyard Stall unlocks (`STONE_CATALOG`, `OUTFIT_CATALOG`, `STENCIL_CATALOG`) are earned strictly through gameplay, daily login streaks, daily missions, achievements, and optional rewarded ad bonuses.

---

## 2. Founder Commercial Ambition *(Internal Strategic Context)*

- **Dual Cultural & Financial Mandate:** Sonko is **not** positioned solely as a non-commercial cultural preservation effort. Alongside revisiting Ugandan childhood memories and telling authentic stories, the founder has an explicit financial ambition for Sonko to grow into a **commercially successful gaming property** capable of generating significant income and creating substantial entrepreneurial value.
- **Internal vs. Public Boundary:** These financial and personal entrepreneurial ambitions guide internal product, platform, and partnership strategy—they should **not** be automatically copied verbatim into public-facing player copy, where the focus remains gameplay, culture, and player trust.
- **No Unfounded Projections:** No specific revenue targets, valuation assumptions, monetization timelines, or guarantees of commercial outcome are asserted in this document.

---

## 3. Speculative Future Sustainability & Growth Directions (`[PROPOSED — NOT ESTABLISHED]`)

As Sonko evolves from its initial browser-based *Ejjinja* foundation toward a broader multi-game, multi-platform ecosystem (`docs/vision/SONKO_LONG_TERM_VISION.md`), the following revenue and commercial expansion vectors warrant evaluation—with **no commitment implied yet**:

1. **Multi-Platform Commercial Expansion *(Proposed Long-Term Horizon)*:**
   - **Browser Foundation → Mobile → Console → Larger Immersive / Open-World Experiences:** Each platform tier opens distinct commercial opportunities (high-reach mobile audiences, premium or cosmetic console editions, and flagship immersive/open-world releases). None of these post-browser platforms exist today or have committed release milestones.
2. **Tournament, League & Brand Sponsorships *(Proposed)*:**
   - Co-branded seasonal cups, school competitions, or regional district leagues sponsored by Ugandan/East African telecoms, consumer brands, or cultural venues (e.g., branded courtyard banners, prize pools for physical finals, livestream integrations).
3. **Cultural & Institutional Partnerships *(Proposed)*:**
   - Commercial and community collaborations with primary/secondary schools, heritage festivals, cultural centres, and media partners supporting both sustainable monetization and physical cultural reach.
4. **Optional Cosmetic Storefront / Supporter Passes *(Proposed — Requires Policy Review)*:**
   - If direct player purchases are introduced alongside ads in future web/mobile/console builds, strict **zero pay-to-win** integrity would keep gameplay competitive: purchases limited to artisan *Kitenge* skins, carved stones, victory animations, or ad-free supporter passes while keeping core play accessible. *(Note: Currently `TermsPage.tsx` prohibits cash purchases; any change would require account authentication, payment integration, and updated legal terms.)*
5. **Creator Economy & Local Talent Pipeline *(Proposed)*:**
   - Revenue-sharing or commissioned bounties for Ugandan 3D modelers, textile pattern designers, musicians, and local-language voice actors contributing approved assets via Creator Studio.
6. **Geographic Growth Trajectory *(Proposed)*:**
   - **Uganda Core** (Kampala, Wakiso/Entebbe, Jinja, regional centres) → **East African Community** (Kenya, Tanzania, Rwanda, Burundi—adapting shared/regional traditional games such as *Kisenda* and others) → **African Diaspora & Global Gaming Audiences**.
