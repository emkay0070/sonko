import * as THREE from 'three';
import { CompoundTextureLibrary } from './pbrTextures';
import { groundHeightAt, groundNormalAt } from './terrain';
import { applyNaturalWindShader, SHARED_TREE_WIND_STATE } from './treeWind';

export interface PrimarySchoolyardRig {
  group: THREE.Group;
  update: (elapsed: number, wetness: number) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
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

function buildNormalFromHeight(
  heights: Float32Array,
  w: number,
  h: number,
  strength: number,
  maxAniso: number
): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (heights[y * w + xm] - heights[y * w + xp]) * strength;
      const dy = (heights[ym * w + x] - heights[yp * w + x]) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const idx = (y * w + x) * 4;
      data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((1.0 / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, Math.max(1, maxAniso));
  tex.needsUpdate = true;
  return tex;
}

function buildGrayscaleDataTexture(
  field: Float32Array,
  w: number,
  h: number,
  maxAniso: number
): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(field[i] * 255)));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, Math.max(1, maxAniso));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Photorealistic Savannah Sports-Pitch Grass + Laterite Soil Bleed PBR set (512x512 seamless)
 */
function buildSavannahPitchTextures(maxAnisotropy: number) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = fbmTile(u, v, 4, 3, 211);
      const clump = fbmTile(u, v, 14, 3, 307);
      const blade = smoothNoiseTile(u * 2, v, 64, 419);
      const micro = smoothNoiseTile(u, v, 192, 503);

      const idxPix = y * size + x;
      const strawZone = Math.max(0, macro - 0.56) * 1.9;
      const dirtSpeck = clump < 0.28 ? (0.28 - clump) * 2.5 : 0;

      height[idxPix] = clump * 0.42 + blade * 0.42 + micro * 0.16 - dirtSpeck * 0.25;
      rough[idxPix] = THREE.MathUtils.clamp(0.84 + strawZone * 0.08 + (1 - blade) * 0.06, 0.76, 0.96);

      // Authentic Ugandan kikuyu/couch grass + dry straw blades + subtle red-earth peeks
      let r = 78 + clump * 34 + blade * 22 + strawZone * 48;
      let g = 104 + clump * 38 + blade * 24 + strawZone * 26;
      let b = 42 + clump * 16 + blade * 10 + strawZone * 16;

      if (dirtSpeck > 0.05) {
        const dm = Math.min(0.65, dirtSpeck);
        r = r * (1 - dm) + 128 * dm;
        g = g * (1 - dm) + 74 * dm;
        b = b * (1 - dm) + 49 * dm;
      }

      const idx = idxPix * 4;
      img.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      img.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      img.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = aniso;

  const normalMap = buildNormalFromHeight(height, size, size, 2.8, aniso);
  const roughnessMap = buildGrayscaleDataTexture(rough, size, size, aniso);

  return { albedoMap, normalMap, roughnessMap };
}

/**
 * Hand-painted Ugandan School Noticeboard & Motto Monument Texture
 */
function buildSchoolNoticeboardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Weathered cream limewash plaster face
  ctx.fillStyle = '#ddd0ba';
  ctx.fillRect(0, 0, w, h);

  // Subtle plaster mottling
  for (let i = 0; i < 650; i++) {
    const px = hash(i * 7) * w;
    const py = hash(i * 11) * h;
    ctx.fillStyle = hash(i * 17) > 0.5 ? 'rgba(182,164,138,0.12)' : 'rgba(245,238,225,0.10)';
    ctx.fillRect(px, py, 8 + hash(i * 3) * 14, 6 + hash(i * 5) * 10);
  }

  // Red-earth rain splash staining along lower 26% of masonry monument
  const splash = ctx.createLinearGradient(0, h * 0.68, 0, h);
  splash.addColorStop(0, 'rgba(154, 84, 52, 0.0)');
  splash.addColorStop(0.55, 'rgba(148, 76, 46, 0.42)');
  splash.addColorStop(1, 'rgba(122, 58, 35, 0.78)');
  ctx.fillStyle = splash;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  // Painted dark-navy border rule
  ctx.strokeStyle = '#24303e';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 16, w - 36, 86);

  // School Name Header
  ctx.fillStyle = '#1b2430';
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('NAKASERO PRIMARY SCHOOL', w * 0.5, 48);
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillStyle = '#5a2d1b';
  ctx.fillText('P.O. BOX 412 KAMPALA  ·  U.P.E. SCHOOL', w * 0.5, 72);
  ctx.font = 'italic bold 14px Georgia, serif';
  ctx.fillStyle = '#243b2c';
  ctx.fillText('"EDUCATION IS LIGHT"', w * 0.5, 93);

  // Twin recessed black slate chalkboard notice panels
  const drawSlate = (sx: number, sy: number, sw: number, sh: number, title: string, lines: string[]) => {
    ctx.fillStyle = '#25292d';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#5d402a';
    ctx.lineWidth = 5;
    ctx.strokeRect(sx, sy, sw, sh);

    // Subtle chalk smudge cloud
    ctx.fillStyle = 'rgba(232, 236, 238, 0.08)';
    ctx.fillRect(sx + 10, sy + 28, sw - 20, sh - 40);

    ctx.fillStyle = '#ece6d8';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(title, sx + sw * 0.5, sy + 24);

    ctx.strokeStyle = 'rgba(236, 230, 216, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 18, sy + 32);
    ctx.lineTo(sx + sw - 18, sy + 32);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(240, 235, 224, 0.85)';
    lines.forEach((ln, idx) => {
      ctx.fillText(ln, sx + 16, sy + 54 + idx * 24);
    });
  };

  drawSlate(28, 118, 214, 152, 'TERM II NOTICES', [
    '• ASSEMBLY: 7:30 AM',
    '• P1-P7 CHALK SONKO',
    '• BREAK: 10:30 AM',
    '• GAMES: 4:00 PM',
  ]);

  drawSlate(270, 118, 214, 152, 'DUTY ROSTER', [
    '• BELL: P6 PREFECTS',
    '• COMPOUND SWEEPERS',
    '• FLAG: HEAD BOY',
    '• CLEAN YARD ALWAYS',
  ]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Class label plaque texture ("P1", "P2", "P3", "P4", "P5") above Ugandan classroom doors
 */
function buildClassPlaqueTexture(label: string, maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d8ccb7';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = hash(i * 19) > 0.5 ? 'rgba(170,152,126,0.14)' : 'rgba(245,238,224,0.12)';
    ctx.fillRect(hash(i * 3) * w, hash(i * 5) * h, 10, 6);
  }
  ctx.fillStyle = '#1b1d20';
  ctx.font = 'bold 74px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w * 0.5, h * 0.54);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Perforated Terracotta/Cement Classroom Ventilation Breeze-Blocks
 */
function buildVentBlockTextures(maxAnisotropy: number) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const height = new Float32Array(size * size);
  const aniso = Math.min(4, Math.max(1, maxAnisotropy));

  ctx.fillStyle = '#9b583e';
  ctx.fillRect(0, 0, size, size);

  // 4x2 grid of diamond/lattice shadow holes typical in Ugandan classroom upper walls
  const cols = 4;
  const rows = 2;
  const cw = size / cols;
  const ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cw;
      const cy = (r + 0.5) * ch;
      ctx.fillStyle = '#231714';
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch * 0.34);
      ctx.lineTo(cx + cw * 0.34, cy);
      ctx.lineTo(cx, cy + ch * 0.34);
      ctx.lineTo(cx - cw * 0.34, cy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#c4a68e';
      ctx.lineWidth = 3;
      ctx.strokeRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
    }
  }

  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const lum = (img.data[i * 4] + img.data[i * 4 + 1] + img.data[i * 4 + 2]) / (3 * 255);
    height[i] = lum;
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = aniso;

  const normalMap = buildNormalFromHeight(height, size, size, 3.0, aniso);
  return { map, normalMap };
}

/**
 * Ugandan National Flag Cloth Texture (Black-Yellow-Red x2 + Crested Crane Medallion)
 */
function buildUgandanFlagTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 384;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const bands = ['#141414', '#efc018', '#c82020', '#141414', '#efc018', '#c82020'];
  const bh = h / 6;
  bands.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, i * bh, w, bh + 1);
  });

  // Subtle cotton weave shading
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(hash(i * 7) * w, hash(i * 13) * h, 4, 2);
  }

  // Central white medallion + stylized Grey Crowned Crane
  const cx = w * 0.5;
  const cy = h * 0.5;
  const rad = h * 0.165;
  ctx.fillStyle = '#f5f2ea';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  // Crane silhouette
  ctx.fillStyle = '#25282c';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 5, 11, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#25282c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 2);
  ctx.lineTo(cx - 7, cy - 12);
  ctx.lineTo(cx - 11, cy - 12);
  ctx.moveTo(cx + 1, cy + 11);
  ctx.lineTo(cx + 1, cy + 24);
  ctx.moveTo(cx + 5, cy + 11);
  ctx.lineTo(cx + 6, cy + 24);
  ctx.stroke();

  // Red wattle & golden crown crest
  ctx.fillStyle = '#c82020';
  ctx.beginPath();
  ctx.arc(cx - 9, cy - 9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efc018';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 17, 4.5, Math.PI, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function buildCumulusCloudTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    const ny = (y / h) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2 - 1;
      const distSq = nx * nx * 1.12 + ny * ny * 2.15;
      const envelope = Math.max(0, 1 - distSq);
      const n1 = fbmTile(x / w, y / h, 4, 4, 911);
      const n2 = smoothNoiseTile(x / w, y / h, 14, 977);
      const rawDensity = envelope * 1.32 + (n1 - 0.45) * 0.65 + (n2 - 0.5) * 0.16;
      const alpha = THREE.MathUtils.clamp((rawDensity - 0.34) * 2.25, 0, 1);

      const sunFacing = THREE.MathUtils.clamp(0.56 - ny * 0.54 + (n1 - 0.5) * 0.28, 0, 1);
      const r = THREE.MathUtils.lerp(202, 253, sunFacing);
      const g = THREE.MathUtils.lerp(212, 249, sunFacing);
      const b = THREE.MathUtils.lerp(228, 243, sunFacing);

      const idx = (y * w + x) * 4;
      img.data[idx] = Math.round(r);
      img.data[idx + 1] = Math.round(g);
      img.data[idx + 2] = Math.round(b);
      img.data[idx + 3] = Math.round(alpha * 228);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function buildTaperedBranch(
  points: THREE.Vector3[],
  rStart: number,
  rEnd: number,
  radialSegs: number,
  tubularSegs: number
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegs, rStart, radialSegs, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const ringCount = tubularSegs + 1;
  const vertsPerRing = radialSegs + 1;
  const center = new THREE.Vector3();
  const vert = new THREE.Vector3();

  for (let i = 0; i < ringCount; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, center);
    const radiusScale = THREE.MathUtils.lerp(1.0, rEnd / rStart, t);
    for (let j = 0; j < vertsPerRing; j++) {
      const idx = i * vertsPerRing + j;
      vert.fromBufferAttribute(pos, idx);
      vert.sub(center).multiplyScalar(radiusScale).add(center);
      pos.setXYZ(idx, vert.x, vert.y, vert.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Deterministic schoolyard elevation:
 * - Inside courtyard (|x| <= 12, |z| <= 14): seamlessly matches groundHeightAt(x, z) so chalk court, players & stone align 1:1
 * - Across rear sports field (z in [-14, -52]): smooth level playing field with gentle 0.12m undulation
 * - Outer perimeter (r > 52m): gentle rolling green Wakiso/Kampala hills
 */
function schoolyardHeightAt(x: number, z: number): number {
  const distCourtyard = Math.max(Math.abs(x) / 11.5, Math.abs(z) / 13.5);
  if (distCourtyard <= 1.0) {
    return groundHeightAt(x, z);
  }
  const pitchBlend = THREE.MathUtils.clamp((distCourtyard - 1.0) / 0.65, 0, 1);
  const baseY = groundHeightAt(x, z);
  const fieldFlat =
    Math.sin(x * 0.14 + 0.3) * Math.cos(z * 0.12 - 0.4) * 0.12 +
    Math.sin(x * 0.35 - z * 0.25) * 0.04;

  const rOuter = Math.hypot(x, z + 12);
  const hillMask = THREE.MathUtils.clamp((rOuter - 48) / 28, 0, 1);
  const gentleHills =
    (Math.sin(x * 0.045 + 0.6) * Math.cos(z * 0.04 - 0.3) * 4.4 +
      Math.cos(x * 0.022 - z * 0.026) * 5.8 +
      Math.max(0, rOuter - 52) * 0.16) *
    hillMask *
    hillMask;

  return THREE.MathUtils.lerp(baseY, fieldFlat, pitchBlend) + gentleHills;
}

export function buildPrimarySchoolyardEnvironment(options: {
  textures: CompoundTextureLibrary;
  isSoftwareGl: boolean;
  shadowsEnabled: () => boolean;
  maxAnisotropy: number;
}): PrimarySchoolyardRig {
  const group = new THREE.Group();
  group.name = 'PrimarySchoolyardEnvironment';

  const { textures } = options;
  const aniso = Math.min(8, Math.max(1, options.maxAnisotropy));

  const trackedGeos = new Set<THREE.BufferGeometry>();
  const trackedMats = new Set<THREE.Material>();
  const trackedTexs = new Set<THREE.Texture>();
  const shadowCasters: THREE.Mesh[] = [];
  const shadowReceivers: THREE.Mesh[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    trackedGeos.add(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    trackedMats.add(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    trackedTexs.add(t);
    return t;
  };

  // =========================================================================
  // 1. PHOTOREALISTIC SCHOOLYARD MURRAM + SAVANNAH PITCH TERRAIN (96m x 96m)
  // =========================================================================
  const pitchTex = buildSavannahPitchTextures(aniso);
  trackTex(pitchTex.albedoMap);
  trackTex(pitchTex.normalMap);
  trackTex(pitchTex.roughnessMap);

  // Clone murram textures with non-shared repeat if needed; keep original wrap/aniso
  const murramAlbedo = trackTex(textures.murramAlbedo.clone());
  murramAlbedo.needsUpdate = true;
  const murramNormal = trackTex(textures.murramNormal.clone());
  murramNormal.needsUpdate = true;
  const murramRough = trackTex(textures.murramRoughness.clone());
  murramRough.needsUpdate = true;
  const murramAO = trackTex(textures.murramAO.clone());
  murramAO.needsUpdate = true;

  const pitchAlbedo = pitchTex.albedoMap;
  const pitchNormal = pitchTex.normalMap;
  const pitchRough = pitchTex.roughnessMap;

  const yardSize = 96;
  const yardSegs = 96;
  const groundGeo = trackGeo(new THREE.PlaneGeometry(yardSize, yardSize, yardSegs, yardSegs));
  groundGeo.rotateX(-Math.PI / 2);

  const gPos = groundGeo.attributes.position as THREE.BufferAttribute;
  const gUv = groundGeo.attributes.uv as THREE.BufferAttribute;
  const gColors = new Float32Array(gPos.count * 3);

  const cBase = new THREE.Color('#ffffff');
  const cDustyCourt = new THREE.Color('#f2dfd2');
  const cShadowBorder = new THREE.Color('#ad9182');
  const cTreeShade = new THREE.Color('#9c7b69');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < gPos.count; i++) {
    const wx = gPos.getX(i);
    const wz = gPos.getZ(i) - 16; // Shift forward/back so pitch stretches deeply toward -Z (-64m to +32m)
    const wy = schoolyardHeightAt(wx, wz);
    gPos.setXYZ(i, wx, wy, wz);
    // Razor-sharp 2.6m repeat matching Kampala's close-up murram pebble density
    gUv.setXY(i, (wx + 48) / 2.6, (wz + 64) / 2.6);

    tmpCol.copy(cBase);

    // Compacted dusty play apron around the Sonko court
    const courtMask =
      Math.exp(-((wx - 0.25) * (wx - 0.25)) / 4.2) *
      Math.exp(-((wz - 0.35) * (wz - 0.35)) / 18.0);
    tmpCol.lerp(cDustyCourt, courtMask * 0.48);

    // Left veranda apron contact darkening (x ~ -4.55, z in [-11.5, 4.9])
    if (wz > -12.4 && wz < 5.6) {
      const dLeft = Math.abs(wx - -4.55);
      if (dLeft < 1.35) tmpCol.lerp(cShadowBorder, (1 - dLeft / 1.35) * 0.44);
    }
    // Right veranda apron contact darkening (x ~ 6.2, z in [-11.8, 3.4])
    if (wz > -12.6 && wz < 4.2) {
      const dRight = Math.abs(wx - 6.2);
      if (dRight < 1.35) tmpCol.lerp(cShadowBorder, (1 - dRight / 1.35) * 0.44);
    }
    // Noticeboard & Flagpole assembly plinth contact darkening
    const dNotice = Math.hypot(wx - -1.45, wz - -13.2);
    if (dNotice < 2.2) tmpCol.lerp(cShadowBorder, (1 - dNotice / 2.2) * 0.42);
    const dFlag = Math.hypot(wx - 1.45, wz - -12.9);
    if (dFlag < 1.6) tmpCol.lerp(cShadowBorder, (1 - dFlag / 1.6) * 0.45);

    // Hero Mango & Acacia tree organic leaf-litter pools
    const dMango = Math.hypot(wx - -5.6, wz - -15.4);
    if (dMango < 4.8) tmpCol.lerp(cTreeShade, (1 - dMango / 4.8) * 0.56);
    const dAcacia = Math.hypot(wx - 6.4, wz - -16.6);
    if (dAcacia < 4.6) tmpCol.lerp(cTreeShade, (1 - dAcacia / 4.6) * 0.5);

    gColors[i * 3] = tmpCol.r;
    gColors[i * 3 + 1] = tmpCol.g;
    gColors[i * 3 + 2] = tmpCol.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
  groundGeo.setAttribute('uv2', gUv);
  groundGeo.computeVertexNormals();

  const weatherWetnessUniform = { value: 0 };

  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: murramAlbedo,
      normalMap: murramNormal,
      normalScale: new THREE.Vector2(1.55, 1.55),
      roughnessMap: murramRough,
      roughness: 0.95,
      metalness: 0.02,
      aoMap: murramAO,
      aoMapIntensity: 0.72,
      vertexColors: true,
    })
  );

  groundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWeatherWetness = weatherWetnessUniform;
    shader.uniforms.uPitchAlbedo = { value: pitchAlbedo };
    shader.uniforms.uPitchNormal = { value: pitchNormal };
    shader.uniforms.uPitchRough = { value: pitchRough };

    shader.vertexShader =
      `varying vec3 vSchoolWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vSchoolWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

    shader.fragmentShader =
      `varying vec3 vSchoolWorldPos;
      uniform float uWeatherWetness;
      uniform sampler2D uPitchAlbedo;
      uniform sampler2D uPitchNormal;
      uniform sampler2D uPitchRough;\n` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          // World-space macro breakup to eliminate repetition across large courtyard
          float n1 = sin(vSchoolWorldPos.x * 0.44 + cos(vSchoolWorldPos.z * 0.38)) * 0.5 + 0.5;
          float n2 = cos(vSchoolWorldPos.z * 0.72 - sin(vSchoolWorldPos.x * 0.61)) * 0.5 + 0.5;
          float n3 = sin((vSchoolWorldPos.x + vSchoolWorldPos.z) * 1.15) * 0.5 + 0.5;

          // Sunlit warm dusty ochre-laterite school murram palette
          vec3 dustySchoolOchre = vec3(1.16, 1.12, 1.06);
          vec3 dampIronClay = vec3(0.88, 0.82, 0.78);
          diffuseColor.rgb *= mix(dustySchoolOchre, dampIronClay, (n1 * 0.55 + n2 * 0.45) * 0.52);

          // Organic transition from red-murram assembly square into savannah football pitch (z < -13.5) and outer grounds (|x| > 9.5)
          float warp = (n1 - 0.5) * 2.4 + (n2 - 0.5) * 1.3 + (n3 - 0.5) * 0.6;
          float pitchRear = smoothstep(-13.4, -17.2, vSchoolWorldPos.z + warp * 0.9);
          float outerSide = smoothstep(9.2, 13.4, abs(vSchoolWorldPos.x) + warp * 0.75);
          float outerFront = smoothstep(8.2, 12.6, vSchoolWorldPos.z + warp * 0.8);
          float grassMask = clamp(max(pitchRear, max(outerSide, outerFront)), 0.0, 1.0);

          // Worn dusty murram goal-mouth path cutting down center of football pitch toward goalposts
          float goalPath = exp(-pow((vSchoolWorldPos.x - 0.35) / (2.2 + n2 * 1.1), 2.0)) *
                           smoothstep(-46.0, -14.0, vSchoolWorldPos.z);
          grassMask *= (1.0 - goalPath * 0.52);

          vec2 pUv = vSchoolWorldPos.xz * 0.28;
          vec3 grassTex = texture2D(uPitchAlbedo, pUv).rgb;
          // Mild sun-bleached dry grass variation
          grassTex *= mix(vec3(0.88, 0.92, 0.84), vec3(1.10, 1.04, 0.90), n2);
          diffuseColor.rgb = mix(diffuseColor.rgb, grassTex, grassMask * 0.92);

          // Distant Wakiso hillside greenery beyond radius 42m
          float hillDist = smoothstep(38.0, 62.0, length(vSchoolWorldPos.xz - vec2(0.0, -14.0)));
          vec3 hillSage = vec3(0.32, 0.42, 0.24);
          diffuseColor.rgb = mix(diffuseColor.rgb, hillSage, hillDist * 0.42);

          // Dynamic rain/dew surface darkening
          float wetPatch = smoothstep(0.28, 0.82, n2 * 0.6 + n1 * 0.4);
          diffuseColor.rgb *= mix(1.0, 0.64, uWeatherWetness * mix(0.5, 1.0, wetPatch));
          `
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #include <normal_fragment_maps>
          float n1N = sin(vSchoolWorldPos.x * 0.44 + cos(vSchoolWorldPos.z * 0.38)) * 0.5 + 0.5;
          float n2N = cos(vSchoolWorldPos.z * 0.72 - sin(vSchoolWorldPos.x * 0.61)) * 0.5 + 0.5;
          float warpN = (n1N - 0.5) * 2.4 + (n2N - 0.5) * 1.3;
          float pitchMaskN = clamp(max(smoothstep(-13.4, -17.2, vSchoolWorldPos.z + warpN * 0.9),
                                       max(smoothstep(9.2, 13.4, abs(vSchoolWorldPos.x) + warpN * 0.75),
                                           smoothstep(8.2, 12.6, vSchoolWorldPos.z + warpN * 0.8))), 0.0, 1.0);
          vec3 pN = texture2D(uPitchNormal, vSchoolWorldPos.xz * 0.28).xyz * 2.0 - 1.0;
          normal = normalize(mix(normal, normalize(normal + vec3(pN.x, 0.0, pN.y) * 0.55), pitchMaskN));
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          #include <roughnessmap_fragment>
          float n1R = sin(vSchoolWorldPos.x * 0.44 + cos(vSchoolWorldPos.z * 0.38)) * 0.5 + 0.5;
          float n2R = cos(vSchoolWorldPos.z * 0.72 - sin(vSchoolWorldPos.x * 0.61)) * 0.5 + 0.5;
          float pRough = texture2D(uPitchRough, vSchoolWorldPos.xz * 0.28).g;
          float pMaskR = smoothstep(-13.4, -17.2, vSchoolWorldPos.z + (n1R - 0.5) * 2.2);
          roughnessFactor = mix(roughnessFactor, pRough, pMaskR);
          float wetSpot = smoothstep(0.35, 0.85, n1R * 0.45 + n2R * 0.55);
          roughnessFactor = mix(roughnessFactor, min(roughnessFactor, mix(0.46, 0.16, wetSpot)), uWeatherWetness);
          `
        );
  };
  groundMat.customProgramCacheKey = () => 'sonko-ug-schoolyard-terrain-v1';

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.name = 'SchoolyardMurramAndPitchGround';
  groundMesh.receiveShadow = true;
  shadowReceivers.push(groundMesh);
  group.add(groundMesh);

  // Embedded 3D laterite gravel pebbles across courtyard (clear of chalk court and veranda concrete pads)
  const pebbleGeo = trackGeo(new THREE.DodecahedronGeometry(0.034, 1));
  pebbleGeo.scale(1.22, 0.48, 1.0);
  const pebbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      normalMap: textures.murramNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  const pebbleCount = 220;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  pebbles.name = 'SchoolyardMurramPebbles';
  pebbles.castShadow = false;
  pebbles.receiveShadow = true;
  shadowReceivers.push(pebbles);

  const dummy = new THREE.Object3D();
  const upVec = new THREE.Vector3(0, 1, 0);
  const nrmVec = new THREE.Vector3();
  const pCol = new THREE.Color();
  let pPlaced = 0;

  for (let i = 0; i < 420 && pPlaced < pebbleCount; i++) {
    const px = (hash(i * 5 + 1) - 0.5) * 10.2;
    const pz = -12.0 + hash(i * 5 + 2) * 20.0;
    const inCourt = Math.abs(px - 0.25) < 1.25 && Math.abs(pz - 0.35) < 3.45;
    if (inCourt && hash(i * 19) > 0.12) continue;
    if (px < -4.2 || px > 5.8) continue;

    const py = schoolyardHeightAt(px, pz);
    groundNormalAt(px, pz, nrmVec);
    const sc = inCourt ? 0.32 + hash(i * 7 + 3) * 0.36 : 0.45 + hash(i * 7 + 3) * 1.15;

    dummy.position.set(px, py + 0.004 * sc, pz);
    dummy.quaternion.setFromUnitVectors(upVec, nrmVec);
    dummy.rotateY(hash(i * 11) * Math.PI * 2);
    dummy.scale.set(sc * (0.85 + hash(i * 13) * 0.4), sc * 0.6, sc * (0.85 + hash(i * 17) * 0.4));
    dummy.updateMatrix();
    pebbles.setMatrixAt(pPlaced, dummy.matrix);

    const v = hash(i * 23);
    if (v < 0.5) pCol.set('#5e2f20').lerp(new THREE.Color('#804730'), hash(i * 29));
    else if (v < 0.85) pCol.set('#6e635a').lerp(new THREE.Color('#918578'), hash(i * 31));
    else pCol.set('#b4a493');
    pebbles.setColorAt(pPlaced, pCol);
    pPlaced++;
  }
  pebbles.count = pPlaced;
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  group.add(pebbles);

  // =========================================================================
  // 2. SHARED ARCHITECTURAL PBR MATERIALS (Brick, Plaster, Mabati, Concrete, Timber)
  // =========================================================================
  const brickMap = trackTex(textures.brickAlbedo.clone());
  brickMap.repeat.set(4.5, 1.5);
  brickMap.needsUpdate = true;
  const brickNorm = trackTex(textures.brickNormal.clone());
  brickNorm.repeat.set(4.5, 1.5);
  brickNorm.needsUpdate = true;
  const brickRough = trackTex(textures.brickRoughness.clone());
  brickRough.repeat.set(4.5, 1.5);
  brickRough.needsUpdate = true;

  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: brickMap,
      normalMap: brickNorm,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: brickRough,
      roughness: 0.9,
      metalness: 0.02,
    })
  );

  const plasterMap = trackTex(textures.plasterAlbedo.clone());
  plasterMap.repeat.set(1.6, 1.0);
  plasterMap.needsUpdate = true;
  const plasterNorm = trackTex(textures.plasterNormal.clone());
  plasterNorm.repeat.set(1.6, 1.0);
  plasterNorm.needsUpdate = true;

  const creamPlasterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: plasterMap,
      normalMap: plasterNorm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: '#efe7d6',
      roughness: 0.88,
      metalness: 0.02,
    })
  );

  const colPlasterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.plasterAlbedo,
      normalMap: textures.plasterNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      color: '#ede3cf',
      roughness: 0.86,
      metalness: 0.02,
    })
  );

  const colBootMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#342620',
      normalMap: textures.plasterNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.92,
      metalness: 0.02,
    })
  );

  const verandaDeckMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#91887c',
      normalMap: textures.murramNormal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.86,
      metalness: 0.03,
    })
  );

  const verandaStepMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#887f74',
      normalMap: textures.murramNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.88,
      metalness: 0.03,
    })
  );

  const concreteSkirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#5a4e46',
      normalMap: textures.murramNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.93,
      metalness: 0.02,
    })
  );

  // Load crisp veranda concrete finish texture cleanly
  new THREE.TextureLoader().load(
    '/assets/textures/veranda_surface.jpg',
    (baseTex) => {
      baseTex.wrapS = THREE.RepeatWrapping;
      baseTex.wrapT = THREE.RepeatWrapping;
      baseTex.colorSpace = THREE.SRGBColorSpace;
      baseTex.anisotropy = aniso;
      baseTex.repeat.set(3.4, 8.2);
      baseTex.needsUpdate = true;
      trackTex(baseTex);

      const stepTex = trackTex(baseTex.clone());
      stepTex.repeat.set(0.6, 1.5);
      stepTex.needsUpdate = true;

      verandaDeckMat.map = baseTex;
      verandaDeckMat.color.set('#e5ddd0');
      verandaDeckMat.needsUpdate = true;

      verandaStepMat.map = stepTex;
      verandaStepMat.color.set('#dfd6c8');
      verandaStepMat.needsUpdate = true;
    },
    undefined,
    () => {
      // keep concrete fallback
    }
  );

  const mabatiMap = trackTex(textures.mabatiAlbedo.clone());
  mabatiMap.repeat.set(8.5, 2.8);
  mabatiMap.needsUpdate = true;
  const mabatiNorm = trackTex(textures.mabatiNormal.clone());
  mabatiNorm.repeat.set(8.5, 2.8);
  mabatiNorm.needsUpdate = true;
  const mabatiRough = trackTex(textures.mabatiRoughness.clone());
  mabatiRough.repeat.set(8.5, 2.8);
  mabatiRough.needsUpdate = true;

  const mabatiMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: mabatiMap,
      normalMap: mabatiNorm,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: mabatiRough,
      roughness: 0.58,
      metalness: 0.72,
      side: THREE.DoubleSide,
    })
  );

  const timberMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.timberAlbedo,
      normalMap: textures.timberNormal,
      roughness: 0.8,
      metalness: 0.02,
    })
  );

  const doorGreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.timberAlbedo,
      normalMap: textures.timberNormal,
      color: '#254236', // Classic dark green painted Ugandan UPE classroom steel/timber doors
      roughness: 0.62,
      metalness: 0.14,
    })
  );

  const casementSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#25292d',
      roughness: 0.44,
      metalness: 0.68,
    })
  );

  const windowGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#19262e',
      roughness: 0.08,
      metalness: 0.2,
      envMapIntensity: 1.45,
    })
  );

  const sillConcreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#9c9286',
      roughness: 0.9,
    })
  );

  const fasciaCreamMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#e5dac7',
      normalMap: textures.timberNormal,
      roughness: 0.78,
    })
  );

  const gutterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#888e92',
      roughness: 0.46,
      metalness: 0.68,
    })
  );

  const ventTex = buildVentBlockTextures(aniso);
  trackTex(ventTex.map);
  trackTex(ventTex.normalMap);
  const ventMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: ventTex.map,
      normalMap: ventTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.88,
      metalness: 0.02,
    })
  );

  // Reusable classroom steel casement window builder (built in local Z-facing space)
  const buildClassroomWindow = (): THREE.Group => {
    const win = new THREE.Group();
    const pane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.42, 1.06)), windowGlassMat);
    pane.position.z = 0.02;
    win.add(pane);

    // Cream plastered reveal + sloped cement sill
    const sill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.58, 0.08, 0.2)), sillConcreteMat);
    sill.position.set(0, -0.56, 0.08);
    sill.castShadow = true;
    sill.receiveShadow = true;
    shadowCasters.push(sill);
    shadowReceivers.push(sill);
    win.add(sill);

    const topFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 0.06, 0.1)), casementSteelMat);
    topFrame.position.set(0, 0.54, 0.05);
    win.add(topFrame);

    for (const sx of [-0.72, -0.24, 0.24, 0.72]) {
      const mullion = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 1.08, 0.09)), casementSteelMat);
      mullion.position.set(sx, 0, 0.05);
      win.add(mullion);
    }
    for (const by of [-0.26, 0.0, 0.26]) {
      const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 1.44, 6)), casementSteelMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, by, 0.06);
      win.add(bar);
    }
    return win;
  };

  // Helper to construct an authentic single-story Ugandan UPE classroom block
  interface ClassroomBlockOpts {
    name: string;
    x: number; // inner courtyard veranda edge X
    zCenter: number;
    lengthZ: number;
    facingDir: 1 | -1; // +1 faces +X (left block), -1 faces -X (right block)
    classes: Array<{ label: string; localZ: number }>;
    windowLocalZs: number[];
    columnLocalZs: number[];
    stepLocalZs: number[];
    castShadows: boolean;
  }

  const buildClassroomBlock = (opts: ClassroomBlockOpts): THREE.Group => {
    const blk = new THREE.Group();
    blk.name = opts.name;
    const baseY = schoolyardHeightAt(opts.x, opts.zCenter);
    const dir = opts.facingDir;

    const verandaDepth = 2.2;
    const bodyDepth = 4.6;
    const totalFoundationDepth = verandaDepth + bodyDepth + 0.35;
    const wallFaceX = -dir * verandaDepth; // Front brick wall plane relative to veranda edge
    const bodyCenterX = wallFaceX - dir * (bodyDepth * 0.5);
    const slabCenterX = -dir * (totalFoundationDepth * 0.5 - 0.15);

    // 1. Raised concrete veranda plinth & mud-splash foundation skirt
    const slab = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(totalFoundationDepth, 0.44, opts.lengthZ)),
      verandaDeckMat
    );
    slab.position.set(slabCenterX, 0.08, 0);
    slab.receiveShadow = true;
    slab.castShadow = opts.castShadows;
    shadowReceivers.push(slab);
    if (opts.castShadows) shadowCasters.push(slab);
    blk.add(slab);

    const apron = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(totalFoundationDepth + 0.12, 0.14, opts.lengthZ + 0.12)),
      concreteSkirtMat
    );
    apron.position.set(slabCenterX, -0.06, 0);
    apron.receiveShadow = true;
    shadowReceivers.push(apron);
    blk.add(apron);

    // Concrete entry steps onto the murram courtyard
    for (const sz of opts.stepLocalZs) {
      const step1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.16, 1.85)), verandaStepMat);
      step1.position.set(dir * 0.2, 0.04, sz);
      step1.receiveShadow = true;
      step1.castShadow = opts.castShadows;
      shadowReceivers.push(step1);
      if (opts.castShadows) shadowCasters.push(step1);
      blk.add(step1);

      const step2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.09, 1.95)), verandaStepMat);
      step2.position.set(dir * 0.48, -0.02, sz);
      step2.receiveShadow = true;
      shadowReceivers.push(step2);
      blk.add(step2);
    }

    // 2. Fair-faced red kiln-fired brick classroom main block + plastered lintel frieze
    const brickBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(bodyDepth, 3.05, opts.lengthZ - 0.35)),
      brickMat
    );
    brickBody.position.set(bodyCenterX, 0.3 + 1.525, 0);
    brickBody.castShadow = opts.castShadows;
    brickBody.receiveShadow = true;
    shadowReceivers.push(brickBody);
    if (opts.castShadows) shadowCasters.push(brickBody);
    blk.add(brickBody);

    // Upper cream plastered transom band along front facade (matches reference photo!)
    const frieze = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.08, 0.56, opts.lengthZ - 0.32)),
      creamPlasterMat
    );
    frieze.position.set(wallFaceX + dir * 0.02, 0.3 + 2.74, 0);
    frieze.receiveShadow = true;
    shadowReceivers.push(frieze);
    blk.add(frieze);

    // Dark lower brick rain-splash foundation band along classroom wall
    const wallSkirt = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(bodyDepth + 0.04, 0.24, opts.lengthZ - 0.31)),
      colBootMat
    );
    wallSkirt.position.set(bodyCenterX, 0.3 + 0.12, 0);
    wallSkirt.receiveShadow = true;
    shadowReceivers.push(wallSkirt);
    blk.add(wallSkirt);

    // 3. Classroom Doors + P1..P5 Stenciled Plaques + Clay Breeze-Block Vents
    const brassMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#c49d46', roughness: 0.32, metalness: 0.85 })
    );
    for (const cls of opts.classes) {
      const dFrame = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.1, 2.15, 1.04)),
        casementSteelMat
      );
      dFrame.position.set(wallFaceX + dir * 0.03, 0.3 + 1.075, cls.localZ);
      blk.add(dFrame);

      const dLeaf = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.06, 2.06, 0.92)),
        doorGreenMat
      );
      dLeaf.position.set(wallFaceX + dir * 0.055, 0.3 + 1.03, cls.localZ);
      blk.add(dLeaf);

      const handle = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.028, 10, 10)), brassMat);
      handle.position.set(wallFaceX + dir * 0.095, 0.3 + 0.98, cls.localZ + 0.34);
      blk.add(handle);

      // Painted class label plaque ("P1", "P2", etc.) right above doorway
      const pTex = trackTex(buildClassPlaqueTexture(cls.label, aniso));
      const pMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: pTex,
          normalMap: textures.plasterNormal,
          roughness: 0.88,
        })
      );
      const plaque = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.34, 0.68)), pMat);
      plaque.position.set(wallFaceX + dir * 0.06, 0.3 + 2.38, cls.localZ);
      blk.add(plaque);

      // Perforated ventilation breeze blocks above plaque
      const vent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.28, 0.96)), ventMat);
      vent.position.set(wallFaceX + dir * 0.055, 0.3 + 2.74, cls.localZ);
      blk.add(vent);
    }

    // 4. Barred Steel Casement Windows + Upper Vent Blocks
    for (const wz of opts.windowLocalZs) {
      const win = buildClassroomWindow();
      win.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      win.position.set(wallFaceX + dir * 0.02, 0.3 + 1.56, wz);
      blk.add(win);

      const ventW = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.28, 1.38)), ventMat);
      ventW.position.set(wallFaceX + dir * 0.055, 0.3 + 2.74, wz);
      blk.add(ventW);
    }

    // 5. Square Plastered Veranda Columns with Dark Mud/Charcoal Boots + Concrete Header Beam
    const colCenterX = -dir * 0.22;
    const beamY = 0.3 + 2.48;
    for (const cz of opts.columnLocalZs) {
      const boot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.32, 0.32)), colBootMat);
      boot.position.set(colCenterX, 0.3 + 0.16, cz);
      boot.castShadow = opts.castShadows;
      boot.receiveShadow = true;
      shadowReceivers.push(boot);
      if (opts.castShadows) shadowCasters.push(boot);
      blk.add(boot);

      const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 2.16, 0.28)), colPlasterMat);
      col.position.set(colCenterX, 0.3 + 0.32 + 1.08, cz);
      col.castShadow = opts.castShadows;
      col.receiveShadow = true;
      shadowReceivers.push(col);
      if (opts.castShadows) shadowCasters.push(col);
      blk.add(col);
    }

    const headerBeam = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.32, 0.24, opts.lengthZ - 0.15)),
      colPlasterMat
    );
    headerBeam.position.set(colCenterX, beamY + 0.08, 0);
    headerBeam.castShadow = opts.castShadows;
    headerBeam.receiveShadow = true;
    shadowReceivers.push(headerBeam);
    if (opts.castShadows) shadowCasters.push(headerBeam);
    blk.add(headerBeam);

    // Exposed Eucalyptus Roof Rafters under Veranda Eaves
    const rafterStep = 0.85;
    for (let rz = -opts.lengthZ * 0.48; rz <= opts.lengthZ * 0.48; rz += rafterStep) {
      const rafter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.65, 0.09, 0.065)), timberMat);
      rafter.position.set(colCenterX - dir * 0.72, beamY + 0.32, rz);
      rafter.rotation.z = -dir * 0.21;
      blk.add(rafter);
    }

    // 6. Pitched Corrugated Galvanized Mabati Roof (Gabled Front + Back Slopes)
    const frontSlope = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.8, 0.05, opts.lengthZ + 0.65)),
      mabatiMat
    );
    frontSlope.position.set(wallFaceX + dir * 0.62, 0.3 + 3.16, 0);
    frontSlope.rotation.z = -dir * 0.21;
    frontSlope.castShadow = opts.castShadows;
    frontSlope.receiveShadow = true;
    shadowReceivers.push(frontSlope);
    if (opts.castShadows) shadowCasters.push(frontSlope);
    blk.add(frontSlope);

    const backSlope = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.4, 0.05, opts.lengthZ + 0.65)),
      mabatiMat
    );
    backSlope.position.set(bodyCenterX - dir * 0.9, 0.3 + 3.28, 0);
    backSlope.rotation.z = dir * 0.21;
    backSlope.castShadow = opts.castShadows;
    backSlope.receiveShadow = true;
    if (opts.castShadows) shadowCasters.push(backSlope);
    blk.add(backSlope);

    const ridgeCap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.32, 0.08, opts.lengthZ + 0.72)),
      gutterMat
    );
    ridgeCap.position.set(wallFaceX - dir * 1.65, 0.3 + 3.65, 0);
    blk.add(ridgeCap);

    // Cream Fascia Board + Galvanized Rain Gutter + Downpipe
    const eaveX = dir * 0.56;
    const fascia = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.05, 0.18, opts.lengthZ + 0.66)),
      fasciaCreamMat
    );
    fascia.position.set(eaveX, 0.3 + 2.54, 0);
    blk.add(fascia);

    const gutter = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.058, 0.058, opts.lengthZ + 0.68, 12, 1, false, 0, Math.PI)),
      gutterMat
    );
    gutter.rotation.x = Math.PI / 2;
    gutter.rotation.z = Math.PI;
    gutter.position.set(eaveX + dir * 0.06, 0.3 + 2.47, 0);
    blk.add(gutter);

    const downpipeZ = opts.lengthZ * 0.47;
    const downpipe = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 2.46, 10)),
      gutterMat
    );
    downpipe.position.set(eaveX + dir * 0.03, 0.3 + 1.24, downpipeZ);
    downpipe.castShadow = opts.castShadows;
    if (opts.castShadows) shadowCasters.push(downpipe);
    blk.add(downpipe);

    blk.position.set(opts.x, baseY, opts.zCenter);
    return blk;
  };

  // =========================================================================
  // 3. BUILD LEFT BLOCK (P1-P3), RIGHT BLOCK (P4-P5) & REAR BLOCK (P6)
  // =========================================================================
  const leftBlock = buildClassroomBlock({
    name: 'LeftClassroomBlock_P1_P3',
    x: -4.55,
    zCenter: -3.3,
    lengthZ: 16.4,
    facingDir: 1,
    classes: [
      { label: 'P1', localZ: 5.1 },
      { label: 'P2', localZ: -0.1 },
      { label: 'P3', localZ: -5.3 },
    ],
    windowLocalZs: [6.8, 2.5, -2.7, -7.0],
    // Carefully leaves (-4.9, -3.7) Veranda camera bay (-4.9..-1.7 in world Z => -1.6..+1.6 in local Z) wide open!
    columnLocalZs: [-7.8, -4.7, -1.6, 1.8, 4.9, 7.8],
    stepLocalZs: [-4.1, 2.2],
    castShadows: true,
  });
  group.add(leftBlock);

  const rightBlock = buildClassroomBlock({
    name: 'RightClassroomBlock_P4_P5',
    x: 6.2,
    zCenter: -4.2,
    lengthZ: 15.2,
    facingDir: -1,
    classes: [
      { label: 'P4', localZ: 3.8 },
      { label: 'P5', localZ: -2.4 },
    ],
    windowLocalZs: [5.9, 0.7, -5.5],
    columnLocalZs: [-7.1, -3.6, -0.1, 3.4, 7.0],
    stepLocalZs: [-2.4, 3.8],
    castShadows: true,
  });
  group.add(rightBlock);

  // Rear left classroom wing peeking past the Hero Mango Tree (like reference photo!)
  const rearWing = buildClassroomBlock({
    name: 'RearClassroomWing_P6',
    x: -8.6,
    zCenter: -19.8,
    lengthZ: 11.4,
    facingDir: 1,
    classes: [{ label: 'P6', localZ: 1.8 }],
    windowLocalZs: [-2.2, 4.0],
    columnLocalZs: [-5.2, -1.7, 1.8, 5.2],
    stepLocalZs: [1.8],
    castShadows: false,
  });
  rearWing.rotation.y = Math.PI * 0.44;
  group.add(rearWing);

  // Veranda School Details on Left Block: Hanging Steel Wheel-Rim Bell, Wooden Bench, 500L Blue Water Tank
  const leftBaseY = schoolyardHeightAt(-4.55, -3.3);
  const bellGroup = new THREE.Group();
  bellGroup.name = 'SchoolWheelRimBell';
  bellGroup.position.set(-4.55, leftBaseY + 2.38, 4.1);
  const chainMat = casementSteelMat;
  const bracket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.06, 0.06)), timberMat);
  bracket.position.set(0.18, 0.14, 0);
  bellGroup.add(bracket);
  const chain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 6)), chainMat);
  chain.position.set(0.32, -0.07, 0);
  bellGroup.add(chain);
  const rimBell = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.14, 0.045, 10, 18)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#454a4f', roughness: 0.42, metalness: 0.78 }))
  );
  rimBell.position.set(0.32, -0.34, 0);
  rimBell.castShadow = true;
  shadowCasters.push(rimBell);
  bellGroup.add(rimBell);
  group.add(bellGroup);

  // Shaded Hardwood School Bench on Left Veranda
  const verandaBench = new THREE.Group();
  verandaBench.name = 'VerandaSchoolBench';
  verandaBench.position.set(-5.7, leftBaseY + 0.3, -1.6);
  for (const lz of [-0.62, 0.62]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.4, 0.07)), timberMat);
    leg.position.set(0, 0.2, lz);
    leg.castShadow = true;
    shadowCasters.push(leg);
    verandaBench.add(leg);
  }
  const benchTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.045, 1.56)), timberMat);
  benchTop.position.set(0, 0.42, 0);
  benchTop.castShadow = true;
  shadowCasters.push(benchTop);
  verandaBench.add(benchTop);
  group.add(verandaBench);

  // Blue Plastic Rainwater Harvesting Tank on Brick Pedestal at Back Corner of Left Block
  const tankStand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.55, 1.15)), brickMat);
  const tankY = schoolyardHeightAt(-4.2, -11.7);
  tankStand.position.set(-4.2, tankY + 0.25, -11.7);
  tankStand.castShadow = true;
  tankStand.receiveShadow = true;
  shadowCasters.push(tankStand);
  shadowReceivers.push(tankStand);
  group.add(tankStand);

  const waterTankMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#144c82', roughness: 0.48, metalness: 0.05 })
  );
  const tankBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.52, 0.52, 1.48, 22)),
    waterTankMat
  );
  tankBody.position.set(-4.2, tankY + 0.52 + 0.74, -11.7);
  tankBody.castShadow = true;
  tankBody.receiveShadow = true;
  shadowCasters.push(tankBody);
  shadowReceivers.push(tankBody);
  group.add(tankBody);

  const tankLid = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.24, 0.52, 0.16, 20)),
    waterTankMat
  );
  tankLid.position.set(-4.2, tankY + 0.52 + 1.54, -11.7);
  group.add(tankLid);

  // =========================================================================
  // 4. CENTER-REAR ASSEMBLY SQUARE: NOTICEBOARD, FLAGPOLE & TIRE SWING
  // =========================================================================
  // A. Brick & Plaster School Noticeboard Monument (-1.45, -13.2)
  const nbGroup = new THREE.Group();
  nbGroup.name = 'SchoolNoticeboardMonument';
  const nbY = schoolyardHeightAt(-1.45, -13.2);
  nbGroup.position.set(-1.45, nbY, -13.2);

  const nbPlinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.55, 0.36, 0.62)), concreteSkirtMat);
  nbPlinth.position.y = 0.14;
  nbPlinth.receiveShadow = true;
  shadowReceivers.push(nbPlinth);
  nbGroup.add(nbPlinth);

  const nbTex = buildSchoolNoticeboardTexture(aniso);
  trackTex(nbTex);
  const nbFaceMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: nbTex,
      normalMap: textures.plasterNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.88,
      metalness: 0.02,
    })
  );
  const nbSideMat = creamPlasterMat;

  const nbBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.35, 1.85, 0.42)),
    [nbSideMat, nbSideMat, nbSideMat, nbSideMat, nbFaceMat, nbSideMat]
  );
  nbBody.position.y = 0.3 + 0.925;
  nbBody.castShadow = true;
  nbBody.receiveShadow = true;
  shadowCasters.push(nbBody);
  shadowReceivers.push(nbBody);
  nbGroup.add(nbBody);

  const nbCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.52, 0.12, 0.54)), sillConcreteMat);
  nbCap.position.y = 0.3 + 1.91;
  nbCap.castShadow = true;
  shadowCasters.push(nbCap);
  nbGroup.add(nbCap);
  group.add(nbGroup);

  // B. Assembly Stepped Flagpole + Waving Ugandan National Flag (1.45, -12.9)
  const fpGroup = new THREE.Group();
  fpGroup.name = 'AssemblyFlagpole';
  const fpY = schoolyardHeightAt(1.45, -12.9);
  fpGroup.position.set(1.45, fpY, -12.9);

  const baseStep1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12, 0.22, 1.12)), colPlasterMat);
  baseStep1.position.y = 0.09;
  baseStep1.receiveShadow = true;
  shadowReceivers.push(baseStep1);
  fpGroup.add(baseStep1);

  const baseStep2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.74, 0.2, 0.74)), colPlasterMat);
  baseStep2.position.y = 0.28;
  baseStep2.receiveShadow = true;
  fpGroup.add(baseStep2);

  const mastMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#edeae2', roughness: 0.36, metalness: 0.58 })
  );
  const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.048, 6.2, 12)), mastMat);
  mast.position.y = 0.36 + 3.1;
  mast.castShadow = true;
  shadowCasters.push(mast);
  fpGroup.add(mast);

  const finial = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.065, 12, 10)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#d4a637', roughness: 0.28, metalness: 0.85 }))
  );
  finial.position.y = 0.36 + 6.24;
  fpGroup.add(finial);

  const flagTex = buildUgandanFlagTexture(aniso);
  trackTex(flagTex);
  const flagGeo = trackGeo(new THREE.PlaneGeometry(1.58, 1.04, 24, 14));
  // Anchor U=0 at mast (x = 0)
  flagGeo.translate(0.79, 0, 0);
  const flagTimeUniform = { value: 0 };
  const flagMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: flagTex,
      roughness: 0.78,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
  );
  flagMat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlagTime = flagTimeUniform;
    shader.vertexShader =
      `uniform float uFlagTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float distPin = clamp(transformed.x / 1.58, 0.0, 1.0);
        float ripple = sin(distPin * 7.5 - uFlagTime * 4.2 + transformed.y * 2.1) * 0.095 +
                       sin(distPin * 13.0 - uFlagTime * 6.8) * 0.032;
        transformed.z += ripple * pow(distPin, 1.15);
        transformed.y += sin(distPin * 4.5 - uFlagTime * 3.1) * 0.025 * distPin;
        `
      );
  };
  flagMat.customProgramCacheKey = () => 'sonko-ug-flag-wave-v1';

  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(0.03, 0.36 + 5.55, 0);
  flagMesh.rotation.y = 0.22;
  flagMesh.castShadow = true;
  shadowCasters.push(flagMesh);
  fpGroup.add(flagMesh);
  group.add(fpGroup);

  // C. Timber Tire Swing Frame beside Flagpole (3.65, -12.7) — matching real Ugandan school reference!
  const swingGroup = new THREE.Group();
  swingGroup.name = 'SchoolTimberTireSwing';
  const swY = schoolyardHeightAt(3.65, -12.7);
  swingGroup.position.set(3.65, swY, -12.7);

  for (const px of [-0.95, 0.95]) {
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 2.35, 10)), timberMat);
    post.position.set(px, 1.1, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    shadowCasters.push(post);
    shadowReceivers.push(post);
    swingGroup.add(post);
  }
  const crossbeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.28, 0.15, 0.15)), timberMat);
  crossbeam.position.set(0, 2.25, 0);
  crossbeam.castShadow = true;
  shadowCasters.push(crossbeam);
  swingGroup.add(crossbeam);

  const ropeMat = trackMat(new THREE.MeshStandardMaterial({ color: '#786246', roughness: 0.94 }));
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1f2124',
      normalMap: textures.murramNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.88,
      metalness: 0.04,
    })
  );

  const tirePivot = new THREE.Group();
  tirePivot.position.set(0, 2.22, 0);
  const rope = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 6)), ropeMat);
  rope.position.y = -0.425;
  tirePivot.add(rope);
  const tire = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.38, 0.145, 12, 24)), tireMat);
  tire.position.y = -1.16;
  tire.castShadow = true;
  shadowCasters.push(tire);
  tirePivot.add(tire);
  swingGroup.add(tirePivot);
  group.add(swingGroup);

  // =========================================================================
  // 5. REAR SPORTS PITCH EUCALYPTUS GOALPOSTS
  // =========================================================================
  const goalPostMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#e2d8c7', roughness: 0.86, metalness: 0.02 })
  );
  const addGoalpost = (gx: number, gz: number) => {
    const gg = new THREE.Group();
    const gy = schoolyardHeightAt(gx, gz);
    gg.position.set(gx, gy, gz);

    for (const px of [-2.4, 2.4]) {
      const p = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 2.25, 8)), goalPostMat);
      p.position.set(px, 1.1, 0);
      gg.add(p);
    }
    const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 4.92, 8)), goalPostMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 2.2, 0);
    gg.add(bar);
    group.add(gg);
  };
  addGoalpost(0.4, -27.5);
  addGoalpost(0.4, -44.0);

  // =========================================================================
  // 6. HERO MANGO TREE & UGANDAN ACACIA SHADE TREES + GRASS TUFTS
  // =========================================================================
  const barkMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.barkAlbedo,
      normalMap: textures.barkNormal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughness: 0.92,
      metalness: 0.02,
    })
  );
  applyNaturalWindShader(barkMat, {
    swayScaleM: 0.068,
    flutterScaleM: 0,
    heightMode: 'worldMeters',
    heightBaseM: 1.5,
    refHeightM: 4.5,
    useModelRoot: true,
    bendExponent: 1.75,
  });

  const sprayCard1 = trackGeo(new THREE.PlaneGeometry(1.48, 1.48));
  const sprayCard2 = trackGeo(new THREE.PlaneGeometry(1.48, 1.48));
  sprayCard2.rotateY(Math.PI * 0.5);
  const sprayPos1 = sprayCard1.attributes.position as THREE.BufferAttribute;
  const sprayPos2 = sprayCard2.attributes.position as THREE.BufferAttribute;
  const sprayNorm1 = sprayCard1.attributes.normal as THREE.BufferAttribute;
  const sprayNorm2 = sprayCard2.attributes.normal as THREE.BufferAttribute;
  const sprayUv1 = sprayCard1.attributes.uv as THREE.BufferAttribute;
  const sprayUv2 = sprayCard2.attributes.uv as THREE.BufferAttribute;

  const mergedSprayGeo = trackGeo(new THREE.BufferGeometry());
  const mPos = new Float32Array(24);
  const mNorm = new Float32Array(24);
  const mUv = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    mPos[i * 3] = sprayPos1.getX(i);
    mPos[i * 3 + 1] = sprayPos1.getY(i);
    mPos[i * 3 + 2] = sprayPos1.getZ(i);
    mNorm[i * 3] = sprayNorm1.getX(i);
    mNorm[i * 3 + 1] = sprayNorm1.getY(i);
    mNorm[i * 3 + 2] = sprayNorm1.getZ(i);
    mUv[i * 2] = sprayUv1.getX(i);
    mUv[i * 2 + 1] = sprayUv1.getY(i);

    mPos[(i + 4) * 3] = sprayPos2.getX(i);
    mPos[(i + 4) * 3 + 1] = sprayPos2.getY(i);
    mPos[(i + 4) * 3 + 2] = sprayPos2.getZ(i);
    mNorm[(i + 4) * 3] = sprayNorm2.getX(i);
    mNorm[(i + 4) * 3 + 1] = sprayNorm2.getY(i);
    mNorm[(i + 4) * 3 + 2] = sprayNorm2.getZ(i);
    mUv[(i + 4) * 2] = sprayUv2.getX(i);
    mUv[(i + 4) * 2 + 1] = sprayUv2.getY(i);
  }
  mergedSprayGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mergedSprayGeo.setAttribute('normal', new THREE.BufferAttribute(mNorm, 3));
  mergedSprayGeo.setAttribute('uv', new THREE.BufferAttribute(mUv, 2));
  mergedSprayGeo.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);

  const leafMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.mangoLeafMap,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.56,
      metalness: 0.02,
      depthWrite: true,
    })
  );
  applyNaturalWindShader(leafMat, {
    swayScaleM: 0.09,
    flutterScaleM: 0.032,
    heightMode: 'worldMeters',
    heightBaseM: 1.4,
    refHeightM: 4.5,
    useModelRoot: true,
    bendExponent: 1.55,
  });

  const buildShadeTree = (
    name: string,
    tx: number,
    tz: number,
    trunkHeight: number,
    canopySpread: number,
    flatAcacia: boolean,
    seedOffset: number
  ) => {
    const tree = new THREE.Group();
    tree.name = name;
    tree.position.set(tx, schoolyardHeightAt(tx, tz), tz);

    const trunk = new THREE.Mesh(
      trackGeo(
        buildTaperedBranch(
          [
            new THREE.Vector3(0, -0.15, 0),
            new THREE.Vector3(0.08, trunkHeight * 0.38, -0.05),
            new THREE.Vector3(0.18, trunkHeight * 0.78, 0.06),
            new THREE.Vector3(0.12, trunkHeight, 0.02),
          ],
          0.34,
          0.19,
          10,
          12
        )
      ),
      barkMat
    );
    trunk.castShadow = false;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const limbTips: THREE.Vector3[] = [];
    const limbCount = 5;
    for (let i = 0; i < limbCount; i++) {
      const a = (i / limbCount) * Math.PI * 2 + hash(seedOffset + i) * 0.5;
      const reach = canopySpread * (0.65 + hash(seedOffset + i * 7) * 0.35);
      const topY = trunkHeight + (flatAcacia ? 1.15 + hash(i * 3) * 0.5 : 1.7 + hash(i * 3) * 1.3);
      const start = new THREE.Vector3(0.12, trunkHeight * 0.85, 0.02);
      const tip = new THREE.Vector3(Math.cos(a) * reach, topY, Math.sin(a) * reach);
      const mid = start.clone().lerp(tip, 0.5);
      mid.y += flatAcacia ? 0.22 : 0.45;
      const limb = new THREE.Mesh(
        trackGeo(buildTaperedBranch([start, mid, tip], 0.16, 0.055, 7, 8)),
        barkMat
      );
      tree.add(limb);
      limbTips.push(tip);
    }

    const totalCards = 48;
    const sprays = new THREE.InstancedMesh(mergedSprayGeo, leafMat, totalCards);
    sprays.castShadow = false;
    sprays.receiveShadow = true;
    const spDummy = new THREE.Object3D();
    const spColor = new THREE.Color();

    for (let i = 0; i < totalCards; i++) {
      const base = limbTips[i % limbTips.length];
      const ang = hash(seedOffset + i * 11) * Math.PI * 2;
      const r = hash(seedOffset + i * 13) * 1.45;
      const oy = flatAcacia ? (hash(seedOffset + i * 17) - 0.3) * 0.65 : (hash(seedOffset + i * 17) - 0.25) * 1.35;
      spDummy.position.set(base.x + Math.cos(ang) * r, base.y + oy, base.z + Math.sin(ang) * r);
      spDummy.rotation.set(
        (hash(seedOffset + i * 19) - 0.5) * 0.55,
        hash(seedOffset + i * 23) * Math.PI * 2,
        (hash(seedOffset + i * 29) - 0.5) * 0.55
      );
      spDummy.scale.setScalar(0.85 + hash(seedOffset + i * 31) * 0.55);
      spDummy.updateMatrix();
      sprays.setMatrixAt(i, spDummy.matrix);

      spColor.set(flatAcacia ? '#4e6f2c' : '#3d6322').lerp(
        new THREE.Color(flatAcacia ? '#74903e' : '#658833'),
        hash(seedOffset + i * 37)
      );
      sprays.setColorAt(i, spColor);
    }
    sprays.instanceMatrix.needsUpdate = true;
    if (sprays.instanceColor) sprays.instanceColor.needsUpdate = true;
    sprays.computeBoundingSphere();
    tree.add(sprays);
    group.add(tree);
  };

  buildShadeTree('SchoolyardMangoTree', -5.6, -15.4, 2.7, 2.6, false, 100);
  buildShadeTree('SchoolyardAcaciaTree', 6.4, -16.6, 3.0, 3.3, true, 300);

  // Instanced Ugandan Savannah Grass Tufts along foundations, flagpole plinth, noticeboard & field edge
  const tuftGeo = trackGeo(new THREE.PlaneGeometry(0.46, 0.36));
  tuftGeo.translate(0, 0.17, 0);
  const tuftMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.grassTuftMap,
      alphaTest: 0.32,
      side: THREE.DoubleSide,
      roughness: 0.86,
      metalness: 0.0,
      depthWrite: true,
    })
  );
  applyNaturalWindShader(tuftMat, {
    swayScaleM: 0.04,
    flutterScaleM: 0.015,
    heightMode: 'worldMeters',
    heightBaseM: 0.02,
    refHeightM: 0.45,
    useModelRoot: false,
    bendExponent: 1.45,
  });

  const tuftSpots: Array<[number, number]> = [];
  // Left & Right veranda footing skirts
  for (let i = 0; i < 24; i++) {
    tuftSpots.push([-4.28 + (hash(i * 3) - 0.5) * 0.32, -11.0 + i * 0.68]);
    tuftSpots.push([5.92 + (hash(i * 5) - 0.5) * 0.32, -11.0 + i * 0.62]);
  }
  // Noticeboard, Flagpole, Tire-Swing & Mango tree bases
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    if (i < 12) tuftSpots.push([-1.45 + Math.cos(a) * 1.45, -13.2 + Math.sin(a) * 0.55]);
    else if (i < 22) tuftSpots.push([1.45 + Math.cos(a) * 0.78, -12.9 + Math.sin(a) * 0.78]);
    else tuftSpots.push([3.65 + (hash(i * 7) - 0.5) * 2.2, -12.7 + (hash(i * 11) - 0.5) * 0.8]);
  }
  // Sports field & murram ragged edge clumps
  for (let i = 0; i < 150; i++) {
    const gx = (hash(i * 13 + 7) - 0.5) * 22.0;
    const gz = -13.8 - hash(i * 17 + 3) * 14.0;
    tuftSpots.push([gx, gz]);
  }

  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftSpots.length * 2);
  tufts.name = 'SchoolyardSavannahGrassTufts';
  tufts.castShadow = false;
  tufts.receiveShadow = true;
  shadowReceivers.push(tufts);

  let tIdx = 0;
  const tColor = new THREE.Color();
  tuftSpots.forEach(([tx, tz], idx) => {
    const ty = schoolyardHeightAt(tx, tz);
    const sc = 0.78 + hash(idx * 29) * 0.58;
    const baseRot = hash(idx * 31) * Math.PI;
    tColor.set('#5a7836').lerp(new THREE.Color('#9e894c'), hash(idx * 41) * 0.62);

    for (let card = 0; card < 2; card++) {
      dummy.position.set(tx, ty - 0.02, tz);
      dummy.rotation.set(0, baseRot + card * (Math.PI * 0.5), 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      tufts.setMatrixAt(tIdx, dummy.matrix);
      tufts.setColorAt(tIdx, tColor);
      tIdx++;
    }
  });
  tufts.count = tIdx;
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  tufts.computeBoundingSphere();
  group.add(tufts);

  // =========================================================================
  // 7. SOFT VOLUMETRIC CUMULUS CLOUDS OVER DISTANT KAMPALA/WAKISO HORIZON
  // =========================================================================
  const cloudTex = buildCumulusCloudTexture(aniso);
  trackTex(cloudTex);
  const cloudMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      fog: true,
    })
  );
  const cloudGeo = trackGeo(new THREE.PlaneGeometry(36, 15));
  const cloudPlacements = [
    { x: -34, y: 26, z: -84, sx: 1.15, sy: 0.95 },
    { x: 6, y: 29, z: -92, sx: 1.35, sy: 1.05 },
    { x: 42, y: 25, z: -80, sx: 1.05, sy: 0.9 },
  ];
  for (const cp of cloudPlacements) {
    const cm = new THREE.Mesh(cloudGeo, cloudMat);
    cm.position.set(cp.x, cp.y, cp.z);
    cm.scale.set(cp.sx, cp.sy, 1);
    cm.lookAt(0, cp.y * 0.45, 0);
    group.add(cm);
  }

  // Initial shadow sync
  const applyShadows = (enabled: boolean) => {
    const active = !options.isSoftwareGl && enabled;
    for (const m of shadowCasters) {
      m.castShadow = active;
    }
    for (const m of shadowReceivers) {
      m.receiveShadow = active;
    }
  };
  applyShadows(options.shadowsEnabled());

  const update = (elapsed: number, wetness: number) => {
    weatherWetnessUniform.value = wetness;
    flagTimeUniform.value = elapsed * (1.0 + SHARED_TREE_WIND_STATE.liveGust * 0.5);
    // Gentle breeze pendulum on the hanging rubber tire swing
    tirePivot.rotation.z =
      Math.sin(elapsed * 1.45) * (0.045 + SHARED_TREE_WIND_STATE.liveGust * 0.035);
    tirePivot.rotation.x = Math.cos(elapsed * 1.1) * 0.02;
  };

  const setShadowsEnabled = (enabled: boolean) => {
    applyShadows(enabled);
  };

  const dispose = () => {
    for (const g of trackedGeos) g.dispose();
    for (const t of trackedTexs) t.dispose();
    for (const m of trackedMats) m.dispose();
    trackedGeos.clear();
    trackedTexs.clear();
    trackedMats.clear();
  };

  return { group, update, setShadowsEnabled, dispose };
}
