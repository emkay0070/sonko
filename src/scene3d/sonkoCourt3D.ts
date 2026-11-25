import * as THREE from 'three';
import { getStoneSpec, WorldPlaceId } from '../game/progression';
import { CourtSize, CourtSquare, CourtVenueId, StencilId, StoneId, WeatherCondition } from '../game/types';
import { WEATHER_SPECS } from '../game/weather';
import { groundHeightAt } from './terrain';
import { SHARED_TREE_WIND_STATE } from './treeWind';
import { createWeatherTextureBundle, WeatherTextureBundle } from './weatherTextures';

export const COURT_WORLD_CENTER_X = 0.25;
export const COURT_WORLD_CENTER_Z = 0.35;
export const COURT_WORLD_WIDTH = 2.6;
export const COURT_WORLD_LENGTH = 6.8;

export function courtNormalizedToWorld(nx: number, ny: number): { x: number; z: number } {
  return {
    x: COURT_WORLD_CENTER_X + (nx - 0.5) * COURT_WORLD_WIDTH,
    z: COURT_WORLD_CENTER_Z + (ny - 0.5) * COURT_WORLD_LENGTH,
  };
}

export function worldToCourtNormalized(wx: number, wz: number): { nx: number; ny: number } {
  return {
    nx: 0.5 + (wx - COURT_WORLD_CENTER_X) / COURT_WORLD_WIDTH,
    ny: 0.5 + (wz - COURT_WORLD_CENTER_Z) / COURT_WORLD_LENGTH,
  };
}

export interface CourtRenderSyncState {
  courtSize: CourtSize;
  venue: CourtVenueId;
  squares: CourtSquare[];
  houses: Record<number, 0 | 1>;
  playerColors: [string, string];
  playerAccents: [string, string];
  playerStencils: [StencilId, StencilId];
  puddleSquares: number[];
  targetSquareId: number;
  highlightSquareIds: number[];
  foulSquareId: number | null;
  foulFlashTimer: number;
  stoneId: StoneId;
  stoneInWorld: boolean;
  stoneNx: number;
  stoneNy: number;
  stoneZLift: number;
  stoneRot: number;
  showAimArc: boolean;
  aimStartNx: number;
  aimStartNy: number;
  aimLandNx: number;
  aimLandNy: number;
  windX: number;
  isClaimAim: boolean;
  weatherCondition?: WeatherCondition;
}

interface DustParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

const MAX_DUST = 96;
const AIM_ARC_SEGMENTS = 14;
const FIREFLY_COUNT = 34;
const RAIN_COUNT = 440;
const SPLASH_COUNT = 36;

const _padBaseColor = new THREE.Color();
const _padWetDarkColor = new THREE.Color('#4a3529');

interface RainSplash {
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
  scale: number;
}

export class SonkoCourt3D {
  public readonly group = new THREE.Group();

  // Textured Court Arena Pad (frames court cleanly in Park, Market, Sand & Festival worlds)
  private courtPadMesh: THREE.Mesh;
  private courtPadMat: THREE.MeshStandardMaterial;
  private courtPadRimMesh: THREE.Mesh;
  private courtPadBaseColorHex = '#9c785c';
  private padTex: THREE.Texture;

  // Dynamic chalk pitch canvas
  private chalkCanvas: HTMLCanvasElement;
  private chalkCtx: CanvasRenderingContext2D;
  private chalkTex: THREE.CanvasTexture;
  private chalkMat: THREE.MeshStandardMaterial;
  private chalkMesh: THREE.Mesh;
  private lastBoardKey = '';

  // Playable 3D River Stone (Ejjinja)
  private stoneGroup = new THREE.Group();
  private stoneBodyMesh: THREE.Mesh;
  private stoneMotifMesh: THREE.Mesh;
  private customStoneNode: THREE.Object3D | null = null;
  private stoneShadowMesh: THREE.Mesh;
  private lastStoneId: StoneId | '' = '';

  // 3D Aiming Arc & Target Landing Ring
  private aimGroup = new THREE.Group();
  private aimBeads: THREE.Mesh[] = [];
  private targetRingMesh: THREE.Mesh;
  private targetRingInnerMesh: THREE.Mesh;

  // Dynamic puddles mesh group & procedural weather textures
  private weatherTextures: WeatherTextureBundle;
  private rippleTimeUniform = { value: 0 };
  private rainIntensityUniform = { value: 0 };
  private puddlesGroup = new THREE.Group();
  private puddleGeoCache: THREE.BufferGeometry;
  private puddleMat: THREE.MeshPhysicalMaterial;

  // 3D Murram dust & splash particles
  private dustParticles: DustParticle[] = [];
  private dustInstanced: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  // Night lanterns & fireflies (Ndere)
  private nightGroup = new THREE.Group();
  private lanternLights: THREE.PointLight[] = [];
  private fireflyGeo: THREE.BufferGeometry;
  private fireflyPhase = new Float32Array(FIREFLY_COUNT);

  // Dynamic slanted rain streaks & ground splash rings
  private rainGroup = new THREE.Group();
  private rainGeo: THREE.BufferGeometry;
  private rainMat: THREE.LineBasicMaterial;
  private rainLines: THREE.LineSegments;
  private rainPos: Float32Array;
  private rainDropX = new Float32Array(RAIN_COUNT);
  private rainDropY = new Float32Array(RAIN_COUNT);
  private rainDropZ = new Float32Array(RAIN_COUNT);
  private rainVel = new Float32Array(RAIN_COUNT);
  private rainLen = new Float32Array(RAIN_COUNT);
  private splashInstanced: THREE.InstancedMesh;
  private splashMat: THREE.MeshBasicMaterial;
  private splashes: RainSplash[] = [];
  private weatherIntensitySmoothed = 0;
  private wetnessSmoothed = 0;
  private dynamicWeatherEnabled = true;

  constructor(private maxAnisotropy: number, private isSoftwareGl: boolean) {
    this.group.name = 'SonkoDynamicCourt3D';
    this.weatherTextures = createWeatherTextureBundle(maxAnisotropy);

    // 0. Textured Court Arena Pad (uses uploaded ground/veranda surface texture)
    this.padTex = new THREE.TextureLoader().load('/assets/textures/veranda_surface.jpg', (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1.8, 4.2);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(16, Math.max(1, maxAnisotropy));
      t.needsUpdate = true;
    });
    const padGeo = new THREE.PlaneGeometry(COURT_WORLD_WIDTH + 0.58, COURT_WORLD_LENGTH + 0.58, 24, 56);
    padGeo.rotateX(-Math.PI / 2);
    const pPos = padGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pPos.count; i++) {
      const wx = pPos.getX(i) + COURT_WORLD_CENTER_X;
      const wz = pPos.getZ(i) + COURT_WORLD_CENTER_Z;
      pPos.setXYZ(i, wx, groundHeightAt(wx, wz) + 0.014, wz);
    }
    padGeo.computeVertexNormals();

    this.courtPadMat = new THREE.MeshStandardMaterial({
      map: this.padTex,
      color: '#9c785c',
      roughness: 0.9,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.courtPadMesh = new THREE.Mesh(padGeo, this.courtPadMat);
    this.courtPadMesh.name = 'CourtSurfacePad';
    this.courtPadMesh.receiveShadow = true;
    this.courtPadMesh.visible = false;
    this.group.add(this.courtPadMesh);

    const rimGeo = new THREE.PlaneGeometry(COURT_WORLD_WIDTH + 0.76, COURT_WORLD_LENGTH + 0.76, 16, 40);
    rimGeo.rotateX(-Math.PI / 2);
    const rimPos = rimGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rimPos.count; i++) {
      const wx = rimPos.getX(i) + COURT_WORLD_CENTER_X;
      const wz = rimPos.getZ(i) + COURT_WORLD_CENTER_Z;
      rimPos.setXYZ(i, wx, groundHeightAt(wx, wz) + 0.011, wz);
    }
    rimGeo.computeVertexNormals();
    this.courtPadRimMesh = new THREE.Mesh(
      rimGeo,
      new THREE.MeshStandardMaterial({ color: '#40291b', roughness: 0.96, metalness: 0.0 })
    );
    this.courtPadRimMesh.name = 'CourtBorderFrame';
    this.courtPadRimMesh.receiveShadow = true;
    this.courtPadRimMesh.visible = false;
    this.group.add(this.courtPadRimMesh);

    // 1. Dynamic Chalk Overlay Mesh conforming above terrain & court pad
    this.chalkCanvas = document.createElement('canvas');
    this.chalkCanvas.width = 768;
    this.chalkCanvas.height = 1536;
    this.chalkCtx = this.chalkCanvas.getContext('2d')!;
    this.chalkTex = new THREE.CanvasTexture(this.chalkCanvas);
    this.chalkTex.colorSpace = THREE.SRGBColorSpace;
    this.chalkTex.anisotropy = Math.min(16, Math.max(1, maxAnisotropy));

    const chalkGeo = new THREE.PlaneGeometry(COURT_WORLD_WIDTH, COURT_WORLD_LENGTH, 28, 64);
    chalkGeo.rotateX(-Math.PI / 2);
    const cPos = chalkGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cPos.count; i++) {
      const wx = cPos.getX(i) + COURT_WORLD_CENTER_X;
      const wz = cPos.getZ(i) + COURT_WORLD_CENTER_Z;
      cPos.setXYZ(i, wx, groundHeightAt(wx, wz) + 0.025, wz);
    }
    chalkGeo.computeVertexNormals();

    this.chalkMat = new THREE.MeshStandardMaterial({
      map: this.chalkTex,
      transparent: true,
      opacity: 0.98,
      roughness: 0.94,
      metalness: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.chalkMesh = new THREE.Mesh(chalkGeo, this.chalkMat);
    this.chalkMesh.name = 'DynamicChalkCourtMesh';
    this.chalkMesh.renderOrder = 3;
    this.chalkMesh.receiveShadow = true;
    this.group.add(this.chalkMesh);

    // 2. Sculpted 3D Ejjinja River Stone
    const sGeo = new THREE.CylinderGeometry(0.068, 0.074, 0.025, 22);
    sGeo.scale(1.18, 1.0, 0.94);
    this.stoneBodyMesh = new THREE.Mesh(
      sGeo,
      new THREE.MeshStandardMaterial({ color: '#8A817C', roughness: 0.56, metalness: 0.06 })
    );
    this.stoneBodyMesh.castShadow = !isSoftwareGl;
    this.stoneBodyMesh.receiveShadow = true;
    this.stoneGroup.add(this.stoneBodyMesh);

    const motifGeo = new THREE.TorusGeometry(0.034, 0.0045, 8, 20);
    motifGeo.rotateX(Math.PI / 2);
    this.stoneMotifMesh = new THREE.Mesh(
      motifGeo,
      new THREE.MeshBasicMaterial({ color: '#FBBF24' })
    );
    this.stoneMotifMesh.position.y = 0.013;
    this.stoneGroup.add(this.stoneMotifMesh);

    const shGeo = new THREE.CircleGeometry(0.085, 16);
    shGeo.rotateX(-Math.PI / 2);
    this.stoneShadowMesh = new THREE.Mesh(
      shGeo,
      new THREE.MeshBasicMaterial({
        color: '#190a05',
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
    );
    this.group.add(this.stoneShadowMesh);
    this.group.add(this.stoneGroup);

    // 3. 3D Aiming Beads & Predicted Landing Ring
    const beadGeo = new THREE.SphereGeometry(0.022, 10, 8);
    const beadMat = new THREE.MeshBasicMaterial({
      color: '#FDE047',
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < AIM_ARC_SEGMENTS; i++) {
      const m = new THREE.Mesh(beadGeo, beadMat);
      this.aimGroup.add(m);
      this.aimBeads.push(m);
    }

    const ringGeo = new THREE.RingGeometry(0.11, 0.145, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.targetRingMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: '#FBBF24',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.aimGroup.add(this.targetRingMesh);

    const innerRingGeo = new THREE.CircleGeometry(0.045, 20);
    innerRingGeo.rotateX(-Math.PI / 2);
    this.targetRingInnerMesh = new THREE.Mesh(
      innerRingGeo,
      new THREE.MeshBasicMaterial({
        color: '#FEF08A',
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      })
    );
    this.aimGroup.add(this.targetRingInnerMesh);
    this.group.add(this.aimGroup);

    // 4. Reflective Rain & Dew Puddles (procedural irregular alpha/normal/roughness PBR + live raindrop ripples)
    this.puddleGeoCache = new THREE.PlaneGeometry(0.92, 0.92);
    this.puddleGeoCache.rotateX(-Math.PI / 2);
    this.puddleMat = new THREE.MeshPhysicalMaterial({
      map: this.weatherTextures.puddleAlbedo,
      alphaMap: this.weatherTextures.puddleAlpha,
      normalMap: this.weatherTextures.puddleNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: this.weatherTextures.puddleRoughness,
      color: '#ffffff',
      roughness: 1.0,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const uRippleTime = this.rippleTimeUniform;
    const uRainIntensity = this.rainIntensityUniform;
    this.puddleMat.onBeforeCompile = (shader) => {
      shader.uniforms.uRippleTime = uRippleTime;
      shader.uniforms.uRainIntensity = uRainIntensity;
      shader.vertexShader =
        `varying vec2 vPuddleUv;\n` +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          `
          #include <uv_vertex>
          vPuddleUv = uv;
          `
        );
      shader.fragmentShader =
        `varying vec2 vPuddleUv;\nuniform float uRippleTime;\nuniform float uRainIntensity;\n` +
        shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `
          #include <normal_fragment_maps>
          if (uRainIntensity > 0.04) {
            vec2 rp1 = vPuddleUv - vec2(0.42, 0.48);
            float d1 = length(rp1);
            float ph1 = fract(uRippleTime * 0.95);
            float ring1 = sin((d1 - ph1 * 0.45) * 64.0) * exp(-abs(d1 - ph1 * 0.45) * 18.0) * (1.0 - ph1);
            vec2 rp2 = vPuddleUv - vec2(0.62, 0.38);
            float d2 = length(rp2);
            float ph2 = fract(uRippleTime * 0.95 + 0.52);
            float ring2 = sin((d2 - ph2 * 0.45) * 64.0) * exp(-abs(d2 - ph2 * 0.45) * 18.0) * (1.0 - ph2);
            vec2 dir1 = d1 > 0.001 ? rp1 / d1 : vec2(0.0);
            vec2 dir2 = d2 > 0.001 ? rp2 / d2 : vec2(0.0);
            vec2 rippleGrad = (dir1 * ring1 + dir2 * ring2) * uRainIntensity * 0.34;
            normal = normalize(normal + vec3(rippleGrad.x, 0.0, rippleGrad.y));
          }
          `
        );
    };
    this.puddleMat.customProgramCacheKey = () => 'sonko-puddle-ripple-v1';
    this.puddlesGroup.name = 'WeatherCourtPuddles';
    this.group.add(this.puddlesGroup);

    // 5. Instanced 3D Dust & Splash Particles
    const ptGeo = new THREE.DodecahedronGeometry(0.025, 0);
    const ptMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.9,
    });
    this.dustInstanced = new THREE.InstancedMesh(ptGeo, ptMat, MAX_DUST);
    this.dustInstanced.frustumCulled = false;
    for (let i = 0; i < MAX_DUST; i++) {
      this.dustParticles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        size: 1,
        color: new THREE.Color('#D68C6B'),
      });
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.dustInstanced.setMatrixAt(i, this.dummy.matrix);
      this.dustInstanced.setColorAt(i, new THREE.Color('#D68C6B'));
    }
    this.group.add(this.dustInstanced);

    // 6. Ndere Night Lanterns & Fireflies
    this.nightGroup.name = 'NdereLanternsAndFireflies';
    const lanternPositions: Array<[number, number, number]> = [
      [-1.7, 1.55, 2.5],
      [2.1, 1.55, 0.2],
      [-1.7, 1.55, -2.1],
      [-4.1, 1.9, -1.8],
    ];
    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#ffdf8e',
      emissive: '#ff9d2e',
      emissiveIntensity: 2.2,
      roughness: 0.25,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: '#432517', roughness: 0.9 });

    lanternPositions.forEach(([lx, ly, lz], idx) => {
      if (idx < 3) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, ly, 8), postMat);
        const gy = groundHeightAt(lx, lz);
        pole.position.set(lx, gy + ly * 0.5, lz);
        this.nightGroup.add(pole);
      }
      const gy = groundHeightAt(lx, lz);
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 10), bulbMat);
      bulb.position.set(lx, gy + ly, lz);
      this.nightGroup.add(bulb);

      const ptLight = new THREE.PointLight('#ffb74d', 3.4, 9.5, 1.7);
      ptLight.position.set(lx, gy + ly, lz);
      this.nightGroup.add(ptLight);
      this.lanternLights.push(ptLight);
    });

    this.fireflyGeo = new THREE.BufferGeometry();
    const fPos = new Float32Array(FIREFLY_COUNT * 3);
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      fPos[i * 3] = (Math.sin(i * 13.7) * 0.5) * 8.5;
      fPos[i * 3 + 1] = 0.5 + ((i * 3) % 11) * 0.18;
      fPos[i * 3 + 2] = (Math.cos(i * 17.3) * 0.5) * 9.5;
      this.fireflyPhase[i] = i * 0.77;
    }
    this.fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    const fireflyMat = new THREE.PointsMaterial({
      color: '#fde047',
      size: 0.055,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.nightGroup.add(new THREE.Points(this.fireflyGeo, fireflyMat));
    this.nightGroup.visible = false;
    this.group.add(this.nightGroup);

    // 7. Dynamic Slanted Rain Streaks & Ground Splash Rings
    this.rainGroup.name = 'DynamicWeatherRain';
    this.rainGeo = new THREE.BufferGeometry();
    this.rainPos = new Float32Array(RAIN_COUNT * 2 * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainDropX[i] = (Math.random() - 0.5) * 12;
      this.rainDropY[i] = Math.random() * 6.5;
      this.rainDropZ[i] = (Math.random() - 0.5) * 12;
      this.rainVel[i] = 7.5 + Math.random() * 4.2;
      this.rainLen[i] = 0.24 + Math.random() * 0.22;
    }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: '#d4ebf9',
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainGroup.add(this.rainLines);

    const splashGeo = new THREE.RingGeometry(0.022, 0.044, 16);
    splashGeo.rotateX(-Math.PI / 2);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: '#dff2ff',
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.splashInstanced = new THREE.InstancedMesh(splashGeo, this.splashMat, SPLASH_COUNT);
    this.splashInstanced.frustumCulled = false;
    for (let i = 0; i < SPLASH_COUNT; i++) {
      this.splashes.push({
        x: (Math.random() - 0.5) * 6.5 + COURT_WORLD_CENTER_X,
        y: 0,
        z: (Math.random() - 0.5) * 8.5 + COURT_WORLD_CENTER_Z,
        age: Math.random() * 0.45,
        maxAge: 0.34 + Math.random() * 0.2,
        scale: 0.7 + Math.random() * 0.7,
      });
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.splashInstanced.setMatrixAt(i, this.dummy.matrix);
    }
    this.rainGroup.add(this.splashInstanced);
    this.rainGroup.visible = false;
    this.group.add(this.rainGroup);
  }

  public setDynamicWeatherEnabled(enabled: boolean) {
    this.dynamicWeatherEnabled = enabled;
  }

  public setWorldPlace(place: WorldPlaceId) {
    if (place === 'kampala_compound') {
      this.courtPadMesh.visible = false;
      this.courtPadRimMesh.visible = false;
      return;
    }

    this.courtPadMesh.visible = true;
    this.courtPadRimMesh.visible = true;
    if (place === 'primary_schoolyard') {
      this.courtPadBaseColorHex = '#a88766';
    } else if (place === 'trading_centre') {
      this.courtPadBaseColorHex = '#8f6850';
    } else if (place === 'entebbe_lakeside') {
      this.courtPadBaseColorHex = '#b9945d';
    } else if (place === 'ndere_festival') {
      this.courtPadBaseColorHex = '#643c2c';
    }
    this.courtPadMat.color.set(this.courtPadBaseColorHex);
    this.courtPadMat.needsUpdate = true;
  }

  public setCustomStoneModel(normalizedStone: THREE.Object3D | null) {
    if (this.customStoneNode) {
      this.stoneGroup.remove(this.customStoneNode);
      this.customStoneNode.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat?.dispose();
        }
      });
      this.customStoneNode = null;
    }

    if (normalizedStone) {
      const clone = normalizedStone.clone(true);
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = !this.isSoftwareGl;
          child.receiveShadow = true;
        }
      });
      this.stoneBodyMesh.visible = false;
      this.stoneMotifMesh.visible = false;
      this.customStoneNode = clone;
      this.stoneGroup.add(clone);
    } else {
      this.stoneBodyMesh.visible = true;
      this.stoneMotifMesh.visible = true;
    }
  }

  public spawnBurst(nx: number, ny: number, count: number, colorHex: string) {
    const world = courtNormalizedToWorld(nx, ny);
    const gy = groundHeightAt(world.x, world.z);
    let spawned = 0;
    for (let i = 0; i < MAX_DUST && spawned < count; i++) {
      const p = this.dustParticles[i];
      if (!p.active) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.55 + Math.random() * 1.15;
        p.active = true;
        p.x = world.x;
        p.y = gy + 0.03;
        p.z = world.z;
        p.vx = Math.cos(ang) * spd;
        p.vy = 0.85 + Math.random() * 1.1;
        p.vz = Math.sin(ang) * spd;
        p.life = 0;
        p.maxLife = 0.34 + Math.random() * 0.25;
        p.size = 0.65 + Math.random() * 0.8;
        p.color.set(colorHex);
        spawned++;
      }
    }
  }

  private drawStencil(
    ctx: CanvasRenderingContext2D,
    sq: { x: number; y: number; w: number; h: number },
    stencil: StencilId,
    accent: string
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sq.x + 6, sq.y + 6, sq.w - 12, sq.h - 12);
    ctx.clip();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.72;
    const cx = sq.x + sq.w / 2;
    const cy = sq.y + sq.h / 2;
    const r = Math.min(sq.w, sq.h) * 0.34;

    if (stencil === 'basket_weave') {
      const step = 22;
      for (let d = -sq.h; d < sq.w + sq.h; d += step) {
        ctx.beginPath();
        ctx.moveTo(sq.x + d, sq.y);
        ctx.lineTo(sq.x + d - sq.h, sq.y + sq.h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sq.x + d, sq.y + sq.h);
        ctx.lineTo(sq.x + d - sq.h, sq.y);
        ctx.stroke();
      }
    } else if (stencil === 'sunburst') {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58);
        ctx.lineTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1);
        ctx.stroke();
      }
    } else if (stencil === 'royal_drums') {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      for (let row = -1; row <= 1; row++) {
        const oy = cy + row * (r * 0.55);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.75, oy + r * 0.3);
        ctx.lineTo(cx, oy - r * 0.25);
        ctx.lineTo(cx + r * 0.75, oy + r * 0.3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private redrawChalkCanvas(state: CourtRenderSyncState) {
    const key = JSON.stringify([
      state.courtSize,
      state.venue,
      state.houses,
      state.playerColors,
      state.playerAccents,
      state.playerStencils,
      state.puddleSquares,
      state.targetSquareId,
      state.highlightSquareIds,
      state.foulSquareId,
      state.foulFlashTimer > 0.05 ? 1 : 0,
    ]);
    if (key === this.lastBoardKey) return;
    this.lastBoardKey = key;

    const ctx = this.chalkCtx;
    const W = this.chalkCanvas.width;
    const H = this.chalkCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // Subtle venue-tinted chalk court border line
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const homeSq = state.squares.find((s) => s.isHome);

    for (const sq of state.squares) {
      const px = sq.x * W;
      const py = sq.y * H;
      const pw = sq.w * W;
      const ph = sq.h * H;
      const owner = state.houses[sq.id];
      const isTarget = sq.id === state.targetSquareId;
      const isNextHop = state.highlightSquareIds.includes(sq.id);
      const isFoul = state.foulFlashTimer > 0.05 && state.foulSquareId === sq.id;

      // Home arch background / shape
      if (sq.isHome) {
        const cx = px + pw * 0.5;
        const botY = py + ph;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, botY);
        ctx.lineTo(px, py + ph * 0.38);
        ctx.quadraticCurveTo(cx, py - ph * 0.08, px + pw, py + ph * 0.38);
        ctx.lineTo(px + pw, botY);
        ctx.closePath();

        if (isTarget) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.fill();
        } else if (isNextHop) {
          ctx.fillStyle = 'rgba(74, 222, 128, 0.18)';
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(250, 243, 232, 0.05)';
          ctx.fill();
        }

        // Dark contrast chalk under-stroke + bright white/gold chalk stroke
        ctx.strokeStyle = 'rgba(20, 9, 4, 0.58)';
        ctx.lineWidth = (isTarget || isNextHop ? 14 : 11) + 5;
        ctx.stroke();

        ctx.strokeStyle = isTarget
          ? 'rgba(253, 224, 71, 0.98)'
          : isNextHop
            ? 'rgba(134, 239, 172, 0.98)'
            : 'rgba(255, 250, 242, 0.96)';
        ctx.lineWidth = isTarget || isNextHop ? 14 : 11;
        ctx.stroke();

        // EWAAKA label
        ctx.shadowColor = 'rgba(20, 9, 4, 0.72)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#FFFDF8';
        ctx.font = '800 38px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EWAAKA', cx, py + ph * 0.48);
        ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(String(sq.id), cx, py + ph * 0.74);
        ctx.restore();
        continue;
      }

      // House owned tint & chalk stencil
      if (owner !== undefined) {
        ctx.fillStyle = owner === 0 ? 'rgba(21, 128, 61, 0.36)' : 'rgba(185, 28, 28, 0.36)';
        ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
        this.drawStencil(
          ctx,
          { x: px, y: py, w: pw, h: ph },
          state.playerStencils[owner],
          state.playerAccents[owner]
        );
      } else if (isFoul) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
        ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
      } else if (isTarget) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
        ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
      } else if (isNextHop) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.24)';
        ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
      }

      // Dark mineral border backing so chalk lines pop on every world surface
      const strokeW = isTarget || isNextHop || isFoul ? 14 : 11;
      ctx.strokeStyle = 'rgba(20, 9, 4, 0.56)';
      ctx.lineWidth = strokeW + 5;
      ctx.strokeRect(px + 4, py + 4, pw - 8, ph - 8);

      // Chalk box border
      ctx.strokeStyle = isFoul
        ? 'rgba(248, 113, 113, 0.98)'
        : isTarget
          ? 'rgba(253, 224, 71, 0.98)'
          : isNextHop
            ? 'rgba(134, 239, 172, 0.98)'
            : owner !== undefined
              ? state.playerAccents[owner]
              : 'rgba(255, 250, 242, 0.95)';
      ctx.lineWidth = strokeW;
      ctx.strokeRect(px + 4, py + 4, pw - 8, ph - 8);

      // Numeral inside square with subtle dark edge contrast
      ctx.save();
      ctx.shadowColor = 'rgba(20, 9, 4, 0.72)';
      ctx.shadowBlur = 6;
      ctx.fillStyle =
        owner !== undefined
          ? '#FAF3E8'
          : isTarget
            ? '#FEF08A'
            : '#FFFDF8';
      ctx.font = '800 58px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sq.id), px + pw * 0.5, py + ph * 0.52);

      if (owner !== undefined) {
        ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = state.playerAccents[owner];
        ctx.fillText(owner === 0 ? 'HOME 1' : 'HOME 2', px + pw * 0.5, py + ph * 0.8);
      }
      ctx.restore();
    }

    // Baseline chalk foul line at bottom (ny = 0.89)
    const baseLineY = (homeSq ? 0.885 : 0.885) * H;
    ctx.strokeStyle = 'rgba(20, 9, 4, 0.55)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(W * 0.14, baseLineY);
    ctx.lineTo(W * 0.86, baseLineY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 250, 242, 0.92)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(W * 0.14, baseLineY);
    ctx.lineTo(W * 0.86, baseLineY);
    ctx.stroke();

    this.chalkTex.needsUpdate = true;
  }

  private syncPuddles(squares: CourtSquare[], puddleSquares: number[]) {
    while (this.puddlesGroup.children.length > 0) {
      this.puddlesGroup.remove(this.puddlesGroup.children[0]);
    }
    if (puddleSquares.length === 0) return;

    for (const id of puddleSquares) {
      const sq = squares.find((s) => s.id === id);
      if (!sq) continue;
      const w = courtNormalizedToWorld(sq.x + sq.w * 0.5, sq.y + sq.h * 0.5);
      const puddle = new THREE.Mesh(this.puddleGeoCache, this.puddleMat);
      const rotSeed = ((id * 137.5) % 360) * (Math.PI / 180);
      const scaleW = 0.92 + ((id * 17) % 5) * 0.06;
      const scaleL = 0.85 + ((id * 29) % 5) * 0.06;
      puddle.position.set(w.x, groundHeightAt(w.x, w.z) + 0.017, w.z);
      puddle.rotation.y = rotSeed;
      puddle.scale.set(scaleW, 1, scaleL);
      puddle.renderOrder = 2;
      this.puddlesGroup.add(puddle);
    }
  }

  public sync(state: CourtRenderSyncState, elapsed: number, dt: number) {
    const activeWeather =
      state.weatherCondition ?? (state.venue === 'jinja_rain' ? 'storm_shower' : 'clear');
    const weatherSpec = WEATHER_SPECS[activeWeather] ?? WEATHER_SPECS.clear;

    // 1. Update Chalk Board & Puddles
    const prevKey = this.lastBoardKey;
    this.redrawChalkCanvas(state);
    if (prevKey !== this.lastBoardKey) {
      this.syncPuddles(state.squares, state.puddleSquares);
    }

    // Smooth wetness & rain intensity transitions (respecting Dynamic Weather toggle)
    const targetWetness = this.dynamicWeatherEnabled
      ? weatherSpec.wetness
      : state.puddleSquares.length > 0
        ? 0.16
        : 0;
    const targetRain = this.dynamicWeatherEnabled ? weatherSpec.rainIntensity : 0;

    this.wetnessSmoothed = THREE.MathUtils.damp(this.wetnessSmoothed, targetWetness, 3.2, dt);
    this.weatherIntensitySmoothed = THREE.MathUtils.damp(
      this.weatherIntensitySmoothed,
      targetRain,
      4.0,
      dt
    );
    this.rippleTimeUniform.value = elapsed;
    this.rainIntensityUniform.value = this.weatherIntensitySmoothed;

    this.puddleMat.opacity = 0.65 + this.wetnessSmoothed * 0.3;
    this.chalkMat.opacity = 0.98 - this.wetnessSmoothed * 0.14;
    if (this.courtPadMesh.visible) {
      this.courtPadMat.roughness = THREE.MathUtils.lerp(0.9, 0.4, this.wetnessSmoothed);
      _padBaseColor.set(this.courtPadBaseColorHex).lerp(_padWetDarkColor, this.wetnessSmoothed * 0.28);
      this.courtPadMat.color.copy(_padBaseColor);
    }

    // 2. Venue Night Lanterns/Fireflies & Dynamic Weather Rain + Splash Rings
    this.nightGroup.visible = state.venue === 'ndere_night';
    if (this.nightGroup.visible) {
      const fAttr = this.fireflyGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const ph = this.fireflyPhase[i];
        fAttr.setX(i, fAttr.getX(i) + Math.sin(elapsed * 1.4 + ph) * 0.004);
        fAttr.setY(i, 0.65 + Math.sin(elapsed * 1.9 + ph) * 0.35 + ((i * 5) % 9) * 0.14);
      }
      fAttr.needsUpdate = true;
      for (let i = 0; i < this.lanternLights.length; i++) {
        this.lanternLights[i].intensity = 3.2 + Math.sin(elapsed * 6.5 + i * 1.7) * 0.25;
      }
    }

    const rainActive = this.dynamicWeatherEnabled && this.weatherIntensitySmoothed > 0.025;
    this.rainGroup.visible = rainActive;
    if (rainActive) {
      const { dirX, dirZ, strength: treeWindStrength, liveGust } = SHARED_TREE_WIND_STATE;
      const gustFactor = 0.72 + 0.45 * liveGust;
      const activeStreaks = Math.max(
        24,
        Math.min(RAIN_COUNT, Math.round(RAIN_COUNT * this.weatherIntensitySmoothed * (0.85 + 0.2 * liveGust)))
      );
      const speedScale = (0.78 + this.weatherIntensitySmoothed * 0.45) * (0.9 + 0.18 * liveGust);
      const windSpeedHoriz = (0.45 + treeWindStrength * 2.05 + Math.abs(state.windX) * 26.0) * gustFactor;
      const windDriftX = dirX * windSpeedHoriz;
      const windDriftZ = dirZ * windSpeedHoriz;
      const posArr = this.rainPos;

      for (let i = 0; i < activeStreaks; i++) {
        let rx = this.rainDropX[i] + windDriftX * dt;
        let rz = this.rainDropZ[i] + windDriftZ * dt;
        let ry = this.rainDropY[i] - this.rainVel[i] * speedScale * dt;
        if (ry < 0.04) {
          ry = 5.6 + (i % 7) * 0.16;
          rx = (Math.random() - 0.5) * 12;
          rz = (Math.random() - 0.5) * 12;
        }
        if (rx > 6.5) rx -= 13;
        if (rx < -6.5) rx += 13;
        if (rz > 6.5) rz -= 13;
        if (rz < -6.5) rz += 13;
        this.rainDropX[i] = rx;
        this.rainDropY[i] = ry;
        this.rainDropZ[i] = rz;

        const len = this.rainLen[i] * (0.85 + this.weatherIntensitySmoothed * 0.55);
        const invV = len / Math.max(4, this.rainVel[i]);
        const slantX = windDriftX * invV;
        const slantZ = windDriftZ * invV;
        const base = i * 6;
        posArr[base] = rx;
        posArr[base + 1] = ry;
        posArr[base + 2] = rz;
        posArr[base + 3] = rx - slantX;
        posArr[base + 4] = ry + len;
        posArr[base + 5] = rz - slantZ;
      }

      this.rainGeo.setDrawRange(0, activeStreaks * 2);
      (this.rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.rainMat.opacity = 0.24 + this.weatherIntensitySmoothed * (0.28 + 0.14 * liveGust);

      // Ground raindrop splash rings
      const activeSplashes = Math.max(
        6,
        Math.min(SPLASH_COUNT, Math.round(SPLASH_COUNT * this.weatherIntensitySmoothed))
      );
      this.splashInstanced.count = activeSplashes;
      this.splashMat.opacity = 0.28 + this.weatherIntensitySmoothed * 0.3;
      for (let i = 0; i < activeSplashes; i++) {
        const sp = this.splashes[i];
        sp.age += dt;
        if (sp.age >= sp.maxAge) {
          sp.age = 0;
          sp.x = (Math.random() - 0.5) * 6.5 + COURT_WORLD_CENTER_X;
          sp.z = (Math.random() - 0.5) * 8.5 + COURT_WORLD_CENTER_Z;
          sp.y = groundHeightAt(sp.x, sp.z) + 0.022;
          sp.scale = 0.7 + Math.random() * 0.85;
        }
        const t = sp.age / sp.maxAge;
        const ringScale = sp.scale * (0.45 + t * 1.9);
        this.dummy.position.set(sp.x, sp.y, sp.z);
        this.dummy.scale.set(ringScale, 1, ringScale);
        this.dummy.updateMatrix();
        this.splashInstanced.setMatrixAt(i, this.dummy.matrix);
      }
      this.splashInstanced.instanceMatrix.needsUpdate = true;
    }

    // 3. Stone Appearance & 3D World Transform
    if (state.stoneId !== this.lastStoneId) {
      this.lastStoneId = state.stoneId;
      const spec = getStoneSpec(state.stoneId);
      const bodyMat = this.stoneBodyMesh.material as THREE.MeshStandardMaterial;
      bodyMat.color.set(spec.midColor);
      bodyMat.emissive.set(spec.coreColor).multiplyScalar(0.06);
      (this.stoneMotifMesh.material as THREE.MeshBasicMaterial).color.set(spec.motifColor);
    }

    this.stoneGroup.visible = state.stoneInWorld;
    this.stoneShadowMesh.visible = state.stoneInWorld;
    if (state.stoneInWorld) {
      const sw = courtNormalizedToWorld(state.stoneNx, state.stoneNy);
      const gy = groundHeightAt(sw.x, sw.z);
      this.stoneGroup.position.set(sw.x, gy + 0.015 + state.stoneZLift, sw.z);
      this.stoneGroup.rotation.y = state.stoneRot;
      this.stoneShadowMesh.position.set(sw.x, gy + 0.01, sw.z);
      const sScale = Math.max(0.45, 1 - state.stoneZLift * 0.4);
      this.stoneShadowMesh.scale.setScalar(sScale);
    }

    // 4. 3D Aiming Arc + Landing Ring
    this.aimGroup.visible = state.showAimArc;
    if (state.showAimArc) {
      const startW = courtNormalizedToWorld(state.aimStartNx, state.aimStartNy);
      const landW = courtNormalizedToWorld(state.aimLandNx, state.aimLandNy);
      const startGy = groundHeightAt(startW.x, startW.z) + 0.42;
      const endGy = groundHeightAt(landW.x, landW.z) + 0.018;

      const dist = Math.hypot(landW.x - startW.x, landW.z - startW.z);
      const peakHeight = 0.55 + dist * 0.28;
      const windWorldX = state.windX * 0.56 * COURT_WORLD_WIDTH;

      for (let i = 0; i < AIM_ARC_SEGMENTS; i++) {
        const u = (i + 1) / (AIM_ARC_SEGMENTS + 1);
        const px = THREE.MathUtils.lerp(startW.x, landW.x + windWorldX * 0.85, u);
        const pz = THREE.MathUtils.lerp(startW.z, landW.z, u);
        const py = THREE.MathUtils.lerp(startGy, endGy, u) + Math.sin(u * Math.PI) * peakHeight;
        this.aimBeads[i].position.set(px, py, pz);
      }

      const ringX = landW.x + windWorldX * 0.85;
      const ringZ = landW.z;
      const ringGy = groundHeightAt(ringX, ringZ) + 0.022;
      this.targetRingMesh.position.set(ringX, ringGy, ringZ);
      this.targetRingInnerMesh.position.set(ringX, ringGy + 0.002, ringZ);

      const ringCol = state.isClaimAim ? '#34D399' : '#FBBF24';
      (this.targetRingMesh.material as THREE.MeshBasicMaterial).color.set(ringCol);
      const pulse = 0.94 + Math.sin(elapsed * 6.0) * 0.08;
      this.targetRingMesh.scale.setScalar(pulse);
    }

    // 5. Update Dust/Splash Particles
    let anyChanged = false;
    for (let i = 0; i < MAX_DUST; i++) {
      const p = this.dustParticles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.dustInstanced.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.vy -= 4.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = 1 - p.life / p.maxLife;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(p.size * fade);
      this.dummy.updateMatrix();
      this.dustInstanced.setMatrixAt(i, this.dummy.matrix);
      this.dustInstanced.setColorAt(i, p.color);
    }
    if (anyChanged) {
      this.dustInstanced.instanceMatrix.needsUpdate = true;
      if (this.dustInstanced.instanceColor) {
        this.dustInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  public dispose() {
    this.weatherTextures.dispose();
    this.padTex.dispose();
    this.chalkTex.dispose();
    this.puddleGeoCache.dispose();
    this.puddleMat.dispose();
    this.fireflyGeo.dispose();
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.splashMat.dispose();
    this.splashInstanced.geometry.dispose();
    this.splashInstanced.dispose();
    this.dustInstanced.geometry.dispose();
    (this.dustInstanced.material as THREE.Material).dispose();
    this.dustInstanced.dispose();
  }
}
