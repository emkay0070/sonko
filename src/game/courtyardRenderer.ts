import { StoneCatalogItem } from './progression';
import { CourtSquare, CourtVenueId, HopStep, StencilId, TurnPhase } from './types';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  alpha: number;
}

export interface FloatingCallout {
  text: string;
  x: number; // normalized court x
  y: number; // normalized court y
  life: number;
  maxLife: number;
  color: string;
}

export interface SidelineCharacter {
  id: number;
  teamId: 0 | 1;
  name: string;
  hairStyle: 'braids' | 'afro' | 'bun' | 'fade';
  skinTone: string;
  primaryColor: string;
  accentColor: string;
  nx: number;
  ny: number;
  cheering: boolean;
}

export interface RenderState {
  time: number;
  venue: CourtVenueId;
  windX: number;
  puddleSquares: number[];
  squares: CourtSquare[];
  houses: Record<number, 0 | 1>;
  activePlayerIndex: number;
  activeTeamId: 0 | 1;
  activeHairStyle: 'braids' | 'afro' | 'bun' | 'fade';
  activeSkinTone: string;
  playerColors: [string, string];
  playerAccents: [string, string];
  playerNames: [string, string];
  playerStencils: [StencilId, StencilId];
  activeStoneSpec: StoneCatalogItem;
  sidelineCharacters: SidelineCharacter[];
  phase: TurnPhase;
  targetSquareId: number;
  // Stone position in normalized court space + height z (0 = ground)
  stoneX: number;
  stoneY: number;
  stoneZ: number;
  stoneRot: number;
  stoneInHand: boolean;
  stonePlacedSquareId: number | null;
  // Player avatar in normalized court space
  playerX: number;
  playerY: number;
  playerZ: number;
  playerFacing: number; // -PI/2 = facing up court, PI/2 = facing baseline/camera
  playerStance: 'TWO_FEET' | 'LEFT_FOOT' | 'RIGHT_FOOT' | 'BENDING';
  playerSquashX: number;
  playerSquashY: number;
  balance: number; // 0..100
  balanceSway: number; // -1..1 visual lean
  // Aiming
  aimAngleOffset: number;
  aimPower: number;
  isCharging: boolean;
  predictedLandX: number;
  predictedLandY: number;
  // Next valid hop step highlight
  nextStep: HopStep | null;
  // Foul visual highlight
  foulFlashTimer: number;
  foulSquareId: number | null;
  // Shake
  shakeX: number;
  shakeY: number;
  // Particles & callouts (in court normalized space)
  particles: Particle[];
  callouts: FloatingCallout[];
}

export interface CourtTransform {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function computeCourtTransform(canvasW: number, canvasH: number): CourtTransform {
  const topMargin = Math.max(62, canvasH * 0.095);
  const bottomMargin = Math.max(54, canvasH * 0.08);
  const availH = Math.max(240, canvasH - topMargin - bottomMargin);
  const availW = Math.max(240, canvasW - 32);

  // Wider slightly to comfortably showcase 3/4 courtyard perspective & sideline teammates
  const aspect = 0.72;
  let courtH = availH;
  let courtW = courtH * aspect;
  if (courtW > availW) {
    courtW = availW;
    courtH = courtW / aspect;
  }

  return {
    left: (canvasW - courtW) / 2,
    top: topMargin + (availH - courtH) / 2,
    width: courtW,
    height: courtH,
  };
}

/**
 * 3/4 Courtyard Perspective Projection:
 * ny = 0 (far top Ewaaka) -> 0.64 scale
 * ny = 1 (near baseline)   -> 1.00 scale
 */
export function projectCourt(
  ct: CourtTransform,
  nx: number,
  ny: number
): { x: number; y: number; scale: number } {
  const scale = 0.64 + 0.36 * ny;
  const perspY = (ny * (0.64 + 0.18 * ny)) / 0.82;
  return {
    x: ct.left + (0.5 + (nx - 0.5) * scale) * ct.width,
    y: ct.top + perspY * ct.height,
    scale,
  };
}

/**
 * Exact inverse of projectCourt for mouse/touch hit-testing on the tilted court.
 */
export function unprojectCourt(
  ct: CourtTransform,
  px: number,
  py: number
): { nx: number; ny: number } {
  const sy = (py - ct.top) / ct.height;
  const disc = Math.max(0.01, 0.4096 + 0.5904 * sy);
  const ny = (-0.64 + Math.sqrt(disc)) / 0.36;
  const scale = Math.max(0.25, 0.64 + 0.36 * ny);
  const nx = 0.5 + ((px - ct.left) / ct.width - 0.5) / scale;
  return { nx, ny };
}

export class CourtyardRenderer {
  private soilCanvas: HTMLCanvasElement | null = null;
  private cachedW = 0;
  private cachedH = 0;
  private cachedVenue: CourtVenueId | null = null;

  private ensureSoilTexture(w: number, h: number, venue: CourtVenueId): HTMLCanvasElement {
    if (
      this.soilCanvas &&
      this.cachedW === w &&
      this.cachedH === h &&
      this.cachedVenue === venue
    ) {
      return this.soilCanvas;
    }
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.floor(w));
    off.height = Math.max(1, Math.floor(h));
    const ctx = off.getContext('2d');
    if (!ctx) return off;

    const skyH = h * 0.125;

    if (venue === 'entebbe_sand') {
      // Lake Victoria teal horizon & sunlit Entebbe golden beach sand
      const lakeGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      lakeGrad.addColorStop(0, '#134E5E');
      lakeGrad.addColorStop(0.7, '#227083');
      lakeGrad.addColorStop(1, '#3D8C95');
      ctx.fillStyle = lakeGrad;
      ctx.fillRect(0, 0, w, skyH);

      // Shore foam line
      ctx.fillStyle = 'rgba(255, 251, 235, 0.45)';
      ctx.fillRect(0, skyH - 4, w, 4);

      const sandGrad = ctx.createLinearGradient(0, skyH, 0, h);
      sandGrad.addColorStop(0, '#B98D52');
      sandGrad.addColorStop(0.28, '#CE9F62');
      sandGrad.addColorStop(0.75, '#D4A86B');
      sandGrad.addColorStop(1, '#9E733E');
      ctx.fillStyle = sandGrad;
      ctx.fillRect(0, skyH, w, h - skyH);
    } else if (venue === 'jinja_rain') {
      // Overcast tropical mist horizon & deep wet umber courtyard clay
      const mistGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      mistGrad.addColorStop(0, '#1E293B');
      mistGrad.addColorStop(1, '#334155');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, 0, w, skyH);

      const mudGrad = ctx.createLinearGradient(0, skyH * 0.6, 0, h);
      mudGrad.addColorStop(0, '#3D271E');
      mudGrad.addColorStop(0.3, '#523225');
      mudGrad.addColorStop(0.72, '#5F3A2B');
      mudGrad.addColorStop(1, '#361E15');
      ctx.fillStyle = mudGrad;
      ctx.fillRect(0, skyH * 0.75, w, h - skyH * 0.75);
    } else if (venue === 'ndere_night') {
      // Indigo twilight compound & lantern-warmed dark laterite court
      const nightGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      nightGrad.addColorStop(0, '#0D0919');
      nightGrad.addColorStop(1, '#23162D');
      ctx.fillStyle = nightGrad;
      ctx.fillRect(0, 0, w, skyH);

      const nightEarth = ctx.createLinearGradient(0, skyH * 0.65, 0, h);
      nightEarth.addColorStop(0, '#271412');
      nightEarth.addColorStop(0.3, '#3D1E15');
      nightEarth.addColorStop(0.72, '#4A2418');
      nightEarth.addColorStop(1, '#1F0D09');
      ctx.fillStyle = nightEarth;
      ctx.fillRect(0, skyH * 0.75, w, h - skyH * 0.75);
    } else {
      // Default Kampala Murram Courtyard
      const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      skyGrad.addColorStop(0, '#461C0E');
      skyGrad.addColorStop(1, '#78321C');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, skyH);

      const horizonGrad = ctx.createLinearGradient(0, skyH * 0.4, 0, h);
      horizonGrad.addColorStop(0, '#78321C');
      horizonGrad.addColorStop(0.22, '#9A3F24');
      horizonGrad.addColorStop(0.65, '#AA4A2C');
      horizonGrad.addColorStop(1, '#6C2814');
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, skyH * 0.7, w, h - skyH * 0.7);
    }

    // Seeded deterministic ground grain, shells/pebbles & swept arcs
    let seed = venue === 'entebbe_sand' ? 29183 : venue === 'jinja_rain' ? 77123 : venue === 'ndere_night' ? 9921 : 133742;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 48; i++) {
      const px = rand() * w;
      const py = skyH * 0.7 + rand() * (h - skyH * 0.7);
      const r = 28 + rand() * 90;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      const lighter = rand() > 0.45;
      if (venue === 'entebbe_sand') {
        g.addColorStop(0, lighter ? 'rgba(254, 243, 199, 0.12)' : 'rgba(120, 75, 25, 0.11)');
      } else if (venue === 'jinja_rain') {
        g.addColorStop(0, lighter ? 'rgba(148, 163, 184, 0.08)' : 'rgba(20, 10, 6, 0.18)');
      } else if (venue === 'ndere_night') {
        g.addColorStop(0, lighter ? 'rgba(245, 158, 11, 0.06)' : 'rgba(10, 5, 16, 0.22)');
      } else {
        g.addColorStop(0, lighter ? 'rgba(217, 119, 6, 0.09)' : 'rgba(42, 14, 7, 0.13)');
      }
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const pebbleCount = Math.min(2400, Math.floor((w * h) / 500));
    for (let i = 0; i < pebbleCount; i++) {
      const px = rand() * w;
      const py = skyH * 0.78 + rand() * (h - skyH * 0.78);
      const r = 0.6 + rand() * 1.8;
      const t = rand();
      if (venue === 'entebbe_sand') {
        ctx.fillStyle =
          t < 0.5
            ? `rgba(120, 72, 24, ${0.1 + rand() * 0.14})`
            : `rgba(255, 251, 235, ${0.14 + rand() * 0.14})`;
      } else if (venue === 'jinja_rain') {
        ctx.fillStyle =
          t < 0.55
            ? `rgba(24, 12, 8, ${0.16 + rand() * 0.18})`
            : `rgba(186, 230, 253, ${0.06 + rand() * 0.09})`;
      } else if (venue === 'ndere_night') {
        ctx.fillStyle =
          t < 0.6
            ? `rgba(15, 7, 12, ${0.18 + rand() * 0.2})`
            : `rgba(251, 191, 36, ${0.04 + rand() * 0.06})`;
      } else if (t < 0.45) {
        ctx.fillStyle = `rgba(45, 16, 8, ${0.12 + rand() * 0.16})`;
      } else if (t < 0.82) {
        ctx.fillStyle = `rgba(234, 179, 8, ${0.06 + rand() * 0.1})`;
      } else {
        ctx.fillStyle = `rgba(248, 232, 210, ${0.07 + rand() * 0.1})`;
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (venue === 'kampala_murram' || venue === 'ndere_night') {
      ctx.strokeStyle = venue === 'ndere_night' ? 'rgba(20, 8, 5, 0.22)' : 'rgba(48, 18, 10, 0.12)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) {
        const cx = rand() * w;
        const cy = skyH + rand() * (h - skyH);
        const rad = 40 + rand() * 90;
        const startA = rand() * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, startA, startA + 0.55);
        ctx.stroke();
      }
    }

    this.soilCanvas = off;
    this.cachedW = w;
    this.cachedH = h;
    this.cachedVenue = venue;
    return off;
  }

  public render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, state: RenderState) {
    const soil = this.ensureSoilTexture(cssW, cssH, state.venue);
    ctx.save();
    ctx.translate(state.shakeX, state.shakeY);

    // 1. Courtyard Surface
    ctx.drawImage(soil, 0, 0, cssW, cssH);

    // 2. Venue Atmospheric Backdrop (Waves, Lantern Pools, Rain Clouds, Leaf Shadows)
    this.drawVenueAtmosphereBeforeCourt(ctx, cssW, cssH, state);

    const ct = computeCourtTransform(cssW, cssH);

    // 3. Perspective Baseline Throw Line
    const baseLeft = projectCourt(ct, 0.14, 0.905);
    const baseRight = projectCourt(ct, 0.86, 0.905);
    ctx.save();
    ctx.strokeStyle =
      state.venue === 'entebbe_sand'
        ? 'rgba(255, 251, 235, 0.72)'
        : 'rgba(250, 243, 232, 0.62)';
    ctx.lineWidth = Math.max(2.5, ct.width * 0.01);
    ctx.lineCap = 'round';
    ctx.setLineDash([ct.width * 0.04, ct.width * 0.024]);
    ctx.beginPath();
    ctx.moveTo(baseLeft.x, baseLeft.y);
    ctx.lineTo(baseRight.x, baseRight.y);
    ctx.stroke();
    ctx.restore();

    // 4. Perspective Court Squares (+ Puddles in Jinja)
    this.drawCourtSquares(ctx, ct, state);

    // 5. Aim Trajectory Preview
    if (state.phase === 'TOSS_AIM' || state.phase === 'CLAIM_AIM') {
      this.drawAimPreview(ctx, ct, state);
    }

    // 6. Depth-sorted Stone, Active Player, and Sideline Teammates/Rivals
    const drawables: { depthY: number; draw: () => void }[] = [];

    if (!state.stoneInHand) {
      drawables.push({
        depthY: state.stoneY,
        draw: () => this.drawStone(ctx, ct, state),
      });
    }

    drawables.push({
      depthY: state.playerY,
      draw: () => this.drawActiveHuman(ctx, ct, state),
    });

    for (const mate of state.sidelineCharacters) {
      drawables.push({
        depthY: mate.ny,
        draw: () => this.drawSidelineHuman(ctx, ct, state.time, mate),
      });
    }

    drawables.sort((a, b) => a.depthY - b.depthY);
    for (const d of drawables) {
      d.draw();
    }

    // 7. World-Space Balance Meter above active player when on one foot
    if (
      (state.phase === 'HOP_OUT' ||
        state.phase === 'HOP_BACK' ||
        state.phase === 'PICKUP_STONE' ||
        state.phase === 'HOP_EXIT') &&
      state.playerStance !== 'TWO_FEET'
    ) {
      this.drawWorldBalanceArc(ctx, ct, state);
    }

    // 8. Particles
    for (const p of state.particles) {
      if (!p.active) continue;
      const pos = projectCourt(ct, p.x, p.y);
      const t = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - t));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size * pos.scale * (0.7 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Foreground Venue Weather / Lighting (Rain Streaks, Wind Sand Motes, Night Fireflies & Lanterns)
    this.drawVenueForegroundFX(ctx, cssW, cssH, ct, state);

    // 10. Floating Callouts
    for (const c of state.callouts) {
      const pos = projectCourt(ct, c.x, c.y);
      const progress = c.life / c.maxLife;
      const alpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.round(Math.max(14, ct.width * 0.048))}px "Bricolage Grotesque", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(26, 11, 6, 0.85)';
      ctx.fillText(c.text, pos.x + 1.5, pos.y - 30 - progress * 28 + 1.5);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, pos.x, pos.y - 30 - progress * 28);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawVenueAtmosphereBeforeCourt(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: RenderState
  ) {
    ctx.save();
    const t = state.time;

    if (state.venue === 'entebbe_sand') {
      // Animated Lake Victoria lapping shoreline waves along top band
      const shoreY = h * 0.125;
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.5)';
      ctx.lineWidth = 2;
      for (let row = 0; row < 2; row++) {
        ctx.beginPath();
        const baseY = shoreY - 10 - row * 12 + Math.sin(t * 1.4 + row) * 3;
        for (let x = 0; x <= w; x += 28) {
          const wy = baseY + Math.sin(x * 0.025 + t * 2.1 + row * 1.3) * 2.5;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
      // Swaying palm frond shadow
      const palmSway = Math.sin(t * 0.9) * 18;
      ctx.fillStyle = 'rgba(72, 46, 16, 0.16)';
      ctx.beginPath();
      ctx.moveTo(w + 20, h * 0.12);
      ctx.quadraticCurveTo(w * 0.82 + palmSway, h * 0.25, w * 0.78 + palmSway, h * 0.4);
      ctx.quadraticCurveTo(w * 0.9, h * 0.36, w + 20, h * 0.42);
      ctx.closePath();
      ctx.fill();
    } else if (state.venue === 'jinja_rain') {
      // Cool wet sheen gradient
      const wetGrad = ctx.createLinearGradient(0, 0, w, h);
      wetGrad.addColorStop(0, 'rgba(148, 163, 184, 0.11)');
      wetGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.05)');
      wetGrad.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
      ctx.fillStyle = wetGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (state.venue === 'ndere_night') {
      // Warm glowing lantern pools cast onto the dark ground around court corners
      const lanternSpots = [
        { x: w * 0.18, y: h * 0.24, r: w * 0.28 },
        { x: w * 0.82, y: h * 0.24, r: w * 0.28 },
        { x: w * 0.5, y: h * 0.58, r: w * 0.42 },
      ];
      for (let i = 0; i < lanternSpots.length; i++) {
        const sp = lanternSpots[i];
        const flicker = 0.94 + Math.sin(t * 5.2 + i * 1.9) * 0.06;
        const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r * flicker);
        g.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
        g.addColorStop(0.45, 'rgba(217, 119, 6, 0.11)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * flicker, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Kampala Murram swaying banana & acacia shadows + golden sunlight
      ctx.fillStyle = 'rgba(28, 10, 5, 0.22)';
      const sway = Math.sin(t * 0.7) * 14;
      const sway2 = Math.cos(t * 0.55) * 10;

      ctx.beginPath();
      ctx.moveTo(-20, -20);
      ctx.quadraticCurveTo(w * 0.14 + sway, h * 0.08, w * 0.22 + sway, h * 0.22);
      ctx.quadraticCurveTo(w * 0.09 + sway * 0.5, h * 0.19, -20, h * 0.16);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(w + 20, h * 0.15);
      ctx.quadraticCurveTo(w * 0.86 + sway2, h * 0.28, w * 0.82 + sway2, h * 0.42);
      ctx.quadraticCurveTo(w * 0.92, h * 0.41, w + 20, h * 0.48);
      ctx.closePath();
      ctx.fill();

      const sunGrad = ctx.createLinearGradient(0, 0, w, h);
      sunGrad.addColorStop(0, 'rgba(251, 191, 36, 0.06)');
      sunGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.03)');
      sunGrad.addColorStop(1, 'rgba(28, 10, 5, 0.16)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  private drawVenueForegroundFX(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    ct: CourtTransform,
    state: RenderState
  ) {
    const t = state.time;
    ctx.save();

    if (state.venue === 'entebbe_sand') {
      // Wind-blown coastal breeze streaks matching windX direction & speed
      const speed = state.windX * 260;
      if (Math.abs(speed) > 4) {
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.26)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 16; i++) {
          const baseX = ((i * 197 + t * speed * 1.4) % (w + 120) + (w + 120)) % (w + 120) - 60;
          const baseY = h * 0.16 + ((i * 83) % Math.max(100, h * 0.78));
          const len = Math.sign(speed) * (16 + Math.min(34, Math.abs(speed) * 0.35));
          ctx.beginPath();
          ctx.moveTo(baseX, baseY);
          ctx.lineTo(baseX + len, baseY + 3);
          ctx.stroke();
        }
      }
    } else if (state.venue === 'jinja_rain') {
      // Falling tropical rain streaks
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 38; i++) {
        const dropPhase = (t * 2.4 + i * 0.17) % 1;
        const rx = ((i * 139 + dropPhase * 55) % w);
        const ry = dropPhase * (h + 40) - 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 18);
        ctx.stroke();
      }
    } else if (state.venue === 'ndere_night') {
      // Two glowing hanging courtyard lanterns beside far Ewaaka corners + floating fireflies
      const lanterns = [
        projectCourt(ct, -0.14, 0.12),
        projectCourt(ct, 1.14, 0.12),
      ];
      for (let i = 0; i < lanterns.length; i++) {
        const lp = lanterns[i];
        const swing = Math.sin(t * 1.6 + i) * 3;
        const lx = lp.x + swing;
        const ly = lp.y - 34;

        // Pole post & arm
        ctx.strokeStyle = '#3B1E14';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lp.x, lp.y + 8);
        ctx.lineTo(lp.x, ly - 16);
        ctx.lineTo(lx, ly - 8);
        ctx.stroke();

        // Warm glow halo
        const halo = ctx.createRadialGradient(lx, ly, 2, lx, ly, 42);
        halo.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        halo.addColorStop(0.35, 'rgba(245, 158, 11, 0.42)');
        halo.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(lx, ly, 42, 0, Math.PI * 2);
        ctx.fill();

        // Lantern glass body
        ctx.fillStyle = '#FEF08A';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(lx - 6, ly - 8, 12, 16, 3);
        ctx.fill();
        ctx.stroke();
      }

      // Floating warm fireflies
      for (let i = 0; i < 14; i++) {
        const fx = ((i * 173 + Math.sin(t * 0.7 + i) * 40) % w + w) % w;
        const fy = h * 0.18 + ((i * 97 + Math.cos(t * 0.9 + i * 2) * 30) % (h * 0.74));
        const glow = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.5 + i * 1.4));
        ctx.fillStyle = `rgba(253, 224, 71, ${glow * 0.8})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawCourtSquares(ctx: CanvasRenderingContext2D, ct: CourtTransform, state: RenderState) {
    const baseChalkW = Math.max(2.6, ct.width * 0.011);
    const nextSquares = new Set(state.nextStep?.squares ?? []);

    for (const sq of state.squares) {
      const tl = projectCourt(ct, sq.x, sq.y);
      const tr = projectCourt(ct, sq.x + sq.w, sq.y);
      const br = projectCourt(ct, sq.x + sq.w, sq.y + sq.h);
      const bl = projectCourt(ct, sq.x, sq.y + sq.h);
      const center = projectCourt(ct, sq.x + sq.w / 2, sq.y + sq.h / 2);

      const owner = state.houses[sq.id];
      const isTarget =
        (state.phase === 'TOSS_AIM' || state.phase === 'STONE_FLIGHT') &&
        sq.id === state.targetSquareId;
      const isNextHop =
        (state.phase === 'HOP_OUT' || state.phase === 'HOP_BACK' || state.phase === 'HOP_EXIT') &&
        nextSquares.has(sq.id);
      const isFoulSq = state.foulFlashTimer > 0 && state.foulSquareId === sq.id;
      const hasStone = state.stonePlacedSquareId === sq.id && !state.stoneInHand;

      ctx.save();

      const traceSquarePath = () => {
        ctx.beginPath();
        if (sq.isHome) {
          const midTop = projectCourt(ct, sq.x + sq.w / 2, sq.y - sq.h * 0.14);
          const sideL = projectCourt(ct, sq.x, sq.y + sq.h * 0.45);
          const sideR = projectCourt(ct, sq.x + sq.w, sq.y + sq.h * 0.45);
          ctx.moveTo(bl.x, bl.y);
          ctx.lineTo(sideL.x, sideL.y);
          ctx.quadraticCurveTo(tl.x, tl.y, midTop.x, midTop.y);
          ctx.quadraticCurveTo(tr.x, tr.y, sideR.x, sideR.y);
          ctx.lineTo(br.x, br.y);
          ctx.closePath();
        } else {
          ctx.moveTo(tl.x, tl.y);
          ctx.lineTo(tr.x, tr.y);
          ctx.lineTo(br.x, br.y);
          ctx.lineTo(bl.x, bl.y);
          ctx.closePath();
        }
      };

      traceSquarePath();
      const isPuddle = state.puddleSquares.includes(sq.id);
      if (isFoulSq) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.34)';
      } else if (owner !== undefined) {
        ctx.fillStyle = owner === 0 ? 'rgba(22, 163, 74, 0.24)' : 'rgba(220, 38, 38, 0.24)';
      } else if (isNextHop) {
        const pulse = 0.22 + 0.08 * Math.sin(state.time * 6);
        ctx.fillStyle = `rgba(245, 158, 11, ${pulse})`;
      } else if (isTarget) {
        const pulse = 0.17 + 0.07 * Math.sin(state.time * 4.5);
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
      } else if (hasStone) {
        ctx.fillStyle = 'rgba(30, 14, 9, 0.22)';
      } else if (state.venue === 'entebbe_sand') {
        ctx.fillStyle = 'rgba(130, 86, 30, 0.12)';
      } else if (state.venue === 'ndere_night') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.07)';
      } else {
        ctx.fillStyle = 'rgba(42, 16, 9, 0.12)';
      }
      ctx.fill();

      // Standing rain puddle & animated ripple inside wet squares (Jinja Rainy Yard)
      if (isPuddle) {
        const boxW = br.x - bl.x;
        const boxH = bl.y - tl.y;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.26)';
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + boxH * 0.06, boxW * 0.34, boxH * 0.25, 0.12, 0, Math.PI * 2);
        ctx.fill();

        const ripplePhase = (state.time * 1.4 + sq.id * 0.37) % 1;
        ctx.strokeStyle = `rgba(224, 242, 254, ${0.55 * (1 - ripplePhase)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(
          center.x,
          center.y + boxH * 0.06,
          boxW * (0.1 + ripplePhase * 0.22),
          boxH * (0.07 + ripplePhase * 0.15),
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      // House chalk stencil inside owned squares
      if (owner !== undefined) {
        ctx.save();
        traceSquarePath();
        ctx.clip();
        const houseColor = owner === 0 ? 'rgba(134, 239, 172, 0.5)' : 'rgba(252, 165, 165, 0.5)';
        ctx.strokeStyle = houseColor;
        ctx.lineWidth = Math.max(1.4, baseChalkW * 0.45 * center.scale);
        const stencil = state.playerStencils[owner];
        const rw = br.x - bl.x;
        const rh = bl.y - tl.y;

        if (stencil === 'sunburst') {
          const rays = 12;
          const maxR = Math.max(rw, rh) * 0.72;
          for (let i = 0; i < rays; i++) {
            const a = (i / rays) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(center.x + Math.cos(a) * rw * 0.16, center.y + Math.sin(a) * rh * 0.16);
            ctx.lineTo(center.x + Math.cos(a) * maxR, center.y + Math.sin(a) * maxR);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.ellipse(center.x, center.y, rw * 0.22, rh * 0.24, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stencil === 'royal_drums') {
          for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            ctx.ellipse(
              center.x,
              center.y,
              rw * 0.13 * ring,
              rh * 0.14 * ring,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();
          }
        } else if (stencil === 'crested_crown') {
          for (let k = -1; k <= 1; k++) {
            const yOff = k * rh * 0.22;
            ctx.beginPath();
            ctx.moveTo(center.x - rw * 0.32, center.y + yOff + rh * 0.1);
            ctx.lineTo(center.x, center.y + yOff - rh * 0.12);
            ctx.lineTo(center.x + rw * 0.32, center.y + yOff + rh * 0.1);
            ctx.stroke();
          }
        } else {
          // Basket weave
          const step = Math.max(11, rw * 0.22);
          for (let d = -rh; d < rw + rh; d += step) {
            ctx.beginPath();
            ctx.moveTo(tl.x + d, tl.y);
            ctx.lineTo(bl.x + d + rh, bl.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tl.x + d + rh, tl.y);
            ctx.lineTo(bl.x + d, bl.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Earth groove under chalk line
      const lw = baseChalkW * (0.75 + 0.25 * center.scale);
      traceSquarePath();
      ctx.strokeStyle = 'rgba(36, 12, 6, 0.58)';
      ctx.lineWidth = lw + 2.8;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // White-lime chalk line
      traceSquarePath();
      if (isFoulSq) {
        ctx.strokeStyle = '#EF4444';
      } else if (isTarget || isNextHop) {
        ctx.strokeStyle = '#FCD34D';
      } else {
        ctx.strokeStyle = '#F7EFE2';
      }
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Square Number (perspective scaled)
      const boxW = br.x - bl.x;
      const boxH = bl.y - tl.y;
      const fontSize = Math.round(Math.min(boxW, boxH) * (sq.isHome ? 0.36 : 0.44));
      ctx.font = `800 ${fontSize}px "Bricolage Grotesque", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = 'rgba(32, 11, 5, 0.55)';
      ctx.fillText(String(sq.id), center.x + 1.5, center.y + 1.5);

      ctx.fillStyle =
        isTarget || isNextHop
          ? '#FEF08A'
          : owner === 0
            ? '#BBF7D0'
            : owner === 1
              ? '#FECACA'
              : 'rgba(250, 243, 232, 0.88)';
      ctx.fillText(String(sq.id), center.x, center.y);

      if (owner !== undefined) {
        ctx.font = `700 ${Math.max(9, Math.round(fontSize * 0.34))}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = owner === 0 ? '#86EFAC' : '#FCA5A5';
        ctx.fillText(owner === 0 ? 'CRANES' : 'WAVES', center.x, bl.y - Math.max(9, boxH * 0.16));
      } else if (sq.isHome) {
        ctx.font = `700 ${Math.max(9, Math.round(fontSize * 0.34))}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = 'rgba(250, 243, 232, 0.72)';
        ctx.fillText('EWAAKA', center.x, tl.y + boxH * 0.24);
      }

      if (isNextHop) {
        const rxRing = Math.min(boxW, boxH) * 0.34;
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.82)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, rxRing, rxRing * 0.78, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  private drawAimPreview(ctx: CanvasRenderingContext2D, ct: CourtTransform, state: RenderState) {
    const startPx = projectCourt(ct, state.playerX, state.playerY);
    const handStartY = startPx.y - ct.width * 0.1 * startPx.scale;
    const endPx = projectCourt(ct, state.predictedLandX, state.predictedLandY);

    ctx.save();
    ctx.strokeStyle = state.isCharging ? 'rgba(252, 211, 77, 0.92)' : 'rgba(250, 243, 232, 0.45)';
    ctx.lineWidth = state.isCharging ? 2.5 : 1.75;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(startPx.x, handStartY);
    const midX = (startPx.x + endPx.x) / 2;
    const midY = Math.min(handStartY, endPx.y) - ct.height * 0.1;
    ctx.quadraticCurveTo(midX, midY, endPx.x, endPx.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Perspective landing ellipse on ground
    const ringR = Math.max(11, ct.width * 0.042 * endPx.scale);
    ctx.strokeStyle = state.isCharging ? '#FBBF24' : 'rgba(250, 243, 232, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(endPx.x, endPx.y, ringR, ringR * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (state.isCharging) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(endPx.x, endPx.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power bar below baseline
    const barW = ct.width * 0.36;
    const barH = 8;
    const barX = ct.left + ct.width * 0.5 - barW / 2;
    const barY = ct.top + ct.height * 0.975;

    ctx.fillStyle = 'rgba(24, 11, 7, 0.72)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = state.isCharging ? '#F59E0B' : 'rgba(250, 243, 232, 0.25)';
    ctx.beginPath();
    ctx.roundRect(barX + 1.5, barY + 1.5, Math.max(0, (barW - 3) * state.aimPower), barH - 3, 3);
    ctx.fill();

    ctx.restore();
  }

  private drawStone(ctx: CanvasRenderingContext2D, ct: CourtTransform, state: RenderState) {
    const pos = projectCourt(ct, state.stoneX, state.stoneY);
    const baseR = Math.max(8, ct.width * 0.032 * pos.scale);
    const r = baseR * (1 + state.stoneZ * 0.9);

    ctx.save();
    const shadowX = pos.x + state.stoneZ * ct.width * 0.06;
    const shadowY = pos.y + state.stoneZ * ct.height * 0.04 + 2;
    ctx.fillStyle = `rgba(22, 8, 4, ${Math.max(0.18, 0.48 - state.stoneZ * 0.35)})`;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, baseR * 1.05, baseR * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    if (state.phase === 'PICKUP_STONE') {
      const pulse = 1 + 0.22 * Math.sin(state.time * 7);
      ctx.strokeStyle = '#FCD34D';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, r * 1.55 * pulse, r * 1.1 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const drawY = pos.y - state.stoneZ * ct.height * 0.28;
    ctx.translate(pos.x, drawY);
    ctx.rotate(state.stoneRot);

    const spec = state.activeStoneSpec;
    const stoneGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    stoneGrad.addColorStop(0, spec.coreColor);
    stoneGrad.addColorStop(0.55, spec.midColor);
    stoneGrad.addColorStop(1, spec.edgeColor);
    ctx.fillStyle = stoneGrad;

    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.72, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = spec.motif === 'ember' ? spec.motifColor : 'rgba(255, 250, 240, 0.48)';
    ctx.lineWidth = spec.motif === 'ember' ? 2 : 1.2;
    ctx.stroke();

    ctx.strokeStyle = spec.motifColor;
    ctx.fillStyle = spec.motifColor;
    ctx.lineWidth = 1.4;
    if (spec.motif === 'spiral') {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 3.5; a += 0.35) {
        const sr = (a / (Math.PI * 3.5)) * r * 0.52;
        const sx = Math.cos(a) * sr;
        const sy = Math.sin(a) * sr * 0.75;
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    } else if (spec.motif === 'cowrie') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.3, r * 0.12, r * 0.08, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (spec.motif === 'sunburst') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.26);
        ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.48);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.36, r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawActiveHuman(ctx: CanvasRenderingContext2D, ct: CourtTransform, state: RenderState) {
    const pos = projectCourt(ct, state.playerX, state.playerY);
    const facingTowardCamera = Math.sin(state.playerFacing) > 0;
    this.drawHumanFigure(ctx, {
      px: pos.x,
      py: pos.y,
      zLift: state.playerZ * ct.height * 0.18,
      scale: ct.width * 0.19 * pos.scale,
      squashX: state.playerSquashX,
      squashY: state.playerSquashY,
      stance: state.playerStance,
      balanceSway: state.balanceSway,
      facingCamera: facingTowardCamera,
      hairStyle: state.activeHairStyle,
      skinTone: state.activeSkinTone,
      primaryColor: state.playerColors[state.activeTeamId],
      accentColor: state.playerAccents[state.activeTeamId],
      stoneInHand: state.stoneInHand ? state.activeStoneSpec : null,
      cheerPhase: null,
    });
  }

  private drawSidelineHuman(
    ctx: CanvasRenderingContext2D,
    ct: CourtTransform,
    time: number,
    mate: SidelineCharacter
  ) {
    const pos = projectCourt(ct, mate.nx, mate.ny);
    const bob = Math.abs(Math.sin(time * (mate.cheering ? 6 : 2.2) + mate.id)) * 0.04;
    this.drawHumanFigure(ctx, {
      px: pos.x,
      py: pos.y,
      zLift: mate.cheering ? bob * ct.height * 0.18 : 0,
      scale: ct.width * 0.175 * pos.scale,
      squashX: 1,
      squashY: 1,
      stance: 'TWO_FEET',
      balanceSway: Math.sin(time * 2 + mate.id) * 0.04,
      facingCamera: true,
      hairStyle: mate.hairStyle,
      skinTone: mate.skinTone,
      primaryColor: mate.primaryColor,
      accentColor: mate.accentColor,
      stoneInHand: null,
      cheerPhase: mate.cheering ? time * 7 + mate.id : time * 1.5 + mate.id,
    });
  }

  /**
   * Renders a full articulated 2.5D human character wearing Kitenge garments, sandals, and hairstyle.
   */
  private drawHumanFigure(
    ctx: CanvasRenderingContext2D,
    cfg: {
      px: number;
      py: number;
      zLift: number;
      scale: number;
      squashX: number;
      squashY: number;
      stance: 'TWO_FEET' | 'LEFT_FOOT' | 'RIGHT_FOOT' | 'BENDING';
      balanceSway: number;
      facingCamera: boolean;
      hairStyle: 'braids' | 'afro' | 'bun' | 'fade';
      skinTone: string;
      primaryColor: string;
      accentColor: string;
      stoneInHand: StoneCatalogItem | null;
      cheerPhase: number | null;
    }
  ) {
    const {
      px,
      py,
      zLift,
      scale: h,
      squashX,
      squashY,
      stance,
      balanceSway,
      facingCamera,
      hairStyle,
      skinTone,
      primaryColor,
      accentColor,
      stoneInHand,
      cheerPhase,
    } = cfg;
    const w = h * 0.42;

    ctx.save();

    // 1. Ground Shadow directly at feet position
    const shadowRatio = Math.max(0.5, 1 - zLift / (h * 1.6));
    ctx.fillStyle = `rgba(20, 8, 4, ${0.42 * shadowRatio})`;
    ctx.beginPath();
    ctx.ellipse(px, py + 2, w * 0.65 * shadowRatio, w * 0.28 * shadowRatio, 0, 0, Math.PI * 2);
    ctx.fill();

    // Translate to feet pivot, apply jump lift, balance lean & squash-stretch
    ctx.translate(px, py - zLift);
    ctx.rotate(balanceSway * 0.18);
    ctx.scale(squashX, squashY);

    const isBending = stance === 'BENDING';
    const torsoBendOffset = isBending ? h * 0.14 : 0;

    // 2. Articulated Legs & Sandals
    const hipY = -h * 0.41 + torsoBendOffset * 0.5;
    const drawLeg = (hipX: number, footX: number, footY: number, kneeBendX: number, kneeBendY: number) => {
      ctx.save();
      // Thigh & Shin
      ctx.strokeStyle = skinTone;
      ctx.lineWidth = Math.max(4, w * 0.22);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeBendX, kneeBendY);
      ctx.lineTo(footX, footY - 2);
      ctx.stroke();

      // Sandal sole + strap
      ctx.fillStyle = '#3E2723';
      ctx.beginPath();
      ctx.ellipse(footX, footY, w * 0.16, w * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(footX, footY - 1, w * 0.11, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    };

    if (stance === 'TWO_FEET') {
      drawLeg(-w * 0.19, -w * 0.25, 0, -w * 0.24, -h * 0.21);
      drawLeg(w * 0.19, w * 0.25, 0, w * 0.24, -h * 0.21);
    } else if (stance === 'LEFT_FOOT') {
      // Right leg tucked up playfully behind!
      drawLeg(w * 0.16, w * 0.36, -h * 0.16, w * 0.44, -h * 0.27);
      // Left leg planted
      drawLeg(-w * 0.12, -w * 0.05, 0, -w * 0.1, -h * 0.2);
    } else if (stance === 'RIGHT_FOOT') {
      // Left leg tucked up
      drawLeg(-w * 0.16, -w * 0.36, -h * 0.16, -w * 0.44, -h * 0.27);
      // Right leg planted
      drawLeg(w * 0.12, w * 0.05, 0, w * 0.1, -h * 0.2);
    } else {
      // BENDING scoop pose
      drawLeg(-w * 0.15, -w * 0.12, 0, -w * 0.22, -h * 0.18);
      drawLeg(w * 0.16, w * 0.32, -h * 0.12, w * 0.36, -h * 0.22);
    }

    // 3. Lower Shorts / Kitenge Wrap Skirt
    ctx.fillStyle = '#291711';
    ctx.strokeStyle = '#180B07';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-w * 0.34, hipY - h * 0.05, w * 0.68, h * 0.14, 4);
    ctx.fill();
    ctx.stroke();

    // 4. Torso & Kitenge Tunic (with live geometric Kitenge pattern!)
    const shoulderY = -h * 0.72 + torsoBendOffset;
    const waistY = hipY + h * 0.02;

    const traceTunic = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 0.38, shoulderY);
      ctx.lineTo(w * 0.38, shoulderY);
      ctx.lineTo(w * 0.44, waistY);
      ctx.lineTo(-w * 0.44, waistY);
      ctx.closePath();
    };

    traceTunic();
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Geometric Kitenge fabric print clipped inside tunic!
    ctx.save();
    traceTunic();
    ctx.clip();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1.2, w * 0.04);
    ctx.globalAlpha = 0.65;
    // Diamond weave across tunic
    for (let i = -2; i <= 2; i++) {
      const cx = i * w * 0.22;
      const cy = (shoulderY + waistY) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.09);
      ctx.lineTo(cx + w * 0.1, cy);
      ctx.lineTo(cx, cy + h * 0.09);
      ctx.lineTo(cx - w * 0.1, cy);
      ctx.closePath();
      ctx.stroke();
    }
    // Bright Kitenge waist sash
    ctx.globalAlpha = 1;
    ctx.fillStyle = accentColor;
    ctx.fillRect(-w * 0.46, waistY - h * 0.055, w * 0.92, h * 0.045);
    ctx.restore();

    traceTunic();
    ctx.strokeStyle = '#180B07';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 5. Articulated Arms
    const armSpread = stance === 'TWO_FEET' ? 0.56 : 0.88;
    const armLiftL =
      cheerPhase !== null
        ? -h * 0.14 - Math.max(0, Math.sin(cheerPhase)) * h * 0.18
        : balanceSway * h * 0.1;
    const armLiftR =
      cheerPhase !== null
        ? -h * 0.14 - Math.max(0, Math.cos(cheerPhase)) * h * 0.18
        : isBending
          ? h * 0.28
          : -balanceSway * h * 0.1;

    ctx.strokeStyle = skinTone;
    ctx.lineWidth = Math.max(3.5, w * 0.17);
    ctx.lineCap = 'round';

    // Left arm
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, shoulderY + h * 0.04);
    ctx.lineTo(-w * armSpread, shoulderY + h * 0.12 + armLiftL);
    ctx.stroke();

    // Right arm
    const rightHandX = isBending ? w * 0.28 : w * armSpread;
    const rightHandY = shoulderY + h * 0.12 + armLiftR;
    ctx.beginPath();
    ctx.moveTo(w * 0.36, shoulderY + h * 0.04);
    ctx.lineTo(rightHandX, rightHandY);
    ctx.stroke();

    // Stone held in hand
    if (stoneInHand) {
      ctx.fillStyle = stoneInHand.midColor;
      ctx.strokeStyle = stoneInHand.motifColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(rightHandX, rightHandY, w * 0.15, w * 0.11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Neck & Head
    const headY = shoulderY - h * 0.14;
    const headR = h * 0.125;

    // Neck
    ctx.fillStyle = skinTone;
    ctx.fillRect(-w * 0.1, shoulderY - h * 0.06, w * 0.2, h * 0.08);

    // Hair back layer (if braids or afro)
    ctx.fillStyle = '#1E110B';
    if (hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(0, headY - headR * 0.22, headR * 1.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 'braids') {
      for (let b = -2; b <= 2; b++) {
        ctx.beginPath();
        ctx.roundRect(b * headR * 0.34 - 2.5, headY - headR * 0.5, 5, headR * 1.55, 2.5);
        ctx.fill();
      }
    } else if (hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(0, headY - headR * 1.05, headR * 0.52, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head base
    ctx.fillStyle = skinTone;
    ctx.strokeStyle = '#180B07';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hair crown & woven headband
    ctx.fillStyle = '#1E110B';
    ctx.beginPath();
    if (facingCamera) {
      ctx.arc(0, headY - headR * 0.1, headR * 1.02, Math.PI, 0);
    } else {
      ctx.arc(0, headY, headR * 1.02, 0, Math.PI * 2);
    }
    ctx.fill();

    // Woven Ugandan headband
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(2.5, headR * 0.24);
    ctx.beginPath();
    ctx.moveTo(-headR * 0.92, headY - headR * 0.25);
    ctx.quadraticCurveTo(0, headY - headR * 0.42, headR * 0.92, headY - headR * 0.25);
    ctx.stroke();

    // Face eyes & warm smile when facing toward the camera
    if (facingCamera) {
      ctx.fillStyle = '#180B07';
      ctx.beginPath();
      ctx.arc(-headR * 0.33, headY + headR * 0.05, Math.max(1.4, headR * 0.11), 0, Math.PI * 2);
      ctx.arc(headR * 0.33, headY + headR * 0.05, Math.max(1.4, headR * 0.11), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2B130B';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, headY + headR * 0.3, headR * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawWorldBalanceArc(ctx: CanvasRenderingContext2D, ct: CourtTransform, state: RenderState) {
    const pos = projectCourt(ct, state.playerX, state.playerY);
    const charH = ct.width * 0.19 * pos.scale;
    const py = pos.y - state.playerZ * ct.height * 0.18 - charH - 14;
    const arcW = Math.max(54, ct.width * 0.18 * pos.scale);

    ctx.save();
    ctx.fillStyle = 'rgba(20, 9, 5, 0.78)';
    ctx.beginPath();
    ctx.roundRect(pos.x - arcW / 2, py - 4, arcW, 8, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(250, 243, 232, 0.38)';
    ctx.fillRect(pos.x - 1, py - 5, 2, 10);

    const dotX = pos.x + Math.max(-1, Math.min(1, state.balanceSway)) * (arcW / 2 - 5);
    const isDanger = state.balance < 35;
    ctx.fillStyle = isDanger ? '#EF4444' : state.balance < 65 ? '#FBBF24' : '#22C55E';
    ctx.beginPath();
    ctx.arc(dotX, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
