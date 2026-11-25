import * as THREE from 'three';
import { groundHeightAt } from './terrain';
import { applyNaturalWindShader } from './treeWind';

export interface EntebbeLakesideRig {
  group: THREE.Group;
  update: (elapsed: number, wetness: number) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

const WATER_Y = -0.16;

/**
 * Curved shoreline contour for Entebbe's Lake Victoria cove.
 * Returns world Z where water meets dry beach sand for a given world X.
 */
export function entebbeShoreZ(x: number): number {
  const dxLeft = Math.max(0, -1.6 - x);
  const leftPeninsula =
    x < -1.6 ? -24.5 * Math.sin(Math.min(Math.PI * 0.92, dxLeft * 0.088)) : 0;
  const rightCoveCurve =
    x > 2.2 ? Math.min(3.2, Math.pow(Math.max(0.0001, (x - 2.2) * 0.14), 1.15) * 2.0) : 0;
  const gentleRipple = Math.sin(x * 0.2 + 0.4) * 0.5 + Math.cos(x * 0.08 - 0.5) * 0.3;
  return -6.5 + leftPeninsula + rightCoveCurve + gentleRipple;
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

function buildPhotorealSandTextures(maxAnisotropy: number) {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const aoField = new Float32Array(size * size);
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = fbmTile(u, v, 4, 3, 19);
      const mid = fbmTile(u, v, 14, 3, 61);
      const fineGrain = smoothNoiseTile(u, v, 128, 107);
      const microQuartz = smoothNoiseTile(u, v, 240, 223);

      // Wind-swept sand ripples warped naturally by FBM (strictly periodic integers!)
      const warp = (macro - 0.5) * 0.42 + Math.sin(u * Math.PI * 4) * 0.08;
      const ripple = Math.sin((v * 11 + u * 2 + warp) * Math.PI * 2) * 0.5 + 0.5;
      const microRipple = Math.sin((v * 24 - u * 4 + (mid - 0.5) * 0.3) * Math.PI * 2) * 0.5 + 0.5;

      const idxPix = y * size + x;
      const hVal = ripple * 0.38 + microRipple * 0.14 + mid * 0.24 + fineGrain * 0.16 + microQuartz * 0.08;
      height[idxPix] = hVal;

      // Packed crests reflect subtly more than loose troughs; quartz grains sparkle slightly
      const sparkle = microQuartz > 0.87 ? -0.18 : 0;
      rough[idxPix] = THREE.MathUtils.clamp(0.89 - ripple * 0.08 + (0.5 - mid) * 0.07 + sparkle, 0.56, 0.96);
      aoField[idxPix] = THREE.MathUtils.clamp(0.76 + ripple * 0.14 + mid * 0.1, 0.68, 1.0);

      // Authentic warm sun-baked Entebbe lake sand + dark mineral grains + crushed shell flecks
      const isDarkMineral = fineGrain < 0.09 && microQuartz < 0.28;
      const isShellFleck = microQuartz > 0.935 && fineGrain > 0.72;

      const baseShade = (macro - 0.5) * 16 + (ripple - 0.5) * 12 + (fineGrain - 0.5) * 14;
      let r = 216 + baseShade;
      let g = 176 + baseShade * 0.86;
      let b = 114 + baseShade * 0.66;

      if (isDarkMineral) {
        r -= 46;
        g -= 42;
        b -= 34;
      } else if (isShellFleck) {
        r = Math.min(255, r + 26);
        g = Math.min(255, g + 26);
        b = Math.min(255, b + 28);
      }

      const idx = idxPix * 4;
      aImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      aImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      aImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      aImg.data[idx + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = aniso;

  const normalMap = buildNormalFromHeight(height, size, size, 3.0, aniso);
  const roughnessMap = buildGrayscaleDataTexture(rough, size, size, aniso);
  const aoMap = buildGrayscaleDataTexture(aoField, size, size, aniso);

  return { albedoMap, normalMap, roughnessMap, aoMap };
}

function buildPhotorealPalmBarkTextures(maxAnisotropy: number) {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);

  const height = new Float32Array(w * h);
  const rough = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const coarse = fbmTile(u, v, 6, 3, 301);
      const fibers = smoothNoiseTile(u, v, 48, 349);
      const micro = smoothNoiseTile(u, v, 96, 409);

      // Coconut palm diagonal/horizontal leaf-scar growth rings with weathered ridge
      const ringCoord = v * 28 + Math.sin(u * Math.PI * 2) * 0.16 + (coarse - 0.5) * 0.45;
      const ringFrac = ringCoord - Math.floor(ringCoord);
      const ringNotch = ringFrac < 0.2 ? Math.sin((ringFrac / 0.2) * Math.PI) : 0;

      const idxPix = y * w + x;
      const hVal = coarse * 0.42 + fibers * 0.36 + micro * 0.14 - ringNotch * 0.45;
      height[idxPix] = hVal;
      rough[idxPix] = THREE.MathUtils.clamp(0.86 + ringNotch * 0.1 + (0.5 - fibers) * 0.08, 0.78, 0.98);

      // Sun-bleached grey-brown weathered coconut palm bark palette
      const tone = (coarse - 0.5) * 32 + (fibers - 0.5) * 22 - ringNotch * 38;
      const bleach = smoothNoiseTile(u, v, 4, 521) * 18;
      const idx = idxPix * 4;
      img.data[idx] = Math.max(0, Math.min(255, Math.round(118 + tone + bleach)));
      img.data[idx + 1] = Math.max(0, Math.min(255, Math.round(92 + tone * 0.85 + bleach * 0.95)));
      img.data[idx + 2] = Math.max(0, Math.min(255, Math.round(70 + tone * 0.72 + bleach * 0.9)));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(1, 5);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = Math.min(4, maxAnisotropy);

  const normalMap = buildNormalFromHeight(height, w, h, 3.6, maxAnisotropy);
  normalMap.repeat.set(1, 5);
  const roughnessMap = buildGrayscaleDataTexture(rough, w, h, maxAnisotropy);
  roughnessMap.repeat.set(1, 5);

  return { albedoMap, normalMap, roughnessMap };
}

function buildPhotorealCoconutTextures(maxAnisotropy: number) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const strand = fbmTile(u * 2, v * 0.5, 16, 3, 701);
      const fiber = smoothNoiseTile(u, v, 64, 733);
      const idxPix = y * size + x;
      height[idxPix] = strand * 0.65 + fiber * 0.35;
      rough[idxPix] = THREE.MathUtils.clamp(0.72 + (1 - fiber) * 0.2, 0.62, 0.94);

      const shade = (strand - 0.5) * 32 + (fiber - 0.5) * 18;
      const idx = idxPix * 4;
      img.data[idx] = Math.max(0, Math.min(255, Math.round(92 + shade)));
      img.data[idx + 1] = Math.max(0, Math.min(255, Math.round(68 + shade * 0.8)));
      img.data[idx + 2] = Math.max(0, Math.min(255, Math.round(36 + shade * 0.55)));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = Math.min(4, maxAnisotropy);

  const normalMap = buildNormalFromHeight(height, size, size, 2.8, maxAnisotropy);
  const roughnessMap = buildGrayscaleDataTexture(rough, size, size, maxAnisotropy);
  return { albedoMap, normalMap, roughnessMap };
}

function buildPhotorealPalmFrondTextures(maxAnisotropy: number) {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  // Height canvas for generating matching botanical normal + roughness relief
  const hCanvas = document.createElement('canvas');
  hCanvas.width = w;
  hCanvas.height = h;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, w, h);

  // Woody central rachis spine
  const spineGrad = ctx.createLinearGradient(0, h, 0, 0);
  spineGrad.addColorStop(0, '#5a6b24');
  spineGrad.addColorStop(0.65, '#728732');
  spineGrad.addColorStop(1, '#8ca03e');
  ctx.strokeStyle = spineGrad;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h - 6);
  ctx.lineTo(w * 0.5, 16);
  ctx.stroke();

  hCtx.strokeStyle = '#ffffff';
  hCtx.lineWidth = 10;
  hCtx.lineCap = 'round';
  hCtx.beginPath();
  hCtx.moveTo(w * 0.5, h - 6);
  hCtx.lineTo(w * 0.5, 16);
  hCtx.stroke();

  const pairs = 32;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const yBase = THREE.MathUtils.lerp(h - 24, 18, t);
    const envelope = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.92 + 0.14);
    const span = (212 * envelope + 28) * (1 - t * 0.22);
    const width = 9.5 + (1 - t) * 4.5;
    const tipSweep = 28 + t * 18;

    for (const side of [-1, 1]) {
      const tipX = w * 0.5 + side * span;
      const tipY = yBase - tipSweep;
      const tipDry = hash(i * 19 + side * 7) > 0.72;
      const lg = ctx.createLinearGradient(w * 0.5, yBase, tipX, tipY);
      lg.addColorStop(0, '#2a5219');
      lg.addColorStop(0.55, '#467427');
      lg.addColorStop(1, tipDry ? '#829435' : '#6c9634');

      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, yBase - width * 0.45);
      ctx.quadraticCurveTo(w * 0.5 + side * span * 0.55, yBase - tipSweep * 0.7 - width * 0.55, tipX, tipY);
      ctx.quadraticCurveTo(w * 0.5 + side * span * 0.52, yBase - tipSweep * 0.3 + width * 0.45, w * 0.5, yBase + width * 0.45);
      ctx.closePath();
      ctx.fill();

      // Subtle midrib ridge per leaflet for realistic light catching
      ctx.strokeStyle = 'rgba(130, 165, 65, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, yBase);
      ctx.quadraticCurveTo(w * 0.5 + side * span * 0.54, yBase - tipSweep * 0.5, tipX, tipY);
      ctx.stroke();

      hCtx.fillStyle = '#a8a8a8';
      hCtx.beginPath();
      hCtx.moveTo(w * 0.5, yBase - width * 0.45);
      hCtx.quadraticCurveTo(w * 0.5 + side * span * 0.55, yBase - tipSweep * 0.7 - width * 0.55, tipX, tipY);
      hCtx.quadraticCurveTo(w * 0.5 + side * span * 0.52, yBase - tipSweep * 0.3 + width * 0.45, w * 0.5, yBase + width * 0.45);
      hCtx.closePath();
      hCtx.fill();

      hCtx.strokeStyle = '#dcdcdc';
      hCtx.lineWidth = 2.0;
      hCtx.beginPath();
      hCtx.moveTo(w * 0.5, yBase);
      hCtx.quadraticCurveTo(w * 0.5 + side * span * 0.54, yBase - tipSweep * 0.5, tipX, tipY);
      hCtx.stroke();
    }
  }

  const hPixels = hCtx.getImageData(0, 0, w, h).data;
  const hField = new Float32Array(w * h);
  const rField = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const val = hPixels[i * 4] / 255;
    hField[i] = val + smoothNoiseTile((i % w) / w, Math.floor(i / w) / h, 64, 881) * 0.08;
    // Waxy upper leaf cuticle (0.38–0.56), drier midrib spine (0.68)
    rField[i] = val > 0.85 ? 0.68 : THREE.MathUtils.clamp(0.42 + (1 - val) * 0.16, 0.36, 0.62);
  }

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = Math.min(4, maxAnisotropy);

  const normalMap = buildNormalFromHeight(hField, w, h, 2.6, maxAnisotropy);
  const roughnessMap = buildGrayscaleDataTexture(rField, w, h, maxAnisotropy);

  return { albedoMap, normalMap, roughnessMap };
}

function buildPhotorealBroadLeafTextures(maxAnisotropy: number) {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const hCanvas = document.createElement('canvas');
  hCanvas.width = w;
  hCanvas.height = h;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#2a551b');
  grad.addColorStop(0.5, '#467426');
  grad.addColorStop(1, '#6f9637');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(128, 502);
  ctx.bezierCurveTo(22, 390, 12, 170, 128, 12);
  ctx.bezierCurveTo(244, 170, 234, 390, 128, 502);
  ctx.closePath();
  ctx.fill();

  hCtx.fillStyle = '#a0a0a0';
  hCtx.beginPath();
  hCtx.moveTo(128, 502);
  hCtx.bezierCurveTo(22, 390, 12, 170, 128, 12);
  hCtx.bezierCurveTo(244, 170, 234, 390, 128, 502);
  hCtx.closePath();
  hCtx.fill();

  ctx.strokeStyle = '#8cb04a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(128, 502);
  ctx.lineTo(128, 24);
  ctx.stroke();

  hCtx.strokeStyle = '#ffffff';
  hCtx.lineWidth = 7;
  hCtx.beginPath();
  hCtx.moveTo(128, 502);
  hCtx.lineTo(128, 24);
  hCtx.stroke();

  ctx.strokeStyle = 'rgba(148, 185, 76, 0.48)';
  ctx.lineWidth = 2;
  hCtx.strokeStyle = '#d4d4d4';
  hCtx.lineWidth = 2.5;
  for (let y = 70; y < 440; y += 22) {
    ctx.beginPath();
    ctx.moveTo(128, y);
    ctx.quadraticCurveTo(75, y - 16, 36, y - 30);
    ctx.moveTo(128, y);
    ctx.quadraticCurveTo(181, y - 16, 220, y - 30);
    ctx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(128, y);
    hCtx.quadraticCurveTo(75, y - 16, 36, y - 30);
    hCtx.moveTo(128, y);
    hCtx.quadraticCurveTo(181, y - 16, 220, y - 30);
    hCtx.stroke();
  }

  const hPixels = hCtx.getImageData(0, 0, w, h).data;
  const hField = new Float32Array(w * h);
  const rField = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const val = hPixels[i * 4] / 255;
    hField[i] = val;
    rField[i] = val > 0.85 ? 0.62 : THREE.MathUtils.clamp(0.4 + (1 - val) * 0.15, 0.36, 0.56);
  }

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = Math.min(4, maxAnisotropy);

  const normalMap = buildNormalFromHeight(hField, w, h, 2.4, maxAnisotropy);
  const roughnessMap = buildGrayscaleDataTexture(rField, w, h, maxAnisotropy);

  return { albedoMap, normalMap, roughnessMap };
}

function buildPhotorealRockTextures(maxAnisotropy: number) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const strata = fbmTile(u, v * 2.5, 6, 4, 911);
      const pitting = smoothNoiseTile(u, v, 48, 947);
      const grain = smoothNoiseTile(u, v, 112, 991);

      const crackSig = Math.abs(fbmTile(u, v, 10, 3, 977) - 0.5);
      const crack = crackSig < 0.025 ? (0.025 - crackSig) * 18 : 0;

      const idxPix = y * size + x;
      height[idxPix] = strata * 0.55 + pitting * 0.25 + grain * 0.2 - crack * 0.5;
      rough[idxPix] = THREE.MathUtils.clamp(0.76 + crack * 0.2 + (0.5 - grain) * 0.14, 0.66, 0.97);

      const fleck = grain > 0.85 ? 16 : grain < 0.15 ? -20 : 0;
      const shade = (strata - 0.5) * 44 + (pitting - 0.5) * 20 - crack * 46 + fleck;

      // Sun-weathered warm granite/laterite coastal stone
      const idx = idxPix * 4;
      img.data[idx] = Math.max(0, Math.min(255, Math.round(138 + shade)));
      img.data[idx + 1] = Math.max(0, Math.min(255, Math.round(120 + shade * 0.92)));
      img.data[idx + 2] = Math.max(0, Math.min(255, Math.round(102 + shade * 0.82)));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = Math.min(4, maxAnisotropy);

  const normalMap = buildNormalFromHeight(height, size, size, 3.2, maxAnisotropy);
  const roughnessMap = buildGrayscaleDataTexture(rough, size, size, maxAnisotropy);
  return { albedoMap, normalMap, roughnessMap };
}

function buildPhotorealBeachGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const blades = [
    { x0: 64, x1: 60, w: 12, h: 242, top: '#78943a', bot: '#34581e' },
    { x0: 52, x1: 24, w: 10, h: 215, top: '#8ea244', bot: '#3d6322' },
    { x0: 76, x1: 104, w: 10, h: 222, top: '#9da74c', bot: '#3e6122' },
    { x0: 42, x1: 12, w: 8, h: 175, top: '#a89f4e', bot: '#4a6825' },
    { x0: 86, x1: 116, w: 8, h: 185, top: '#b0a252', bot: '#486524' },
  ];
  for (const b of blades) {
    const g = ctx.createLinearGradient(0, h, 0, h - b.h);
    g.addColorStop(0, b.bot);
    g.addColorStop(1, b.top);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x0 - b.w * 0.5, h);
    ctx.quadraticCurveTo((b.x0 + b.x1) * 0.5 - b.w * 0.25, h - b.h * 0.58, b.x1, h - b.h);
    ctx.quadraticCurveTo((b.x0 + b.x1) * 0.5 + b.w * 0.25, h - b.h * 0.58, b.x0 + b.w * 0.5, h);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

function buildPhotorealCumulusCloudTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);

  // Volumetric-lit FBM equatorial cumulus cloud silhouette (lit warm sunlit tops, cool blue-grey undersides)
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const dx = (u - 0.5) * 2.0;
      const dy = (v - 0.56) * 2.2;

      // Overlapping billowing cumulus mask + flat cumulus base
      const lobe1 = Math.exp(-(dx * dx * 2.4 + (dy + 0.15) * (dy + 0.15) * 3.1));
      const lobe2 = Math.exp(-((dx + 0.34) * (dx + 0.34) * 3.8 + dy * dy * 4.2)) * 0.85;
      const lobe3 = Math.exp(-((dx - 0.32) * (dx - 0.32) * 3.5 + (dy - 0.05) * (dy - 0.05) * 4.0)) * 0.88;
      const lobe4 = Math.exp(-((dx + 0.58) * (dx + 0.58) * 6.5 + (dy - 0.18) * (dy - 0.18) * 6.2)) * 0.65;
      const lobe5 = Math.exp(-((dx - 0.58) * (dx - 0.58) * 6.5 + (dy - 0.18) * (dy - 0.18) * 6.2)) * 0.65;
      const baseEnvelope = Math.max(lobe1, lobe2, lobe3, lobe4, lobe5);

      const fbmVal = fbmTile(u, v, 4, 4, 601);
      const detail = smoothNoiseTile(u, v, 24, 641);
      const density = baseEnvelope * 0.92 + (fbmVal - 0.42) * 0.62 + (detail - 0.5) * 0.14;
      const flatBottom = v > 0.78 ? Math.max(0, 1 - (v - 0.78) / 0.18) : 1.0;
      const alpha = THREE.MathUtils.clamp((density - 0.34) * 2.2 * flatBottom, 0, 0.94);

      // Sunlit upper cream highlights vs soft blue-grey self-shadowed cloud belly
      const lightShade = THREE.MathUtils.clamp((1 - v) * 0.82 + fbmVal * 0.35 - 0.18, 0, 1);
      const r = Math.round(THREE.MathUtils.lerp(196, 255, lightShade));
      const g = Math.round(THREE.MathUtils.lerp(212, 253, lightShade));
      const b = Math.round(THREE.MathUtils.lerp(228, 248, lightShade));

      const idx = (y * w + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCurvedPalmFrondGeo(length: number, width: number, droop: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, length, 4, 11);
  geo.translate(0, length * 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const t = Math.max(0, Math.min(1, vy / length));
    const archForward = t * length * 0.88;
    const archHeight = Math.sin(t * Math.PI * 0.78) * length * 0.34 - Math.pow(t, 2.2) * length * droop;
    const vWingDrop = -Math.abs(vx) * (0.24 + t * 0.16);
    pos.setXYZ(i, vx, archHeight + vWingDrop, archForward);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBroadShrubLeafGeo(length: number, width: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, length, 3, 8);
  geo.translate(0, length * 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const t = Math.max(0, Math.min(1, vy / length));
    const forward = t * length * 0.64;
    const up = Math.sin(t * Math.PI * 0.65) * length * 0.72;
    const vFold = Math.abs(vx) * 0.15;
    pos.setXYZ(i, vx, up + vFold, forward);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildTaperedPalmTrunkGeo(
  height: number,
  leanDist: number,
  rBase: number,
  rTop: number
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.08, 0),
    new THREE.Vector3(leanDist * 0.15, height * 0.34, 0),
    new THREE.Vector3(leanDist * 0.58, height * 0.7, 0),
    new THREE.Vector3(leanDist, height, 0),
  ]);
  const tubularSegs = 16;
  const radialSegs = 12;
  const geo = new THREE.TubeGeometry(curve, tubularSegs, rBase, radialSegs, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, center);
    const scale = THREE.MathUtils.lerp(1.0, rTop / rBase, t);
    for (let j = 0; j <= radialSegs; j++) {
      const idx = i * (radialSegs + 1) + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(center).multiplyScalar(scale).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function beachSurfaceY(x: number, z: number): number {
  const inCourtX = Math.abs(x - 0.25) < 4.2;
  const inCourtZ = z > -4.6 && z < 5.6;
  if (inCourtX && inCourtZ) {
    return groundHeightAt(x, z);
  }
  const shore = entebbeShoreZ(x);
  const distFromShore = z - shore;
  if (distFromShore < 1.65) {
    const tSubmerge = THREE.MathUtils.clamp((1.65 - distFromShore) / 1.5, 0, 1);
    const smoothT = tSubmerge * tSubmerge * (3 - 2 * tSubmerge);
    const extraDepth = distFromShore < 0.15 ? Math.min(1.6, (0.15 - distFromShore) * 0.22) : 0;
    return THREE.MathUtils.lerp(0.015, -0.26, smoothT) - extraDepth;
  }
  const gentleSlope = Math.min(0.24, Math.max(0, (distFromShore - 1.65) * 0.022));
  const ripple = Math.sin(x * 0.16 + 0.5) * Math.cos(z * 0.14 - 0.3) * 0.045;
  const backRise = z > 10 ? Math.min(0.85, (z - 10) * 0.03) : 0;
  return 0.015 + gentleSlope + ripple + backRise;
}

export function buildEntebbeLakesideEnvironment(options: {
  isSoftwareGl: boolean;
  shadowsEnabled: () => boolean;
  maxAnisotropy: number;
}): EntebbeLakesideRig {
  const group = new THREE.Group();
  group.name = 'EntebbeLakesideCove';

  const trackedGeos = new Set<THREE.BufferGeometry>();
  const trackedMats = new Set<THREE.Material>();
  const trackedTexs = new Set<THREE.Texture>();
  const shadowsActive = () => !options.isSoftwareGl && options.shadowsEnabled();

  const sandTex = buildPhotorealSandTextures(options.maxAnisotropy);
  const barkTex = buildPhotorealPalmBarkTextures(options.maxAnisotropy);
  const cocoTex = buildPhotorealCoconutTextures(options.maxAnisotropy);
  const frondTex = buildPhotorealPalmFrondTextures(options.maxAnisotropy);
  const broadLeafTex = buildPhotorealBroadLeafTextures(options.maxAnisotropy);
  const rockTex = buildPhotorealRockTextures(options.maxAnisotropy);
  const beachGrassTex = buildPhotorealBeachGrassTexture(options.maxAnisotropy);
  const cloudTex = buildPhotorealCumulusCloudTexture();

  for (const t of [
    sandTex.albedoMap,
    sandTex.normalMap,
    sandTex.roughnessMap,
    sandTex.aoMap,
    barkTex.albedoMap,
    barkTex.normalMap,
    barkTex.roughnessMap,
    cocoTex.albedoMap,
    cocoTex.normalMap,
    cocoTex.roughnessMap,
    frondTex.albedoMap,
    frondTex.normalMap,
    frondTex.roughnessMap,
    broadLeafTex.albedoMap,
    broadLeafTex.normalMap,
    broadLeafTex.roughnessMap,
    rockTex.albedoMap,
    rockTex.normalMap,
    rockTex.roughnessMap,
    beachGrassTex,
    cloudTex,
  ]) {
    trackedTexs.add(t);
  }

  const waterTimeUniform = { value: 0 };
  const weatherWetnessUniform = { value: 0 };

  // =========================================================================
  // 1. PHOTOREALISTIC BEACH COVE (4-Map PBR Sand + Capillary Wet-Sand Band)
  // =========================================================================
  const beachW = 200;
  const beachD = 144;
  const beachGeo = new THREE.PlaneGeometry(beachW, beachD, 168, 136);
  beachGeo.rotateX(-Math.PI / 2);
  beachGeo.translate(0, 0, -6);

  const bPos = beachGeo.attributes.position as THREE.BufferAttribute;
  const bUv = beachGeo.attributes.uv as THREE.BufferAttribute;
  const bColors = new Float32Array(bPos.count * 3);
  const drySandColor = new THREE.Color('#ffffff');
  const wetSandColor = new THREE.Color('#8e6a3e');
  const sunBleachColor = new THREE.Color('#f8ebd2');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < bPos.count; i++) {
    const x = bPos.getX(i);
    const z = bPos.getZ(i);
    const shore = entebbeShoreZ(x);
    const distFromShore = z - shore;

    const inCourtBlendX = Math.max(0, Math.min(1, (Math.abs(x - 0.25) - 4.0) / 3.0));
    const inCourtBlendZ = Math.max(0, Math.min(1, Math.max(-4.5 - z, z - 5.4) / 2.6));
    const outerBlend = Math.max(inCourtBlendX, inCourtBlendZ);

    const courtY = groundHeightAt(x, z) - 0.002;
    const coastY = beachSurfaceY(x, z) - 0.002;
    const y = THREE.MathUtils.lerp(courtY, coastY, outerBlend);

    bPos.setY(i, y);
    bUv.setXY(i, (x + beachW * 0.5) / 2.6, (z + beachD * 0.5) / 2.6);

    tmpCol.copy(drySandColor);
    if (distFromShore < 2.2) {
      const wetBand = 1 - THREE.MathUtils.clamp((distFromShore - 0.05) / 2.15, 0, 1);
      tmpCol.lerp(wetSandColor, wetBand * 0.84);
    } else if (outerBlend > 0.25) {
      tmpCol.lerp(sunBleachColor, outerBlend * 0.12);
    }

    bColors[i * 3] = tmpCol.r;
    bColors[i * 3 + 1] = tmpCol.g;
    bColors[i * 3 + 2] = tmpCol.b;
  }
  beachGeo.setAttribute('color', new THREE.BufferAttribute(bColors, 3));
  beachGeo.setAttribute('uv2', bUv);
  beachGeo.computeVertexNormals();
  trackedGeos.add(beachGeo);

  const sandMat = new THREE.MeshStandardMaterial({
    map: sandTex.albedoMap,
    normalMap: sandTex.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: sandTex.roughnessMap,
    roughness: 0.94,
    metalness: 0.02,
    aoMap: sandTex.aoMap,
    aoMapIntensity: 0.65,
    vertexColors: true,
  });
  sandMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWeatherWetness = weatherWetnessUniform;
    shader.vertexShader =
      `varying vec3 vSandWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vSandWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );
    shader.fragmentShader =
      `
      varying vec3 vSandWorldPos;
      uniform float uWeatherWetness;

      float sandShoreZAt(float x) {
        float dxLeft = max(0.0, -1.6 - x);
        float leftPen = x < -1.6 ? -24.5 * sin(min(2.89, dxLeft * 0.088)) : 0.0;
        float rightCove = x > 2.2 ? min(3.2, pow(max(0.0001, (x - 2.2) * 0.14), 1.15) * 2.0) : 0.0;
        float ripple = sin(x * 0.2 + 0.4) * 0.5 + cos(x * 0.08 - 0.5) * 0.3;
        return -6.5 + leftPen + rightCove + ripple;
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float sb1 = sin(vSandWorldPos.x * 0.36 + cos(vSandWorldPos.z * 0.31)) * 0.5 + 0.5;
          float sb2 = cos(vSandWorldPos.z * 0.72 - sin(vSandWorldPos.x * 0.64)) * 0.5 + 0.5;
          diffuseColor.rgb *= mix(0.91, 1.06, sb1 * 0.62 + sb2 * 0.38);

          float shoreDistS = vSandWorldPos.z - sandShoreZAt(vSandWorldPos.x);
          float shoreWet = 1.0 - smoothstep(-0.08, 1.75, shoreDistS);
          float wetAmt = max(shoreWet * 0.9, uWeatherWetness * 0.48);
          diffuseColor.rgb *= mix(1.0, 0.64, wetAmt);
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          #include <roughnessmap_fragment>
          float shoreDistR = vSandWorldPos.z - sandShoreZAt(vSandWorldPos.x);
          float shoreWetR = 1.0 - smoothstep(-0.08, 1.65, shoreDistR);
          roughnessFactor = mix(roughnessFactor, 0.17, max(shoreWetR, uWeatherWetness * 0.6));
          `
        );
  };
  sandMat.customProgramCacheKey = () => 'entebbe-pbr-beach-sand-v4';
  trackedMats.add(sandMat);

  const beachMesh = new THREE.Mesh(beachGeo, sandMat);
  beachMesh.name = 'EntebbeGoldenBeach';
  beachMesh.userData.__noCastShadow = true;
  beachMesh.castShadow = false;
  beachMesh.receiveShadow = shadowsActive();
  group.add(beachMesh);

  // =========================================================================
  // 2. PHOTOREALISTIC LAKE VICTORIA WATER (Fresnel Sky + Sun Glitter + Lacy Surf)
  // =========================================================================
  const waterGeo = new THREE.PlaneGeometry(340, 230, 96, 64);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, WATER_Y, -112);
  trackedGeos.add(waterGeo);

  const waterMat = new THREE.MeshStandardMaterial({
    color: '#1da1b3',
    roughness: 0.08,
    metalness: 0.06,
    envMapIntensity: 1.25,
    transparent: true,
    opacity: 0.96,
  });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterTimeUniform;
    shader.vertexShader =
      `
      uniform float uWaterTime;
      varying vec3 vWaterWorldPos;

      float vShoreZAt(float x) {
        float dxLeft = max(0.0, -1.6 - x);
        float leftPen = x < -1.6 ? -24.5 * sin(min(2.89, dxLeft * 0.088)) : 0.0;
        float rightCove = x > 2.2 ? min(3.2, pow(max(0.0001, (x - 2.2) * 0.14), 1.15) * 2.0) : 0.0;
        float ripple = sin(x * 0.2 + 0.4) * 0.5 + cos(x * 0.08 - 0.5) * 0.3;
        return -6.5 + leftPen + rightCove + ripple;
      }
      ` +
      shader.vertexShader
        .replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float sZV = vShoreZAt(transformed.x);
          float waveMask = smoothstep(0.0, 2.8, sZV - transformed.z);
          float w1 = sin(transformed.x * 0.42 + uWaterTime * 1.45) * 0.02;
          float w2 = cos(transformed.z * 0.55 - uWaterTime * 1.2) * 0.018;
          transformed.y += (w1 + w2) * waveMask;
          `
        )
        .replace(
          '#include <worldpos_vertex>',
          `
          #include <worldpos_vertex>
          vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          `
        );

    shader.fragmentShader =
      `
      uniform float uWaterTime;
      varying vec3 vWaterWorldPos;

      float shoreZAt(float x) {
        float dxLeft = max(0.0, -1.6 - x);
        float leftPen = x < -1.6 ? -24.5 * sin(min(2.89, dxLeft * 0.088)) : 0.0;
        float rightCove = x > 2.2 ? min(3.2, pow(max(0.0001, (x - 2.2) * 0.14), 1.15) * 2.0) : 0.0;
        float ripple = sin(x * 0.2 + 0.4) * 0.5 + cos(x * 0.08 - 0.5) * 0.3;
        return -6.5 + leftPen + rightCove + ripple;
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float sZ = shoreZAt(vWaterWorldPos.x);
          float shoreDist = sZ - vWaterWorldPos.z;
          if (shoreDist < -0.02) discard;

          // Natural sunny Lake Victoria palette (sandy translucent shallow -> emerald teal -> deep cerulean)
          vec3 shallowCol = vec3(0.46, 0.80, 0.74);
          vec3 midCol = vec3(0.08, 0.56, 0.67);
          vec3 deepCol = vec3(0.035, 0.35, 0.53);

          float depthT1 = smoothstep(0.0, 6.8, shoreDist);
          float depthT2 = smoothstep(6.8, 48.0, shoreDist);
          vec3 lakeBase = mix(shallowCol, midCol, depthT1);
          lakeBase = mix(lakeBase, deepCol, depthT2);

          // Multi-directional sunlit caustics in clear shallows
          float rA = sin(vWaterWorldPos.x * 1.55 + vWaterWorldPos.z * 0.95 - uWaterTime * 1.85);
          float rB = cos(vWaterWorldPos.x * 1.25 - vWaterWorldPos.z * 1.75 + uWaterTime * 1.45);
          float rC = sin(vWaterWorldPos.x * 2.9 - vWaterWorldPos.z * 2.2 - uWaterTime * 1.3);
          float caustic = smoothstep(0.58, 0.98, (rA + rB + rC * 0.5) * 0.4 + 0.5);
          lakeBase += vec3(0.11, 0.16, 0.13) * caustic * (1.0 - depthT2 * 0.75);

          // Multi-scale water normal perturbation for Fresnel & sun glint
          float wnX = cos(vWaterWorldPos.x * 2.6 + vWaterWorldPos.z * 1.8 - uWaterTime * 2.1) * 0.09
                    + sin(vWaterWorldPos.x * 6.2 - vWaterWorldPos.z * 4.5 + uWaterTime * 2.8) * 0.045;
          float wnZ = sin(vWaterWorldPos.z * 3.1 - vWaterWorldPos.x * 1.5 + uWaterTime * 1.8) * 0.09
                    + cos(vWaterWorldPos.z * 5.8 + vWaterWorldPos.x * 4.9 - uWaterTime * 2.5) * 0.045;
          vec3 waterN = normalize(vec3(wnX, 1.0, wnZ));
          vec3 viewDirW = normalize(cameraPosition - vWaterWorldPos);

          // Grazing-angle sky reflection (Fresnel)
          float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(waterN, viewDirW), 0.0), 4.2);
          vec3 skyRefl = mix(vec3(0.45, 0.74, 0.92), vec3(0.84, 0.93, 0.98), fresnel);
          lakeBase = mix(lakeBase, skyRefl, clamp(fresnel * 0.62, 0.0, 0.68));

          // Sun specular glitter across lake ripples (aligned with lakeside azimuth 145°, elev 40°)
          vec3 sunDirW = normalize(vec3(0.44, 0.64, -0.63));
          vec3 halfW = normalize(sunDirW + viewDirW);
          float glitter = pow(max(dot(waterN, halfW), 0.0), 140.0) * 0.75
                        + pow(max(dot(waterN, halfW), 0.0), 28.0) * 0.12;
          lakeBase += vec3(1.0, 0.97, 0.88) * glitter * smoothstep(0.4, 2.5, shoreDist);

          // Boat waterline wake ring around (3.1, -11.8)
          float boatDist = length((vWaterWorldPos.xz - vec2(3.1, -11.8)) * vec2(0.55, 1.0));
          float boatWake = smoothstep(1.9, 1.35, boatDist) * smoothstep(0.75, 1.3, boatDist)
            * (0.45 + 0.35 * sin(boatDist * 9.0 - uWaterTime * 2.4));

          // Domain-warped organic frothy surf foam along the beach curve
          float laceNoise = sin(vWaterWorldPos.x * 4.8 + cos(vWaterWorldPos.z * 5.4) * 1.4) * 0.5
                          + cos(vWaterWorldPos.x * 11.2 - vWaterWorldPos.z * 9.8) * 0.32;
          float wavePhase = sin(shoreDist * 4.0 - uWaterTime * 2.0 + sin(vWaterWorldPos.x * 0.45) * 1.1 + laceNoise * 0.55);
          float foamPrimary = (1.0 - smoothstep(0.02, 0.46 + laceNoise * 0.12, shoreDist)) * (0.68 + 0.32 * wavePhase);
          float foamCrest = smoothstep(0.64, 0.95, wavePhase + laceNoise * 0.14) * smoothstep(2.4, 0.18, shoreDist) * 0.7;
          float foamTotal = clamp(foamPrimary + foamCrest + boatWake * 0.52, 0.0, 1.0);

          diffuseColor.rgb = mix(lakeBase, vec3(0.95, 0.97, 0.98), foamTotal * 0.88);
          float shoreAlpha = smoothstep(0.0, 0.42, shoreDist);
          diffuseColor.a = mix(0.64, 0.96, smoothstep(0.0, 2.2, shoreDist)) * shoreAlpha;
          `
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #include <normal_fragment_maps>
          float nX = cos(vWaterWorldPos.x * 2.6 + vWaterWorldPos.z * 1.8 - uWaterTime * 2.1) * 0.08
                   + sin(vWaterWorldPos.x * 6.2 - vWaterWorldPos.z * 4.5 + uWaterTime * 2.8) * 0.04;
          float nZ = sin(vWaterWorldPos.z * 3.1 - vWaterWorldPos.x * 1.5 + uWaterTime * 1.8) * 0.08
                   + cos(vWaterWorldPos.z * 5.8 + vWaterWorldPos.x * 4.9 - uWaterTime * 2.5) * 0.04;
          normal = normalize(normal + vec3(nX, 0.0, nZ));
          `
        );
  };
  waterMat.customProgramCacheKey = () => 'entebbe-pbr-lake-victoria-v4';
  trackedMats.add(waterMat);

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'LakeVictoriaWater';
  waterMesh.userData.__noCastShadow = true;
  waterMesh.castShadow = false;
  waterMesh.receiveShadow = shadowsActive();
  group.add(waterMesh);

  // =========================================================================
  // 3. PHOTOREALISTIC CURVED COCONUT PALMS (PBR Bark + Husk Coconuts + Leaf Normals)
  // =========================================================================
  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex.albedoMap,
    normalMap: barkTex.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: barkTex.roughnessMap,
    roughness: 0.94,
    metalness: 0.02,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    map: cocoTex.albedoMap,
    normalMap: cocoTex.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: cocoTex.roughnessMap,
    roughness: 0.85,
    metalness: 0.02,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    map: frondTex.albedoMap,
    normalMap: frondTex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: frondTex.roughnessMap,
    roughness: 0.52,
    metalness: 0.03,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
  frondMat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec2 vFrondUv;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vFrondUv = uv;
        `
      );
    shader.fragmentShader =
      `varying vec2 vFrondUv;\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        // Subtle tropical leaf sunlight translucency along outer leaflets
        totalEmissiveRadiance += diffuseColor.rgb * 0.11 * smoothstep(0.2, 0.95, vFrondUv.y);
        `
      );
  };
  applyNaturalWindShader(frondMat, {
    swayScaleM: 0.12,
    flutterScaleM: 0.038,
    heightMode: 'uv',
    bendExponent: 1.5,
  });
  frondMat.customProgramCacheKey = () => 'entebbe-pbr-palm-frond-v4';

  trackedMats.add(barkMat);
  trackedMats.add(coconutMat);
  trackedMats.add(frondMat);

  const frondGeoLong = buildCurvedPalmFrondGeo(2.05, 1.02, 0.38);
  const frondGeoShort = buildCurvedPalmFrondGeo(1.08, 0.58, 0.32);
  const cocoGeo = new THREE.SphereGeometry(0.115, 12, 10);
  cocoGeo.scale(0.92, 1.15, 0.92);
  const sheathGeo = new THREE.CylinderGeometry(0.16, 0.11, 0.28, 10);
  trackedGeos.add(frondGeoLong);
  trackedGeos.add(frondGeoShort);
  trackedGeos.add(cocoGeo);
  trackedGeos.add(sheathGeo);

  const palmSpecs = [
    { x: -4.8, z: -2.2, h: 3.15, lean: 1.35, rotY: 0.28 },
    { x: -6.1, z: -6.4, h: 3.85, lean: 1.7, rotY: 0.12 },
    { x: -8.9, z: -11.6, h: 4.5, lean: 1.6, rotY: -0.15 },
    { x: -11.8, z: -17.4, h: 4.05, lean: 1.4, rotY: 0.25 },
    { x: -15.2, z: -23.6, h: 4.95, lean: 1.65, rotY: 0.1 },
    { x: -18.8, z: -28.2, h: 4.35, lean: 1.25, rotY: -0.22 },
    { x: -7.1, z: 2.9, h: 4.3, lean: 1.1, rotY: 0.65 },
    { x: 4.75, z: 1.3, h: 3.45, lean: 1.25, rotY: Math.PI - 0.25 },
    { x: 5.8, z: -2.3, h: 4.35, lean: 1.5, rotY: Math.PI - 0.45 },
    { x: 7.3, z: 4.0, h: 4.85, lean: 1.2, rotY: Math.PI + 0.22 },
    { x: -7.2, z: 10.6, h: 5.2, lean: 1.1, rotY: -1.1 },
    { x: 6.8, z: 11.0, h: 5.0, lean: 1.0, rotY: -2.1 },
  ];

  const frondMatrices: THREE.Matrix4[] = [];
  const frondColors: THREE.Color[] = [];
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();

  palmSpecs.forEach((p, idx) => {
    const palmGrp = new THREE.Group();
    palmGrp.name = `EntebbePalm_${idx}`;
    const trunkGeo = buildTaperedPalmTrunkGeo(p.h, p.lean, 0.19, 0.085);
    trackedGeos.add(trunkGeo);

    const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
    trunkMesh.castShadow = shadowsActive();
    trunkMesh.receiveShadow = shadowsActive();
    palmGrp.add(trunkMesh);

    const gy = beachSurfaceY(p.x, p.z) - 0.04;
    palmGrp.position.set(p.x, gy, p.z);
    palmGrp.rotation.y = p.rotY;

    const crownLocal = new THREE.Vector3(p.lean, p.h, 0);
    // Woody fibrous palm crown petiole sheath connecting trunk cleanly to fronds
    const sheath = new THREE.Mesh(sheathGeo, barkMat);
    sheath.position.set(crownLocal.x, crownLocal.y - 0.08, crownLocal.z);
    sheath.castShadow = shadowsActive();
    palmGrp.add(sheath);

    for (let c = 0; c < 4; c++) {
      const ca = (c / 4) * Math.PI * 2 + idx * 0.7;
      const coco = new THREE.Mesh(cocoGeo, coconutMat);
      coco.position.set(
        crownLocal.x + Math.cos(ca) * 0.13,
        crownLocal.y - 0.16,
        crownLocal.z + Math.sin(ca) * 0.13
      );
      coco.castShadow = shadowsActive();
      palmGrp.add(coco);
    }
    group.add(palmGrp);

    palmGrp.updateMatrixWorld(true);
    const crownWorld = crownLocal.clone().applyMatrix4(palmGrp.matrixWorld);
    const frondCount = 14;
    for (let f = 0; f < frondCount; f++) {
      const tier = f < 6 ? 0 : 1;
      const az = (f / frondCount) * Math.PI * 2 + idx * 0.41 + tier * 0.28;
      const pitch = tier === 0 ? -0.34 : 0.14;
      const sc = (0.88 + hash(idx * 17 + f) * 0.28) * Math.max(0.8, p.h / 4.2);

      dummy.position.copy(crownWorld);
      dummy.rotation.set(0, az, 0);
      dummy.rotateX(pitch);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      frondMatrices.push(dummy.matrix.clone());

      // Natural varied olive-emerald tints (less neon saturation for photorealism)
      cTmp.set(tier === 0 ? '#b7c985' : '#8faa63').lerp(new THREE.Color('#d2dca0'), hash(f * 13 + idx) * 0.35);
      frondColors.push(cTmp.clone());
    }
  });

  const smallPalmSpots = [
    { x: 4.5, z: 2.3, sc: 0.9 },
    { x: -4.45, z: -3.7, sc: 0.88 },
    { x: -6.8, z: -8.6, sc: 0.98 },
    { x: -13.6, z: -20.5, sc: 0.95 },
  ];
  const smallFrondMatrices: THREE.Matrix4[] = [];
  const smallFrondColors: THREE.Color[] = [];
  smallPalmSpots.forEach((sp, sIdx) => {
    const gy = beachSurfaceY(sp.x, sp.z);
    for (let f = 0; f < 9; f++) {
      const az = (f / 9) * Math.PI * 2 + sIdx;
      const pitch = f < 4 ? -0.34 : 0.08;
      dummy.position.set(sp.x, gy + 0.12, sp.z);
      dummy.rotation.set(0, az, 0);
      dummy.rotateX(pitch);
      dummy.scale.setScalar(sp.sc * (0.88 + hash(sIdx * 11 + f) * 0.24));
      dummy.updateMatrix();
      smallFrondMatrices.push(dummy.matrix.clone());
      cTmp.set('#96b26a').lerp(new THREE.Color('#c2cf8a'), hash(f + sIdx) * 0.4);
      smallFrondColors.push(cTmp.clone());
    }
  });

  const allFrondsInst = new THREE.InstancedMesh(frondGeoLong, frondMat, frondMatrices.length);
  allFrondsInst.name = 'EntebbePalmFronds';
  frondMatrices.forEach((m, i) => {
    allFrondsInst.setMatrixAt(i, m);
    allFrondsInst.setColorAt(i, frondColors[i]);
  });
  allFrondsInst.instanceMatrix.needsUpdate = true;
  if (allFrondsInst.instanceColor) allFrondsInst.instanceColor.needsUpdate = true;
  allFrondsInst.computeBoundingSphere();
  allFrondsInst.castShadow = shadowsActive();
  allFrondsInst.receiveShadow = shadowsActive();
  group.add(allFrondsInst);

  const smallFrondsInst = new THREE.InstancedMesh(frondGeoShort, frondMat, smallFrondMatrices.length);
  smallFrondsInst.name = 'EntebbeShoreBabyPalms';
  smallFrondMatrices.forEach((m, i) => {
    smallFrondsInst.setMatrixAt(i, m);
    smallFrondsInst.setColorAt(i, smallFrondColors[i]);
  });
  smallFrondsInst.instanceMatrix.needsUpdate = true;
  if (smallFrondsInst.instanceColor) smallFrondsInst.instanceColor.needsUpdate = true;
  smallFrondsInst.computeBoundingSphere();
  smallFrondsInst.castShadow = shadowsActive();
  group.add(smallFrondsInst);

  // =========================================================================
  // 4. PHOTOREALISTIC BROADLEAF SHRUBS + ROOTED COASTAL BEACH GRASS TUFTS
  // =========================================================================
  const broadGeo = buildBroadShrubLeafGeo(0.86, 0.52);
  trackedGeos.add(broadGeo);
  const broadMat = new THREE.MeshStandardMaterial({
    map: broadLeafTex.albedoMap,
    normalMap: broadLeafTex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: broadLeafTex.roughnessMap,
    roughness: 0.48,
    metalness: 0.03,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
  applyNaturalWindShader(broadMat, {
    swayScaleM: 0.055,
    flutterScaleM: 0.018,
    heightMode: 'uv',
    bendExponent: 1.4,
  });
  trackedMats.add(broadMat);

  const shrubClusters = [
    { x: -4.2, z: 2.2, blades: 14 },
    { x: -4.9, z: 0.4, blades: 14 },
    { x: -5.3, z: -2.8, blades: 14 },
    { x: -6.8, z: -7.2, blades: 14 },
    { x: -9.8, z: -12.6, blades: 13 },
    { x: -13.2, z: -18.8, blades: 13 },
    { x: -16.8, z: -24.5, blades: 12 },
    { x: 4.5, z: 1.9, blades: 13 },
    { x: 5.7, z: -1.4, blades: 13 },
    { x: 7.2, z: 3.4, blades: 12 },
  ];
  const totalBlades = shrubClusters.reduce((acc, c) => acc + c.blades, 0);
  const shrubInst = new THREE.InstancedMesh(broadGeo, broadMat, totalBlades);
  shrubInst.name = 'EntebbeTropicalShrubs';
  let bIdx = 0;
  shrubClusters.forEach((cl, cId) => {
    const gy = beachSurfaceY(cl.x, cl.z);
    for (let k = 0; k < cl.blades; k++) {
      const ang = (k / cl.blades) * Math.PI * 2 + hash(cId * 7 + k) * 0.4;
      const rad = hash(k * 13 + cId) * 0.28;
      dummy.position.set(cl.x + Math.cos(ang) * rad, gy + 0.02, cl.z + Math.sin(ang) * rad);
      dummy.rotation.set(0, ang, 0);
      dummy.rotateX(0.18 + hash(k * 5 + cId) * 0.38);
      const sc = 0.74 + hash(k * 19 + cId) * 0.58;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(bIdx, dummy.matrix);
      cTmp.set('#86a45b').lerp(new THREE.Color('#b6c67e'), hash(k * 3 + cId) * 0.55);
      shrubInst.setColorAt(bIdx, cTmp);
      bIdx++;
    }
  });
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  shrubInst.computeBoundingSphere();
  shrubInst.castShadow = shadowsActive();
  shrubInst.receiveShadow = shadowsActive();
  group.add(shrubInst);

  // Fine beach grass tufts grounding shrubs, palm bases & coastal boulders into sand
  const grassGeo = new THREE.PlaneGeometry(0.42, 0.38);
  grassGeo.translate(0, 0.17, 0);
  trackedGeos.add(grassGeo);
  const grassMat = new THREE.MeshStandardMaterial({
    map: beachGrassTex,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.68,
    metalness: 0.02,
  });
  applyNaturalWindShader(grassMat, {
    swayScaleM: 0.04,
    flutterScaleM: 0.02,
    heightMode: 'uv',
    bendExponent: 1.4,
  });
  trackedMats.add(grassMat);

  const grassAnchors = [
    ...shrubClusters.map((c) => ({ x: c.x, z: c.z })),
    ...palmSpecs.slice(0, 9).map((p) => ({ x: p.x, z: p.z })),
  ];
  const grassTotal = grassAnchors.length * 6;
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassTotal);
  grassInst.name = 'EntebbeCoastalGrassTufts';
  let gIdx = 0;
  grassAnchors.forEach((anc, aId) => {
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + hash(aId * 11 + k) * 0.6;
      const rad = 0.18 + hash(k * 17 + aId) * 0.45;
      const gx = anc.x + Math.cos(ang) * rad;
      const gz = anc.z + Math.sin(ang) * rad;
      const gy = beachSurfaceY(gx, gz);
      dummy.position.set(gx, gy - 0.02, gz);
      dummy.rotation.set(0, ang + (k % 2) * 1.1, 0);
      const sc = 0.72 + hash(k * 23 + aId) * 0.52;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      grassInst.setMatrixAt(gIdx, dummy.matrix);
      cTmp.set('#96aa6a').lerp(new THREE.Color('#c2ba7e'), hash(k * 13 + aId) * 0.55);
      grassInst.setColorAt(gIdx, cTmp);
      gIdx++;
    }
  });
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  grassInst.castShadow = false;
  grassInst.receiveShadow = shadowsActive();
  group.add(grassInst);

  // =========================================================================
  // 5. PBR WEATHERED COASTAL BOULDERS + DELICATE SEASHELLS
  // =========================================================================
  const boulderGeo = new THREE.IcosahedronGeometry(0.42, 3);
  const rPos = boulderGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const crag =
      0.88 +
      Math.sin(vx * 5.2 + vz * 4.1) * 0.1 +
      Math.cos(vy * 6.4 - vx * 3.2) * 0.07 +
      Math.sin(vz * 11.0 + vy * 9.0) * 0.03;
    rPos.setXYZ(i, vx * crag * 1.28, vy * crag * 0.72, vz * crag);
  }
  boulderGeo.computeVertexNormals();
  trackedGeos.add(boulderGeo);

  const boulderMat = new THREE.MeshStandardMaterial({
    map: rockTex.albedoMap,
    normalMap: rockTex.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: rockTex.roughnessMap,
    roughness: 0.9,
    metalness: 0.04,
  });
  trackedMats.add(boulderMat);

  const boulderSpots = [
    { x: -4.75, z: 1.95, sx: 0.95, sy: 0.68, sz: 0.82, ry: 0.4 },
    { x: -10.5, z: -13.6, sx: 1.15, sy: 0.75, sz: 0.95, ry: 1.2 },
    { x: 5.05, z: 1.65, sx: 0.85, sy: 0.62, sz: 0.78, ry: -0.5 },
  ];
  boulderSpots.forEach((b, idx) => {
    const bm = new THREE.Mesh(boulderGeo, boulderMat);
    bm.name = `EntebbeShoreBoulder_${idx}`;
    bm.position.set(b.x, beachSurfaceY(b.x, b.z) + 0.02, b.z);
    bm.scale.set(b.sx, b.sy, b.sz);
    bm.rotation.y = b.ry;
    bm.castShadow = shadowsActive();
    bm.receiveShadow = shadowsActive();
    group.add(bm);
  });

  const shellGeo = new THREE.SphereGeometry(0.056, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52);
  shellGeo.scale(1.18, 0.38, 0.94);
  trackedGeos.add(shellGeo);
  const shellMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.38,
    metalness: 0.06,
  });
  trackedMats.add(shellMat);

  const shellCount = 46;
  const shellsInst = new THREE.InstancedMesh(shellGeo, shellMat, shellCount);
  shellsInst.name = 'EntebbeSeashells';
  let shPlaced = 0;
  for (let i = 0; i < 120 && shPlaced < shellCount; i++) {
    const sx = (hash(i * 17 + 3) - 0.5) * 14.0;
    const sz = -6.0 + hash(i * 23 + 7) * 11.2;
    if (Math.abs(sx - 0.25) < 1.85 && Math.abs(sz - 0.35) < 4.1) continue;
    if (sz < entebbeShoreZ(sx) + 0.45) continue;

    const sy = beachSurfaceY(sx, sz);
    dummy.position.set(sx, sy + 0.004, sz);
    dummy.rotation.set(0.08 * (hash(i) - 0.5), hash(i * 7) * Math.PI * 2, 0.08 * (hash(i + 2) - 0.5));
    const sc = 0.7 + hash(i * 11) * 0.75;
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    shellsInst.setMatrixAt(shPlaced, dummy.matrix);

    const tone = hash(i * 19);
    if (tone < 0.42) cTmp.set('#e8d4c4');
    else if (tone < 0.78) cTmp.set('#cca08b');
    else cTmp.set('#8b745f');
    shellsInst.setColorAt(shPlaced, cTmp);
    shPlaced++;
  }
  shellsInst.count = shPlaced;
  shellsInst.instanceMatrix.needsUpdate = true;
  if (shellsInst.instanceColor) shellsInst.instanceColor.needsUpdate = true;
  shellsInst.computeBoundingSphere();
  shellsInst.receiveShadow = shadowsActive();
  group.add(shellsInst);

  // =========================================================================
  // 6. VOLUMETRIC-LIT FBM EQUATORIAL CUMULUS CLOUDS
  // =========================================================================
  const cloudGeo = new THREE.PlaneGeometry(42, 21);
  trackedGeos.add(cloudGeo);
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
  });
  trackedMats.add(cloudMat);

  const cloudSpots = [
    { x: -72, y: 20, z: -155, sc: 1.35 },
    { x: -20, y: 24, z: -175, sc: 1.75 },
    { x: 34, y: 21, z: -165, sc: 1.5 },
    { x: 88, y: 19, z: -148, sc: 1.3 },
    { x: -115, y: 18, z: -125, sc: 1.2 },
  ];
  const cloudsGroup = new THREE.Group();
  cloudsGroup.name = 'EntebbeHorizonClouds';
  cloudSpots.forEach((cs) => {
    const cm = new THREE.Mesh(cloudGeo, cloudMat);
    cm.position.set(cs.x, cs.y, cs.z);
    cm.scale.setScalar(cs.sc);
    cm.lookAt(0, cs.y * 0.45, 0);
    cloudsGroup.add(cm);
  });
  group.add(cloudsGroup);

  const setShadowsEnabled = (enabled: boolean) => {
    const active = !options.isSoftwareGl && enabled;
    beachMesh.receiveShadow = active;
    waterMesh.receiveShadow = active;
    allFrondsInst.castShadow = active;
    allFrondsInst.receiveShadow = active;
    smallFrondsInst.castShadow = active;
    shrubInst.castShadow = active;
    shrubInst.receiveShadow = active;
    grassInst.receiveShadow = active;
    shellsInst.receiveShadow = active;
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && (obj.parent?.name?.startsWith('EntebbePalm_') || obj.name.startsWith('EntebbeShoreBoulder_'))) {
        obj.castShadow = active;
        obj.receiveShadow = active;
      }
    });
  };

  const update = (elapsed: number, wetness: number) => {
    waterTimeUniform.value = elapsed;
    weatherWetnessUniform.value = wetness;
    cloudsGroup.position.x = Math.sin(elapsed * 0.012) * 8.0;
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
