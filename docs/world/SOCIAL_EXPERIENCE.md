# Sonko — Social Experience

> **Scope:** Documents both the **implemented** social features today and the **planned** multi-user social ecosystem envisioned in [`docs/vision/SONKO_LONG_TERM_VISION.md`](../vision/SONKO_LONG_TERM_VISION.md).

---

## 1. Implemented Social & Shared Play (`IMPLEMENTED`)

1. **Local Couch / Pass-and-Play (`TWO_PLAYER`):**
   - Two players alternate turns on the same screen/device with clear turn banners and walk-in transitions (`PLAYER_SWITCH`).
2. **Team 2v2 Co-op/Rivalry (`TEAM_2V2`):**
   - *Team Cranes* (`You` + AI `Kato`) vs. *Team Waves* (AI `Amina` + AI `Mugisha`) sharing team target progress and team-owned Houses (*Ekizimbe*).
3. **Real-Time Online 1v1 (`ONLINE_1V1`):**
   - **Private Invite Rooms:** Create a 5-character room code (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) and copy a one-click `?room=CODE` invite link (`OnlineLobbyModal.tsx`).
   - **Public Quick Match:** Instant FIFO matchmaking paired across `courtSize` + `venue`.
   - **Shared Cosmetics:** Both players' chosen avatar colors, hair styles, outfits, stone designs, and House stencils sync over `/ws`.
   - **Rematch Flow:** Post-match vote (`1/2` → `2/2`) resets the room cleanly without recreating the lobby.
4. **Ambient Courtyard Camaraderie:**
   - Courtside characters watch the active player (`lookYaw`), celebrate streaks (`SIDELINE_CHEER`), react with playful laughter on fouls (`EMOTE_LAUGH`), and deliver dynamic voice banter.
5. **Global Top-10 Leaderboard (`GlobalLeaderboard.tsx`):**
   - Persistent server-backed high-score ranking (`/data/leaderboard.json`) with customizable player display names (up to 24 chars), venue/mode tags, win counts, and bullseyes.

---

## 2. Planned Social World Capabilities (`PLANNED — Not Yet Implemented`)

The following features are **not present in the codebase** and represent future milestones:
- **User Accounts & Persistent Profiles:** Cross-device login, career match history, win/loss records, and verified handles (replacing anonymous browser `localStorage` UUIDs).
- **Friend Lists & Direct Challenges:** Adding friends, seeing online presence, and sending async/live 1v1 or 2v2 invitations.
- **Communities, Schools & Parishes:** Joining school clubs, alumni houses, neighborhood courtyards, or district teams.
- **Interactive Social Hubs:** Shared 3D compounds/schoolyards where multiple players roam, emote, warm up, and gather before tournaments.
- **Live Spectating & Emote Wheel:** Joining live competitive matches courtside as an audience avatar with reaction cheers.
- **In-Match Quick Chat / Emotes:** Safe, moderated pre-set cultural phrases and celebratory gestures for online rooms.
