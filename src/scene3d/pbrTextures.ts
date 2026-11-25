import * as THREE from 'three';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix: number, iy: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoiseTile(u: number, v: number, freq: number, seed: number): number {
  const fx = u * freq;
  const fy = v * freq;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const a = hash2D(ix, iy, freq, seed);
  const b = hash2D(ix + 1, iy, freq, seed);
  const c = hash2D(ix, iy + 1, freq, seed);
  const d = hash2D(ix + 1, iy + 1, freq, seed);

  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sy;
}

function fbmTile(u: number, v: number, baseFreq: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o++) {
    sum += smoothNoiseTile(u, v, freq, seed + o * 97) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function configureTexture<T extends THREE.Texture>(
  tex: T,
  maxAnisotropy: number,
  isColor: boolean,
  repeat = true
): T {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  tex.userData.__sharedCacheResource = true;
  tex.needsUpdate = true;
  return tex;
}

function buildNormalFromHeight(
  heights: Float32Array,
  size: number,
  strength: number,
  maxAnisotropy: number
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const hL = heights[y * size + xm];
      const hR = heights[y * size + xp];
      const hU = heights[ym * size + x];
      const hD = heights[yp * size + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return configureTexture(tex, maxAnisotropy, false, true);
}

function buildRoughnessFromField(
  field: Float32Array,
  size: number,
  maxAnisotropy: number
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.round(field[i] * 255)));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return configureTexture(tex, maxAnisotropy, false, true);
}

export interface CompoundTextureLibrary {
  murramAlbedo: THREE.CanvasTexture;
  murramNormal: THREE.DataTexture;
  murramRoughness: THREE.DataTexture;
  murramAO: THREE.DataTexture;
  chalkOverlay: THREE.CanvasTexture;
  plasterAlbedo: THREE.CanvasTexture;
  plasterNormal: THREE.DataTexture;
  brickAlbedo: THREE.CanvasTexture;
  brickNormal: THREE.DataTexture;
  brickRoughness: THREE.DataTexture;
  mabatiAlbedo: THREE.CanvasTexture;
  mabatiNormal: THREE.DataTexture;
  mabatiRoughness: THREE.DataTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkNormal: THREE.DataTexture;
  timberAlbedo: THREE.CanvasTexture;
  timberNormal: THREE.DataTexture;
  reedMatAlbedo: THREE.CanvasTexture;
  mangoLeafMap: THREE.CanvasTexture;
  bananaLeafMap: THREE.CanvasTexture;
  grassTuftMap: THREE.CanvasTexture;
  skinNormal: THREE.DataTexture;
  skinRoughness: THREE.DataTexture;
  hairNormal: THREE.DataTexture;
  cottonNormal: THREE.DataTexture;
  kitengeSkirtAlbedo: THREE.CanvasTexture;
  plaidDressAlbedo: THREE.CanvasTexture;
  redJerseyAlbedo: THREE.CanvasTexture;
  disposeAll: () => void;
}

export function createCompoundTextures(maxAnisotropy: number): CompoundTextureLibrary {
  const created: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    created.push(t);
    return t;
  };

  // 1. Ugandan Laterite Red Murram Soil (512x512 seamless PBR: Albedo + Normal + Roughness + AO — 4x faster startup!)
  const mSize = 512;
  const mCanvas = document.createElement('canvas');
  mCanvas.width = mSize;
  mCanvas.height = mSize;
  const mCtx = mCanvas.getContext('2d')!;
  const mImg = mCtx.createImageData(mSize, mSize);
  const mHeight = new Float32Array(mSize * mSize);
  const mRough = new Float32Array(mSize * mSize);
  const mAOField = new Float32Array(mSize * mSize);
  const mRng = mulberry32(4102);

  for (let y = 0; y < mSize; y++) {
    const v = y / mSize;
    for (let x = 0; x < mSize; x++) {
      const u = x / mSize;
      const macro = fbmTile(u, v, 4, 3, 11);
      const mid = fbmTile(u, v, 16, 2, 47);
      const grit = smoothNoiseTile(u, v, 96, 93);
      const fine = smoothNoiseTile(u, v, 192, 173);

      // Compacted clay mask (smooth foot-tamped patches) vs looser powdery soil
      const compactMask = Math.max(0, Math.min(1, (0.54 - macro) * 2.4));

      // Subtle hand-swept yard broom striations on dry topsoil
      const sweepWave =
        Math.sin((u * 4.0 + Math.sin(v * Math.PI * 2) * 0.18 + (mid - 0.5) * 0.25) * Math.PI * 26) *
          0.5 +
        0.5;
      const sweep = sweepWave * (1 - compactMask * 0.65) * 0.045;

      // Subtle baked-earth desiccation hairline cracks
      const crackSignal = Math.abs(fbmTile(u, v, 8, 3, 211) - 0.5);
      const crack = crackSignal < 0.014 ? (0.014 - crackSignal) * 34 : 0;

      const h =
        macro * 0.34 +
        mid * 0.26 +
        grit * 0.19 +
        fine * 0.11 +
        sweep -
        crack * 0.48;

      const idxPix = y * mSize + x;
      mHeight[idxPix] = h;

      // Compacted clay has smoother sheen (0.66-0.78); loose dusty clay & cracks stay matte (0.88-0.98)
      const baseRough = 0.89 - compactMask * 0.17 + (0.5 - mid) * 0.1 + crack * 0.22;
      mRough[idxPix] = Math.min(0.98, Math.max(0.66, baseRough));
      mAOField[idxPix] = Math.max(0.45, 1.0 - crack * 0.55 - (1 - mid) * 0.08);

      // Authentic Kampala laterite color shifts: compacted dark red iron clay vs sunlit dusty ochre
      const dustMix = Math.max(0, macro - 0.5) * 1.45;
      const compactedDark = compactMask * 0.32;
      const speckle = (mRng() - 0.5) * 9;

      let r = 134 + (mid - 0.5) * 30 + dustMix * 28 - compactedDark * 26 + speckle;
      let g = 66 + (mid - 0.5) * 17 + dustMix * 22 - compactedDark * 18 + speckle * 0.6;
      let b = 43 + (mid - 0.5) * 12 + dustMix * 15 - compactedDark * 12 + speckle * 0.4;

      if (crack > 0.08) {
        const cr = Math.min(0.45, crack * 0.55);
        r *= 1 - cr;
        g *= 1 - cr;
        b *= 1 - cr;
      }

      const idx = idxPix * 4;
      mImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      mImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      mImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      mImg.data[idx + 3] = 255;
    }
  }

  // Stamp 950 seamless embedded small laterite & quartz pebbles + grit clods into albedo, height, roughness, and AO
  const pebbleTones: Array<[number, number, number, number]> = [
    [74, 38, 28, 0.62],
    [108, 52, 34, 0.66],
    [60, 42, 36, 0.55],
    [164, 148, 130, 0.48],
    [126, 78, 55, 0.72],
  ];

  for (let p = 0; p < 950; p++) {
    const cx = mRng() * mSize;
    const cy = mRng() * mSize;
    const tier = p < 120 ? 2 : p < 440 ? 1 : 0;
    const rx =
      (tier === 2
        ? 4.2 + mRng() * 5.2
        : tier === 1
          ? 2.1 + mRng() * 2.5
          : 1.1 + mRng() * 1.3) * 0.55;
    const ry = rx * (0.65 + mRng() * 0.45);
    const rot = mRng() * Math.PI;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const [pr, pg, pb, pRough] = pebbleTones[Math.floor(mRng() * pebbleTones.length)];
    const bound = Math.ceil(Math.max(rx + 2.0, ry + 2.0));

    for (let dy = -bound; dy <= bound; dy++) {
      const py = (((Math.floor(cy) + dy) % mSize) + mSize) % mSize;
      for (let dx = -bound; dx <= bound; dx++) {
        const px = (((Math.floor(cx) + dx) % mSize) + mSize) % mSize;
        const lx = dx * cosR + dy * sinR;
        const ly = -dx * sinR + dy * cosR;
        const distNorm = Math.sqrt((lx / rx) * (lx / rx) + (ly / ry) * (ly / ry));
        const pixIdx = py * mSize + px;

        if (distNorm <= 1.0) {
          const dome = Math.sqrt(Math.max(0, 1 - distNorm * distNorm));
          const edgeBlend = distNorm > 0.78 ? (1 - distNorm) / 0.22 : 1.0;
          mHeight[pixIdx] += dome * (tier === 2 ? 0.55 : tier === 1 ? 0.36 : 0.2);
          mRough[pixIdx] = mRough[pixIdx] * (1 - edgeBlend) + pRough * edgeBlend;
          mAOField[pixIdx] = Math.min(1, mAOField[pixIdx] * (0.85 + dome * 0.22));

          const shade = 0.88 + dome * 0.22;
          const idx = pixIdx * 4;
          mImg.data[idx] = Math.max(
            0,
            Math.min(255, Math.round(mImg.data[idx] * (1 - edgeBlend) + pr * shade * edgeBlend))
          );
          mImg.data[idx + 1] = Math.max(
            0,
            Math.min(255, Math.round(mImg.data[idx + 1] * (1 - edgeBlend) + pg * shade * edgeBlend))
          );
          mImg.data[idx + 2] = Math.max(
            0,
            Math.min(255, Math.round(mImg.data[idx + 2] * (1 - edgeBlend) + pb * shade * edgeBlend))
          );
        } else if (distNorm <= 1.38) {
          const moat = 1 - (distNorm - 1.0) / 0.38;
          mHeight[pixIdx] -= moat * 0.08;
          mAOField[pixIdx] *= 1 - moat * 0.22;
        }
      }
    }
  }

  mCtx.putImageData(mImg, 0, 0);

  const murramAlbedo = track(configureTexture(new THREE.CanvasTexture(mCanvas), maxAnisotropy, true, true));
  const murramNormal = track(buildNormalFromHeight(mHeight, mSize, 5.4, maxAnisotropy));
  const murramRoughness = track(buildRoughnessFromField(mRough, mSize, maxAnisotropy));
  const murramAO = track(buildRoughnessFromField(mAOField, mSize, maxAnisotropy));

  // 2. Hand-Drawn Dusty Chalk Sonko Court Overlay (512x1024 RGBA)
  const chW = 512;
  const chH = 1024;
  const chCanvas = document.createElement('canvas');
  chCanvas.width = chW;
  chCanvas.height = chH;
  const chCtx = chCanvas.getContext('2d')!;
  const chRng = mulberry32(9021);

  const drawChalkStroke = (x1: number, y1: number, x2: number, y2: number, width = 9) => {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(12, Math.floor(dist / 2.2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Subtle hand tremor
      const wobbleX = (Math.sin(t * 21 + x1 * 0.1) + (chRng() - 0.5) * 0.8) * 1.5;
      const wobbleY = (Math.cos(t * 17 + y1 * 0.1) + (chRng() - 0.5) * 0.8) * 1.5;
      const px = x1 + (x2 - x1) * t + wobbleX;
      const py = y1 + (y2 - y1) * t + wobbleY;

      // Occasional foot-scuffed chalk breaks so lines feel played-on
      const scuff = Math.sin(t * 13 + x1 * 0.05) * Math.cos(t * 7 + y2 * 0.04);
      const alpha = scuff > 0.68 ? 0.14 : 0.58 + chRng() * 0.34;
      const rad = width * (0.42 + chRng() * 0.25);

      chCtx.fillStyle = `rgba(244, 236, 222, ${alpha.toFixed(3)})`;
      chCtx.beginPath();
      chCtx.arc(px, py, rad, 0, Math.PI * 2);
      chCtx.fill();

      // Powdery dust halo beside main chalk stroke
      if (chRng() > 0.45) {
        chCtx.fillStyle = `rgba(238, 226, 206, ${(alpha * 0.28).toFixed(3)})`;
        chCtx.beginPath();
        chCtx.arc(
          px + (chRng() - 0.5) * width * 1.3,
          py + (chRng() - 0.5) * width * 1.3,
          rad * 0.55,
          0,
          Math.PI * 2
        );
        chCtx.fill();
      }
    }
  };

  const drawChalkBox = (x: number, y: number, w: number, h: number, label: string) => {
    drawChalkStroke(x, y, x + w, y);
    drawChalkStroke(x + w, y, x + w, y + h);
    drawChalkStroke(x + w, y + h, x, y + h);
    drawChalkStroke(x, y + h, x, y);

    // Chalk numeral inside box (rough chalk brush feel)
    chCtx.save();
    chCtx.font = 'bold 46px Georgia, serif';
    chCtx.textAlign = 'center';
    chCtx.textBaseline = 'middle';
    chCtx.fillStyle = 'rgba(242, 232, 216, 0.54)';
    chCtx.fillText(label, x + w * 0.5, y + h * 0.52);
    chCtx.restore();
  };

  // Classic 10-square Ugandan Sonko layout from bottom (Square 1) up to Ewaaka (10)
  const sqW = 148;
  const sqH = 104;
  const cx = chW * 0.5;
  const baseBottom = chH - 54;
  const yRow = (r: number) => baseBottom - (r + 1) * sqH;

  drawChalkBox(cx - sqW * 0.5, yRow(0), sqW, sqH, '1');
  drawChalkBox(cx - sqW * 0.5, yRow(1), sqW, sqH, '2');
  drawChalkBox(cx - sqW * 0.5, yRow(2), sqW, sqH, '3');
  drawChalkBox(cx - sqW, yRow(3), sqW, sqH, '4');
  drawChalkBox(cx, yRow(3), sqW, sqH, '5');
  drawChalkBox(cx - sqW * 0.5, yRow(4), sqW, sqH, '6');
  drawChalkBox(cx - sqW, yRow(5), sqW, sqH, '7');
  drawChalkBox(cx, yRow(5), sqW, sqH, '8');
  drawChalkBox(cx - sqW * 0.5, yRow(6), sqW, sqH, '9');

  // Ewaaka (10) rounded top arch
  const homeY = yRow(7);
  drawChalkBox(cx - sqW * 0.78, homeY, sqW * 1.56, sqH, '10');
  // Subtle rounded chalk semi-circle crown above 10
  const crownSteps = 36;
  for (let i = 0; i < crownSteps; i++) {
    const a1 = Math.PI + (i / crownSteps) * Math.PI;
    const a2 = Math.PI + ((i + 1) / crownSteps) * Math.PI;
    const rx = sqW * 0.78;
    const ry = 38;
    drawChalkStroke(
      cx + Math.cos(a1) * rx,
      homeY + Math.sin(a1) * ry,
      cx + Math.cos(a2) * rx,
      homeY + Math.sin(a2) * ry,
      7
    );
  }

  const chalkOverlay = track(
    configureTexture(new THREE.CanvasTexture(chCanvas), maxAnisotropy, true, false)
  );

  // 3. Kampala Weathered Limewash Plaster House Wall (512x512 with lower red-earth rain splash!)
  const pSize = 512;
  const pCanvas = document.createElement('canvas');
  pCanvas.width = pSize;
  pCanvas.height = pSize;
  const pCtx = pCanvas.getContext('2d')!;
  const pImg = pCtx.createImageData(pSize, pSize);
  const pHeight = new Float32Array(pSize * pSize);

  for (let y = 0; y < pSize; y++) {
    const v = y / pSize; // 0 = top, 1 = bottom near ground
    for (let x = 0; x < pSize; x++) {
      const u = x / pSize;
      const stucco = fbmTile(u, v, 14, 4, 501);
      const streak = smoothNoiseTile(u * 2.5, v * 0.35, 6, 513);
      const fine = smoothNoiseTile(u, v, 64, 521);

      pHeight[y * pSize + x] = stucco * 0.7 + fine * 0.3;

      // Warm cream-ochre Kampala cement plaster
      let r = 214 + (stucco - 0.5) * 26 - streak * 14;
      let g = 197 + (stucco - 0.5) * 24 - streak * 16;
      let b = 171 + (stucco - 0.5) * 22 - streak * 16;

      // Authentic red laterite rain-splash staining along the bottom 25% of wall
      const splashEdge = 0.76 + (fbmTile(u, v, 6, 3, 557) - 0.5) * 0.14;
      if (v > splashEdge) {
        const sp = Math.min(1, (v - splashEdge) / 0.22);
        const splashMix = sp * (0.48 + stucco * 0.32);
        r = r * (1 - splashMix) + 148 * splashMix;
        g = g * (1 - splashMix) + 86 * splashMix;
        b = b * (1 - splashMix) + 60 * splashMix;
      }

      const idx = (y * pSize + x) * 4;
      pImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      pImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      pImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      pImg.data[idx + 3] = 255;
    }
  }
  pCtx.putImageData(pImg, 0, 0);
  const plasterAlbedo = track(
    configureTexture(new THREE.CanvasTexture(pCanvas), maxAnisotropy, true, true)
  );
  const plasterNormal = track(buildNormalFromHeight(pHeight, pSize, 2.2, maxAnisotropy));

  // 4. Kiln-Fired Ugandan Clay Brick Compound Wall (512x512 running bond PBR)
  const bSize = 512;
  const bCanvas = document.createElement('canvas');
  bCanvas.width = bSize;
  bCanvas.height = bSize;
  const bCtx = bCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(bSize, bSize);
  const bHeight = new Float32Array(bSize * bSize);
  const bRough = new Float32Array(bSize * bSize);

  const brickRows = 12;
  const brickCols = 6;
  const rowH = bSize / brickRows;
  const colW = bSize / brickCols;
  const mortarPx = 5;

  for (let y = 0; y < bSize; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const isHorizMortar = localY < mortarPx * 0.5 || localY > rowH - mortarPx * 0.5;
    const stagger = (row % 2) * (colW * 0.5);

    for (let x = 0; x < bSize; x++) {
      const sx = (x + stagger) % bSize;
      const col = Math.floor(sx / colW);
      const localX = sx - col * colW;
      const isVertMortar = localX < mortarPx * 0.5 || localX > colW - mortarPx * 0.5;
      const u = x / bSize;
      const v = y / bSize;
      const grit = fbmTile(u, v, 24, 3, 601);

      const idx = (y * bSize + x) * 4;
      if (isHorizMortar || isVertMortar) {
        // Recessed sandy cement mortar
        bHeight[y * bSize + x] = 0.15 + grit * 0.15;
        bRough[y * bSize + x] = 0.96;
        const m = 152 + (grit - 0.5) * 34;
        bImg.data[idx] = m;
        bImg.data[idx + 1] = m - 8;
        bImg.data[idx + 2] = m - 18;
        bImg.data[idx + 3] = 255;
      } else {
        // Kiln-fired handmade brick tone variation
        const bh = hash2D(col, row, 16, 619);
        const kilnDark = bh > 0.8 ? 0.72 : bh < 0.2 ? 1.12 : 0.95;
        bHeight[y * bSize + x] = 0.65 + grit * 0.35;
        bRough[y * bSize + x] = 0.86 + (grit - 0.5) * 0.12;

        const r = (146 + (bh - 0.5) * 28 + (grit - 0.5) * 26) * kilnDark;
        const g = (74 + (bh - 0.5) * 16 + (grit - 0.5) * 18) * kilnDark;
        const b = (50 + (bh - 0.5) * 12 + (grit - 0.5) * 14) * kilnDark;
        bImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        bImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        bImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        bImg.data[idx + 3] = 255;
      }
    }
  }
  bCtx.putImageData(bImg, 0, 0);
  const brickAlbedo = track(
    configureTexture(new THREE.CanvasTexture(bCanvas), maxAnisotropy, true, true)
  );
  const brickNormal = track(buildNormalFromHeight(bHeight, bSize, 4.5, maxAnisotropy));
  const brickRoughness = track(buildRoughnessFromField(bRough, bSize, maxAnisotropy));

  // 5. Corrugated Galvanized Mabati Iron Roof Sheet (512x512 sinusoidal normal + oxidized patina)
  const rSize = 512;
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rSize;
  rCanvas.height = rSize;
  const rCtx = rCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(rSize, rSize);
  const rHeight = new Float32Array(rSize * rSize);
  const rRough = new Float32Array(rSize * rSize);

  const ridges = 18;
  for (let y = 0; y < rSize; y++) {
    const v = y / rSize;
    for (let x = 0; x < rSize; x++) {
      const u = x / rSize;
      const wave = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * ridges);
      const streak = fbmTile(u * 2, v * 0.4, 8, 3, 701);
      const rustMask = Math.max(0, fbmTile(u, v, 7, 3, 733) - 0.58) * 2.4;
      const sheetSeam = Math.abs(v - 0.5) < 0.014 ? 1 : 0;

      rHeight[y * rSize + x] = wave * 0.85 + (streak - 0.5) * 0.08 - sheetSeam * 0.12;
      rRough[y * rSize + x] = Math.min(0.92, 0.34 + rustMask * 0.48 + (1 - wave) * 0.1);

      // Sun-weathered zinc-grey steel + subtle reddish rust patina in valleys & seams
      let r = 152 + wave * 28 - (streak - 0.5) * 26;
      let g = 154 + wave * 28 - (streak - 0.5) * 26;
      let b = 156 + wave * 28 - (streak - 0.5) * 24;

      if (rustMask > 0.05 || sheetSeam) {
        const rm = Math.min(0.85, rustMask + sheetSeam * 0.45);
        r = r * (1 - rm) + 128 * rm;
        g = g * (1 - rm) + 68 * rm;
        b = b * (1 - rm) + 46 * rm;
      }

      const idx = (y * rSize + x) * 4;
      rImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      rImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rImg.data[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);
  const mabatiAlbedo = track(
    configureTexture(new THREE.CanvasTexture(rCanvas), maxAnisotropy, true, true)
  );
  const mabatiNormal = track(buildNormalFromHeight(rHeight, rSize, 4.2, maxAnisotropy));
  const mabatiRoughness = track(buildRoughnessFromField(rRough, rSize, maxAnisotropy));

  // 6. Mango Tree Fissured Bark (512x512)
  const kSize = 512;
  const kCanvas = document.createElement('canvas');
  kCanvas.width = kSize;
  kCanvas.height = kSize;
  const kCtx = kCanvas.getContext('2d')!;
  const kImg = kCtx.createImageData(kSize, kSize);
  const kHeight = new Float32Array(kSize * kSize);

  for (let y = 0; y < kSize; y++) {
    const v = y / kSize;
    for (let x = 0; x < kSize; x++) {
      const u = x / kSize;
      const furrow = fbmTile(u * 2.4, v * 0.45, 10, 4, 809);
      const ridge = Math.sin(u * 46 + furrow * 5.2) * 0.5 + 0.5;
      const lichen = Math.max(0, fbmTile(u, v, 8, 3, 827) - 0.64) * 2.5;
      kHeight[y * kSize + x] = ridge * 0.65 + furrow * 0.35;

      let r = 68 + ridge * 30 + furrow * 20;
      let g = 55 + ridge * 24 + furrow * 16;
      let b = 45 + ridge * 18 + furrow * 12;

      if (lichen > 0.1) {
        const lm = Math.min(0.65, lichen * 0.7);
        r = r * (1 - lm) + 124 * lm;
        g = g * (1 - lm) + 132 * lm;
        b = b * (1 - lm) + 98 * lm;
      }

      const idx = (y * kSize + x) * 4;
      kImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      kImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      kImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      kImg.data[idx + 3] = 255;
    }
  }
  kCtx.putImageData(kImg, 0, 0);
  const barkAlbedo = track(
    configureTexture(new THREE.CanvasTexture(kCanvas), maxAnisotropy, true, true)
  );
  const barkNormal = track(buildNormalFromHeight(kHeight, kSize, 4.6, maxAnisotropy));

  // 7. Weathered Hardwood Timber (512x512)
  const tSize = 512;
  const tCanvas = document.createElement('canvas');
  tCanvas.width = tSize;
  tCanvas.height = tSize;
  const tCtx = tCanvas.getContext('2d')!;
  const tImg = tCtx.createImageData(tSize, tSize);
  const tHeight = new Float32Array(tSize * tSize);

  for (let y = 0; y < tSize; y++) {
    const v = y / tSize;
    for (let x = 0; x < tSize; x++) {
      const u = x / tSize;
      const grain = smoothNoiseTile(u * 3.2, v * 0.2, 12, 901);
      const ring = 0.5 + 0.5 * Math.sin((u * 36 + grain * 4.5) * Math.PI);
      tHeight[y * tSize + x] = ring * 0.5 + grain * 0.5;

      const r = 104 + ring * 24 + (grain - 0.5) * 18;
      const g = 69 + ring * 18 + (grain - 0.5) * 14;
      const b = 45 + ring * 12 + (grain - 0.5) * 10;

      const idx = (y * tSize + x) * 4;
      tImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      tImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      tImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      tImg.data[idx + 3] = 255;
    }
  }
  tCtx.putImageData(tImg, 0, 0);
  const timberAlbedo = track(
    configureTexture(new THREE.CanvasTexture(tCanvas), maxAnisotropy, true, true)
  );
  const timberNormal = track(buildNormalFromHeight(tHeight, tSize, 2.4, maxAnisotropy));

  // 8. Woven Papyrus Reed Veranda Mat (512x512)
  const rmSize = 512;
  const rmCanvas = document.createElement('canvas');
  rmCanvas.width = rmSize;
  rmCanvas.height = rmSize;
  const rmCtx = rmCanvas.getContext('2d')!;
  rmCtx.fillStyle = '#b9965c';
  rmCtx.fillRect(0, 0, rmSize, rmSize);
  const rmRng = mulberry32(951);
  for (let y = 0; y < rmSize; y += 8) {
    const tone = 165 + Math.round((rmRng() - 0.5) * 28);
    rmCtx.fillStyle = `rgb(${tone}, ${Math.round(tone * 0.81)}, ${Math.round(tone * 0.5)})`;
    rmCtx.fillRect(0, y, rmSize, 6);
    rmCtx.fillStyle = 'rgba(72, 46, 22, 0.25)';
    rmCtx.fillRect(0, y + 6, rmSize, 2);
  }
  for (let x = 24; x < rmSize; x += 64) {
    rmCtx.fillStyle = 'rgba(84, 52, 24, 0.42)';
    rmCtx.fillRect(x, 0, 3, rmSize);
  }
  // Subtle geometric Ugandan border band
  rmCtx.fillStyle = '#7b281c';
  rmCtx.fillRect(0, 14, rmSize, 18);
  rmCtx.fillRect(0, rmSize - 32, rmSize, 18);
  const reedMatAlbedo = track(
    configureTexture(new THREE.CanvasTexture(rmCanvas), maxAnisotropy, true, true)
  );

  // 9. Botanical Mango Leaf Spray (256x256 alpha cutout — 9 radiating lanceolate leaves)
  const mlCanvas = document.createElement('canvas');
  mlCanvas.width = 256;
  mlCanvas.height = 256;
  const mlCtx = mlCanvas.getContext('2d')!;
  mlCtx.clearRect(0, 0, 256, 256);

  const drawMangoLeaf = (
    cx: number,
    cy: number,
    angle: number,
    len: number,
    wid: number,
    shade: string,
    midribColor: string
  ) => {
    mlCtx.save();
    mlCtx.translate(cx, cy);
    mlCtx.rotate(angle);
    const grad = mlCtx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, shade);
    grad.addColorStop(1, '#3d6124');
    mlCtx.fillStyle = grad;
    mlCtx.beginPath();
    mlCtx.moveTo(0, 0);
    mlCtx.bezierCurveTo(len * 0.28, -wid, len * 0.72, -wid * 0.72, len, 0);
    mlCtx.bezierCurveTo(len * 0.72, wid * 0.72, len * 0.28, wid, 0, 0);
    mlCtx.closePath();
    mlCtx.fill();

    // Central vein & fine side ribs
    mlCtx.strokeStyle = midribColor;
    mlCtx.lineWidth = 1.6;
    mlCtx.beginPath();
    mlCtx.moveTo(2, 0);
    mlCtx.lineTo(len * 0.92, 0);
    mlCtx.stroke();
    mlCtx.lineWidth = 0.8;
    for (let k = 0.2; k <= 0.8; k += 0.14) {
      mlCtx.beginPath();
      mlCtx.moveTo(len * k, 0);
      mlCtx.lineTo(len * (k + 0.08), -wid * 0.58 * (1 - k * 0.4));
      mlCtx.moveTo(len * k, 0);
      mlCtx.lineTo(len * (k + 0.08), wid * 0.58 * (1 - k * 0.4));
      mlCtx.stroke();
    }
    mlCtx.restore();
  };

  // Woody twig stem + cluster of lanceolate mango leaves
  mlCtx.strokeStyle = '#4e3c29';
  mlCtx.lineWidth = 4;
  mlCtx.beginPath();
  mlCtx.moveTo(128, 224);
  mlCtx.lineTo(128, 128);
  mlCtx.stroke();

  const leafAngles = [-2.55, -2.05, -1.57, -1.08, -0.58, -2.85, -0.25, -1.8, -1.34];
  const shades = ['#274618', '#31541e', '#2c4c1a', '#3a5f23', '#2a4819'];
  leafAngles.forEach((ang, i) => {
    const len = 82 + (i % 3) * 16;
    const wid = 17 + (i % 2) * 4;
    drawMangoLeaf(128, 134 - (i % 3) * 8, ang, len, wid, shades[i % shades.length], '#6c8a3d');
  });

  const mangoLeafMap = track(
    configureTexture(new THREE.CanvasTexture(mlCanvas), maxAnisotropy, true, false)
  );

  // 10. Broad East African Banana Leaf with natural wind-split tears (256x512 RGBA)
  const blCanvas = document.createElement('canvas');
  blCanvas.width = 256;
  blCanvas.height = 512;
  const blCtx = blCanvas.getContext('2d')!;
  blCtx.clearRect(0, 0, 256, 512);

  const blGrad = blCtx.createLinearGradient(0, 512, 256, 0);
  blGrad.addColorStop(0, '#3e6c24');
  blGrad.addColorStop(0.55, '#4d7c2b');
  blGrad.addColorStop(1, '#688c34');
  blCtx.fillStyle = blGrad;

  blCtx.beginPath();
  blCtx.moveTo(128, 504);
  blCtx.bezierCurveTo(32, 410, 18, 180, 118, 14);
  blCtx.lineTo(138, 14);
  blCtx.bezierCurveTo(238, 180, 224, 410, 128, 504);
  blCtx.closePath();
  blCtx.fill();

  // Central thick yellow-green midrib
  blCtx.strokeStyle = '#8fa94c';
  blCtx.lineWidth = 7;
  blCtx.beginPath();
  blCtx.moveTo(128, 508);
  blCtx.lineTo(128, 18);
  blCtx.stroke();

  // Parallel veins + authentic wind tears along leaf edge
  blCtx.strokeStyle = 'rgba(130, 162, 68, 0.45)';
  blCtx.lineWidth = 1.4;
  for (let y = 50; y < 470; y += 16) {
    blCtx.beginPath();
    blCtx.moveTo(128, y);
    blCtx.lineTo(24, y - 14);
    blCtx.moveTo(128, y);
    blCtx.lineTo(232, y - 14);
    blCtx.stroke();
  }
  // Cut realistic vertical-angled wind splits using destination-out
  blCtx.save();
  blCtx.globalCompositeOperation = 'destination-out';
  const splits = [
    [22, 130, 96, 152],
    [16, 255, 88, 272],
    [234, 175, 162, 198],
    [228, 325, 166, 342],
  ];
  for (const [x1, y1, x2, y2] of splits) {
    blCtx.beginPath();
    blCtx.moveTo(x1, y1 - 5);
    blCtx.lineTo(x2, y2);
    blCtx.lineTo(x1, y1 + 8);
    blCtx.closePath();
    blCtx.fill();
  }
  blCtx.restore();

  const bananaLeafMap = track(
    configureTexture(new THREE.CanvasTexture(blCanvas), maxAnisotropy, true, false)
  );

  // 11. Ugandan Savannah / Compound Edge Grass Tuft (256x256 RGBA)
  const grCanvas = document.createElement('canvas');
  grCanvas.width = 256;
  grCanvas.height = 256;
  const grCtx = grCanvas.getContext('2d')!;
  grCtx.clearRect(0, 0, 256, 256);
  const grRng = mulberry32(7731);
  for (let i = 0; i < 42; i++) {
    const bx = 42 + grRng() * 172;
    const h = 110 + grRng() * 120;
    const lean = (grRng() - 0.5) * 95;
    const isDry = grRng() > 0.56;
    const gr = grCtx.createLinearGradient(bx, 256, bx + lean, 256 - h);
    gr.addColorStop(0, isDry ? '#5e4b2b' : '#3a4f23');
    gr.addColorStop(1, isDry ? '#bfa15c' : '#6f873a');
    grCtx.strokeStyle = gr;
    grCtx.lineWidth = 3 + grRng() * 3.5;
    grCtx.lineCap = 'round';
    grCtx.beginPath();
    grCtx.moveTo(bx, 255);
    grCtx.quadraticCurveTo(bx + lean * 0.35, 256 - h * 0.55, bx + lean, 256 - h);
    grCtx.stroke();
  }
  const grassTuftMap = track(
    configureTexture(new THREE.CanvasTexture(grCanvas), maxAnisotropy, true, false)
  );

  // 12. Human Skin Micro-Pore Normal & Roughness Maps (512x512 seamless)
  const skSize = 512;
  const skHeight = new Float32Array(skSize * skSize);
  const skRough = new Float32Array(skSize * skSize);
  for (let y = 0; y < skSize; y++) {
    const v = y / skSize;
    for (let x = 0; x < skSize; x++) {
      const u = x / skSize;
      const pore = smoothNoiseTile(u, v, 72, 1201);
      const microCrease = smoothNoiseTile(u * 1.4, v * 0.7, 36, 1217);
      const cell = fbmTile(u, v, 18, 2, 1231);
      skHeight[y * skSize + x] = pore * 0.45 + microCrease * 0.35 + cell * 0.2;
      // Natural skin roughness: 0.44 in slightly oilier forehead/cheek/shin zones to 0.66 in matte pores
      skRough[y * skSize + x] = 0.46 + cell * 0.14 + (1 - pore) * 0.08;
    }
  }
  const skinNormal = track(buildNormalFromHeight(skHeight, skSize, 1.35, maxAnisotropy));
  const skinRoughness = track(buildRoughnessFromField(skRough, skSize, maxAnisotropy));

  // 13. Natural Type-4 Tightly Coiled Hair Normal Map (512x512 seamless)
  const hrSize = 512;
  const hrHeight = new Float32Array(hrSize * hrSize);
  for (let y = 0; y < hrSize; y++) {
    const v = y / hrSize;
    for (let x = 0; x < hrSize; x++) {
      const u = x / hrSize;
      const coilX = Math.sin(u * Math.PI * 52 + smoothNoiseTile(u, v, 24, 1301) * 4.5);
      const coilY = Math.cos(v * Math.PI * 52 + smoothNoiseTile(u, v, 24, 1319) * 4.5);
      const tuft = fbmTile(u, v, 32, 3, 1361);
      hrHeight[y * hrSize + x] = (coilX * coilY * 0.5 + 0.5) * 0.6 + tuft * 0.4;
    }
  }
  const hairNormal = track(buildNormalFromHeight(hrHeight, hrSize, 4.2, maxAnisotropy));

  // 14. Woven Cotton / Twill Normal Map (512x512 seamless)
  const ctSize = 512;
  const ctHeight = new Float32Array(ctSize * ctSize);
  for (let y = 0; y < ctSize; y++) {
    const v = y / ctSize;
    for (let x = 0; x < ctSize; x++) {
      const u = x / ctSize;
      const warp = Math.sin(u * Math.PI * 128) * 0.5 + 0.5;
      const weft = Math.sin(v * Math.PI * 128 + ((x + y) % 4) * 0.45) * 0.5 + 0.5;
      const slub = smoothNoiseTile(u, v, 16, 1409);
      ctHeight[y * ctSize + x] = warp * 0.42 + weft * 0.42 + slub * 0.16;
    }
  }
  const cottonNormal = track(buildNormalFromHeight(ctHeight, ctSize, 2.4, maxAnisotropy));

  // 15. East African Wax-Print Kitenge Skirt Fabric (512x512 seamless)
  const ktSize = 512;
  const ktCanvas = document.createElement('canvas');
  ktCanvas.width = ktSize;
  ktCanvas.height = ktSize;
  const ktCtx = ktCanvas.getContext('2d')!;
  ktCtx.fillStyle = '#8b2419';
  ktCtx.fillRect(0, 0, ktSize, ktSize);
  const ktRng = mulberry32(1501);
  // Concentric sunburst Kitenge medallions & warm ochre/indigo geometry
  for (let gy = 64; gy < ktSize; gy += 128) {
    for (let gx = 64; gx < ktSize; gx += 128) {
      ktCtx.strokeStyle = '#e8a832';
      ktCtx.lineWidth = 6;
      ktCtx.beginPath();
      ktCtx.arc(gx, gy, 44, 0, Math.PI * 2);
      ktCtx.stroke();

      ktCtx.fillStyle = '#172b45';
      ktCtx.beginPath();
      ktCtx.arc(gx, gy, 24, 0, Math.PI * 2);
      ktCtx.fill();

      ktCtx.fillStyle = '#f2dec0';
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ktCtx.beginPath();
        ktCtx.arc(gx + Math.cos(a) * 34, gy + Math.sin(a) * 34, 4.5, 0, Math.PI * 2);
        ktCtx.fill();
      }
    }
  }
  // Subtle wax crackle & sun-fade cotton wear
  for (let i = 0; i < 600; i++) {
    ktCtx.fillStyle = ktRng() > 0.5 ? 'rgba(255,235,205,0.06)' : 'rgba(25,10,5,0.07)';
    ktCtx.fillRect(ktRng() * ktSize, ktRng() * ktSize, 2 + ktRng() * 4, 2 + ktRng() * 4);
  }
  const kitengeSkirtAlbedo = track(
    configureTexture(new THREE.CanvasTexture(ktCanvas), maxAnisotropy, true, true)
  );

  // 16. Kampala Primary School Plaid Pinafore Dress (512x512 seamless)
  const plSize = 512;
  const plCanvas = document.createElement('canvas');
  plCanvas.width = plSize;
  plCanvas.height = plSize;
  const plCtx = plCanvas.getContext('2d')!;
  plCtx.fillStyle = '#1c3554';
  plCtx.fillRect(0, 0, plSize, plSize);
  for (let p = 0; p < plSize; p += 64) {
    plCtx.fillStyle = 'rgba(22, 102, 74, 0.42)';
    plCtx.fillRect(p, 0, 26, plSize);
    plCtx.fillRect(0, p, plSize, 26);
    plCtx.fillStyle = 'rgba(228, 178, 56, 0.65)';
    plCtx.fillRect(p + 34, 0, 4, plSize);
    plCtx.fillRect(0, p + 34, plSize, 4);
    plCtx.fillStyle = 'rgba(235, 228, 214, 0.45)';
    plCtx.fillRect(p + 46, 0, 2, plSize);
    plCtx.fillRect(0, p + 46, plSize, 2);
  }
  const plaidDressAlbedo = track(
    configureTexture(new THREE.CanvasTexture(plCanvas), maxAnisotropy, true, true)
  );

  // 17. Sun-Faded Red Play T-Shirt Knit with Subtle Dust Scuffs (512x512)
  const rjSize = 512;
  const rjCanvas = document.createElement('canvas');
  rjCanvas.width = rjSize;
  rjCanvas.height = rjSize;
  const rjCtx = rjCanvas.getContext('2d')!;
  rjCtx.fillStyle = '#a82820';
  rjCtx.fillRect(0, 0, rjSize, rjSize);
  const rjRng = mulberry32(1611);
  for (let i = 0; i < 1600; i++) {
    rjCtx.fillStyle = rjRng() > 0.5 ? 'rgba(255,215,190,0.04)' : 'rgba(40,8,5,0.05)';
    rjCtx.fillRect(rjRng() * rjSize, rjRng() * rjSize, 3, 2);
  }
  // Yellow neck/sleeve stripe accent band along lower V edge
  rjCtx.fillStyle = '#dca228';
  rjCtx.fillRect(0, rjSize - 26, rjSize, 12);
  const redJerseyAlbedo = track(
    configureTexture(new THREE.CanvasTexture(rjCanvas), maxAnisotropy, true, true)
  );

  return {
    murramAlbedo,
    murramNormal,
    murramRoughness,
    murramAO,
    chalkOverlay,
    plasterAlbedo,
    plasterNormal,
    brickAlbedo,
    brickNormal,
    brickRoughness,
    mabatiAlbedo,
    mabatiNormal,
    mabatiRoughness,
    barkAlbedo,
    barkNormal,
    timberAlbedo,
    timberNormal,
    reedMatAlbedo,
    mangoLeafMap,
    bananaLeafMap,
    grassTuftMap,
    skinNormal,
    skinRoughness,
    hairNormal,
    cottonNormal,
    kitengeSkirtAlbedo,
    plaidDressAlbedo,
    redJerseyAlbedo,
    disposeAll: () => {
      for (const tex of created) tex.dispose();
    },
  };
}
