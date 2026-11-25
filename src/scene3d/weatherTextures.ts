import * as THREE from 'three';

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

  return a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy;
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

export interface WeatherTextureBundle {
  puddleAlbedo: THREE.CanvasTexture;
  puddleAlpha: THREE.DataTexture;
  puddleNormal: THREE.DataTexture;
  puddleRoughness: THREE.DataTexture;
  dispose: () => void;
}

/**
 * Generates procedural 512x512 organic puddle PBR textures:
 * - Organic irregular silhouette alpha mask (muddy halo -> standing water core)
 * - Murky laterite-tinted water albedo (SRGBColorSpace)
 * - Subtle ripple normal map & low-roughness specular water core (NoColorSpace)
 */
export function createWeatherTextureBundle(maxAnisotropy: number): WeatherTextureBundle {
  const size = 512;
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // Canvas for puddle color/mud-rim albedo
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(size, size);

  const alphaData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const dy = (v - 0.5) * 2;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const dx = (u - 0.5) * 2;
      const angle = Math.atan2(dy, dx);
      const radial = Math.hypot(dx, dy);

      // Organic warped puddle boundary
      const lobe =
        0.13 * Math.sin(angle * 3.0 + 0.6) +
        0.09 * Math.cos(angle * 5.0 - 1.2) +
        0.14 * (fbmTile(u, v, 5, 3, 412) - 0.5);
      const effectiveR = radial / Math.max(0.45, 0.78 + lobe);

      // Soft outer damp mud rim (0.76..1.05), glossy water interior (< 0.76)
      const alpha = effectiveR >= 1.04 ? 0 : Math.max(0, Math.min(1, (1.04 - effectiveR) / 0.28));
      const waterCore = Math.max(0, Math.min(1, (0.8 - effectiveR) / 0.22));
      const detail = fbmTile(u, v, 10, 3, 919);

      // Murky red-clay puddle rim transitioning to cool sky-reflecting rainwater center
      const rimR = 74 + detail * 24;
      const rimG = 52 + detail * 16;
      const rimB = 42 + detail * 14;

      const coreR = 54 + detail * 14;
      const coreG = 84 + detail * 18;
      const coreB = 104 + detail * 22;

      const idx = (y * size + x) * 4;
      albedoImg.data[idx] = Math.round(rimR + (coreR - rimR) * waterCore);
      albedoImg.data[idx + 1] = Math.round(rimG + (coreG - rimG) * waterCore);
      albedoImg.data[idx + 2] = Math.round(rimB + (coreB - rimB) * waterCore);
      albedoImg.data[idx + 3] = 255;

      const aByte = Math.round(alpha * 255);
      alphaData[idx] = aByte;
      alphaData[idx + 1] = aByte;
      alphaData[idx + 2] = aByte;
      alphaData[idx + 3] = 255;

      // Mirror-smooth center (roughness ~0.05), damp muddy rim (roughness ~0.48)
      const rVal = Math.round((0.48 - waterCore * 0.43) * 255);
      roughData[idx] = rVal;
      roughData[idx + 1] = rVal;
      roughData[idx + 2] = rVal;
      roughData[idx + 3] = 255;

      // Micro-ripple height field
      const wave =
        Math.sin(radial * 28.0 + detail * 3.0) * 0.35 +
        (fbmTile(u, v, 14, 2, 307) - 0.5) * 0.65;
      heights[y * size + x] = wave * waterCore;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  const puddleAlbedo = new THREE.CanvasTexture(albedoCanvas);
  puddleAlbedo.colorSpace = THREE.SRGBColorSpace;
  puddleAlbedo.anisotropy = aniso;
  puddleAlbedo.needsUpdate = true;

  const puddleAlpha = new THREE.DataTexture(alphaData, size, size, THREE.RGBAFormat);
  puddleAlpha.colorSpace = THREE.NoColorSpace;
  puddleAlpha.generateMipmaps = true;
  puddleAlpha.minFilter = THREE.LinearMipmapLinearFilter;
  puddleAlpha.magFilter = THREE.LinearFilter;
  puddleAlpha.anisotropy = aniso;
  puddleAlpha.needsUpdate = true;

  const puddleRoughness = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  puddleRoughness.colorSpace = THREE.NoColorSpace;
  puddleRoughness.generateMipmaps = true;
  puddleRoughness.minFilter = THREE.LinearMipmapLinearFilter;
  puddleRoughness.magFilter = THREE.LinearFilter;
  puddleRoughness.anisotropy = aniso;
  puddleRoughness.needsUpdate = true;

  // Tangent-space normal map from micro-wave heightfield
  const normData = new Uint8Array(size * size * 4);
  const strength = 1.65;
  for (let y = 0; y < size; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(size - 1, y + 1);
    for (let x = 0; x < size; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(size - 1, x + 1);
      const hL = heights[y * size + xm];
      const hR = heights[y * size + xp];
      const hU = heights[ym * size + x];
      const hD = heights[yp * size + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * size + x) * 4;
      normData[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      normData[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      normData[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;
    }
  }
  const puddleNormal = new THREE.DataTexture(normData, size, size, THREE.RGBAFormat);
  puddleNormal.colorSpace = THREE.NoColorSpace;
  puddleNormal.generateMipmaps = true;
  puddleNormal.minFilter = THREE.LinearMipmapLinearFilter;
  puddleNormal.magFilter = THREE.LinearFilter;
  puddleNormal.anisotropy = aniso;
  puddleNormal.needsUpdate = true;

  return {
    puddleAlbedo,
    puddleAlpha,
    puddleNormal,
    puddleRoughness,
    dispose: () => {
      puddleAlbedo.dispose();
      puddleAlpha.dispose();
      puddleNormal.dispose();
      puddleRoughness.dispose();
    },
  };
}
