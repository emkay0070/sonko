import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { sonkoVoice } from '../game/voiceEngine';
import { getStoneSpec, OUTFIT_CATALOG, WorldPlaceId } from '../game/progression';
import {
  clearBuiltInAppearance,
  getAllPersistedSlotsFromIDB,
  readBuiltInAppearances,
  writeBuiltInAppearance,
} from '../game/modelPersistence';
import {
  CourtVenueId,
  Difficulty,
  HudSnapshot,
  MatchRewardSummary,
  PlayerState,
  PlayMode,
  SpeechState,
  WeatherCondition,
  WeatherMode,
} from '../game/types';
import { WEATHER_SPECS } from '../game/weather';
import { CHARACTER_SLOTS, ChildStyle } from './characters';
import { buildCompoundArchitecture } from './compoundArchitecture';
import {
  disposeLoadedModel,
  getAssetLoadMetrics,
  getPendingModelLoadCount,
  isSharedResource,
  load3DModelFromUrl,
} from './modelLoader';
import { CharacterAppearance, CustomGLBColors } from './glbAppearance';
import {
  CharacterViewportPose,
  GLBCharacterController,
  ModelSlotId,
} from './glbCharacterController';
import { createCompoundTextures } from './pbrTextures';
import { EngineCosmetics, Sonko3DGameEngine } from './sonko3DGameEngine';
import { courtNormalizedToWorld, SonkoCourt3D, worldToCourtNormalized } from './sonkoCourt3D';
import {
  applyCompoundTerrainSurface,
  applyTerrainWeatherWetness,
  applyWorldTerrainTheme,
  buildCompoundTerrain,
  CustomTerrainMaps,
  groundHeightAt,
} from './terrain';
import { buildCompoundProps } from './compoundProps';
import { buildDistantWorldSurroundings } from './distantWorld';
import { buildPineForestSurroundings } from './pineForestEnvironment';
import { SHARED_TREE_WIND_STATE, updateGlobalTreeWind } from './treeWind';
import { buildUgandanVegetation } from './vegetation';
import { buildWorldEnvironments } from './worldEnvironments';

export type CompoundCameraPreset =
  | 'play'
  | 'aim_target'
  | 'top_aim'
  | 'courtyard'
  | 'characters'
  | 'ground_low'
  | 'veranda'
  | 'overhead';
export type DaylightPreset = 'auto' | 'morning' | 'midday' | 'golden' | 'night';
export type { CharacterViewportPose, ModelSlotId, SpeechState };

export interface GraphicsSettingsPayload {
  shadowsEnabled: boolean;
  dustEnabled: boolean;
  dynamicWeather?: boolean;
  pixelRatioScale: number;
  cameraShake: boolean;
  defaultCamera?: CompoundCameraPreset;
}

export interface SurfaceTextureSet {
  albedo?: string;
  normal?: string;
  roughness?: string;
  ao?: string;
}

interface CameraWaypoint {
  pos: [number, number, number];
  lookAt: [number, number, number];
}

const CAMERA_PRESETS: Record<CompoundCameraPreset, CameraWaypoint> = {
  play: {
    pos: [0.32, 3.05, 6.25],
    lookAt: [0.25, 0.35, 0.25],
  },
  aim_target: {
    pos: [0.25, 2.15, 5.25],
    lookAt: [0.25, 0.08, 0.25],
  },
  top_aim: {
    pos: [0.25, 7.45, 0.88],
    lookAt: [0.25, 0.05, 0.25],
  },
  courtyard: {
    pos: [5.4, 2.55, 7.6],
    lookAt: [-0.8, 0.9, -0.6],
  },
  characters: {
    pos: [2.85, 1.38, 6.15],
    lookAt: [-0.15, 0.88, 1.95],
  },
  ground_low: {
    pos: [0.72, 0.54, 4.45],
    lookAt: [-0.2, 0.22, -0.3],
  },
  veranda: {
    pos: [-4.9, 1.68, -3.7],
    lookAt: [1.5, 1.05, 1.2],
  },
  overhead: {
    pos: [6.8, 10.5, 9.8],
    lookAt: [-0.5, 0.4, -0.8],
  },
};

type AtmosphereKey = 'morning' | 'midday' | 'golden' | 'overcast' | 'night';

interface AtmosphereConfig {
  elevationDeg: number;
  azimuthDeg: number;
  sunColor: string;
  sunIntensity: number;
  skyColor: string;
  groundBounce: string;
  hemiIntensity: number;
  fillIntensity: number;
  fillColor: string;
  fogColor: string;
  fogDensity: number;
  exposure: number;
  turbidity: number;
  rayleigh: number;
  envIntensity: number;
}

const ATMOSPHERE_CONFIGS: Record<AtmosphereKey, AtmosphereConfig> = {
  morning: {
    elevationDeg: 27,
    azimuthDeg: 112,
    sunColor: '#ffe7c4',
    sunIntensity: 2.85,
    skyColor: '#98c4e8',
    groundBounce: '#8d482d',
    hemiIntensity: 0.95,
    fillIntensity: 0.42,
    fillColor: '#b7d2eb',
    fogColor: '#d9d0c1',
    fogDensity: 0.0085,
    exposure: 1.02,
    turbidity: 4.5,
    rayleigh: 1.6,
    envIntensity: 0.48,
  },
  midday: {
    elevationDeg: 58,
    azimuthDeg: 155,
    sunColor: '#fff5e4',
    sunIntensity: 3.25,
    skyColor: '#8ebee8',
    groundBounce: '#934b30',
    hemiIntensity: 1.05,
    fillIntensity: 0.42,
    fillColor: '#b7d2eb',
    fogColor: '#ded6c9',
    fogDensity: 0.0068,
    exposure: 0.98,
    turbidity: 3.4,
    rayleigh: 1.25,
    envIntensity: 0.48,
  },
  golden: {
    elevationDeg: 14,
    azimuthDeg: 235,
    sunColor: '#ffbf73',
    sunIntensity: 2.7,
    skyColor: '#a6b6d4',
    groundBounce: '#7a3821',
    hemiIntensity: 0.85,
    fillIntensity: 0.36,
    fillColor: '#b4c2df',
    fogColor: '#d4b596',
    fogDensity: 0.0105,
    exposure: 1.08,
    turbidity: 7.2,
    rayleigh: 2.6,
    envIntensity: 0.44,
  },
  overcast: {
    elevationDeg: 40,
    azimuthDeg: 145,
    sunColor: '#d9e7f2',
    sunIntensity: 1.55,
    skyColor: '#7f99ad',
    groundBounce: '#5b392c',
    hemiIntensity: 1.15,
    fillIntensity: 0.55,
    fillColor: '#9fb9cc',
    fogColor: '#8f9ea8',
    fogDensity: 0.014,
    exposure: 0.92,
    turbidity: 9.0,
    rayleigh: 0.65,
    envIntensity: 0.36,
  },
  night: {
    elevationDeg: -2.5,
    azimuthDeg: 220,
    sunColor: '#8fa9dc',
    sunIntensity: 0.55,
    skyColor: '#1f2847',
    groundBounce: '#26140c',
    hemiIntensity: 0.46,
    fillIntensity: 0.25,
    fillColor: '#485d8e',
    fogColor: '#151829',
    fogDensity: 0.018,
    exposure: 0.88,
    turbidity: 2.0,
    rayleigh: 0.35,
    envIntensity: 0.2,
  },
};

function venueToAtmosphere(venue: CourtVenueId): AtmosphereKey {
  switch (venue) {
    case 'entebbe_sand':
      return 'morning';
    case 'jinja_rain':
      return 'overcast';
    case 'ndere_night':
      return 'night';
    case 'kampala_murram':
    default:
      return 'midday';
  }
}

// Module-scope scratch helpers (zero GC inside animation loop)
const _sunVec = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hitPoint = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _weatherFogTarget = new THREE.Color('#84949f');
const _weatherSunTarget = new THREE.Color('#d2e1ed');

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export interface UgandanCompoundController {
  engine: Sonko3DGameEngine;
  setCameraPreset: (preset: CompoundCameraPreset) => void;
  setDaylight: (preset: DaylightPreset) => void;
  setWeatherMode: (mode: WeatherMode, rerollRandom?: boolean) => void;
  setPose: (pose: CharacterViewportPose) => void;
  setSpeechState: (state: SpeechState) => void;
  applyGraphicsSettings: (settings: GraphicsSettingsPayload) => void;
  updateCosmetics: (cosmetics: EngineCosmetics) => void;
  setGameCallbacks: (
    onHudChange?: (snapshot: HudSnapshot) => void,
    onMatchComplete?: (
      reward: MatchRewardSummary,
      won: boolean,
      humanStats: PlayerState,
      venue: CourtVenueId,
      meta?: { mode: PlayMode; difficulty: Difficulty }
    ) => void
  ) => void;
  exportGLB: () => Promise<Blob>;
  loadSlotGLBFromUrl: (
    slot: ModelSlotId,
    url: string,
    appearance?: CharacterAppearance,
    meta?: {
      assetType?: 'model' | 'surface-textures';
      textureSet?: SurfaceTextureSet;
      fileNameHint?: string;
    }
  ) => Promise<{ animations: string[]; hasSkeleton: boolean }>;
  updateSlotAppearance: (slot: ModelSlotId, appearance: CharacterAppearance) => void;
  clearSlotGLB: (slot: ModelSlotId) => void;
  triggerArrivalSequence: () => boolean;
  skipArrivalSequence: () => void;
  isArrivalPlaying: () => boolean;
  dispose: () => void;
}

export interface MountCompoundOptions {
  initialCosmetics: EngineCosmetics;
  initialGraphics?: GraphicsSettingsPayload;
  onHudChange?: (snapshot: HudSnapshot) => void;
  onMatchComplete?: (
    reward: MatchRewardSummary,
    won: boolean,
    humanStats: PlayerState,
    venue: CourtVenueId,
    meta?: { mode: PlayMode; difficulty: Difficulty }
  ) => void;
  onArrivalStateChange?: (playing: boolean) => void;
  onReady?: () => void;
}

export function mountUgandanCompoundScene(
  container: HTMLElement,
  options: MountCompoundOptions
): UgandanCompoundController {
  const isSoftwareGl = detectSoftwareWebGL();
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  let shadowsEnabledSetting = options.initialGraphics?.shadowsEnabled ?? true;
  let dustEnabledSetting = options.initialGraphics?.dustEnabled ?? true;
  let dynamicWeatherEnabledSetting = options.initialGraphics?.dynamicWeather ?? true;
  let pixelRatioScaleSetting = options.initialGraphics?.pixelRatioScale ?? 1.25;
  let cameraShakeEnabledSetting = options.initialGraphics?.cameraShake ?? true;

  renderer.toneMappingExposure = ATMOSPHERE_CONFIGS.midday.exposure;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, pixelRatioScaleSetting, 1.5)
  );
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl && shadowsEnabledSetting;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  // Floating 3D-projected callout overlay layer (zero React state churn)
  const calloutHost = document.createElement('div');
  calloutHost.style.position = 'absolute';
  calloutHost.style.inset = '0';
  calloutHost.style.pointerEvents = 'none';
  calloutHost.style.overflow = 'hidden';
  calloutHost.style.zIndex = '5';
  container.appendChild(calloutHost);
  const calloutNodes = new Map<number, HTMLDivElement>();
  const speechNodes = new Map<ChildStyle, HTMLDivElement>();
  const _headWorldPos = new THREE.Vector3();

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 280);
  camera.position.set(...CAMERA_PRESETS.characters.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...CAMERA_PRESETS.characters.lookAt);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.minDistance = 0.85;
  controls.maxDistance = 26;
  controls.update();

  // Studio + Equatorial Sky Environment Reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.48;
  pmremGenerator.dispose();

  // Physical Atmospheric Equatorial Sky
  const sky = new Sky();
  sky.scale.setScalar(450);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['mieCoefficient'].value = 0.0045;
  skyUniforms['mieDirectionalG'].value = 0.82;

  const fog = new THREE.FogExp2(
    ATMOSPHERE_CONFIGS.midday.fogColor,
    ATMOSPHERE_CONFIGS.midday.fogDensity
  );
  scene.fog = fog;

  // 3-Point Natural African Daylight Rig (tight 1024x1024 court/compound shadow map for 4x faster fill)
  const sunLight = new THREE.DirectionalLight('#fff5e4', 3.25);
  sunLight.castShadow = !isSoftwareGl && shadowsEnabledSetting;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 45;
  sunLight.shadow.camera.left = -11;
  sunLight.shadow.camera.right = 11;
  sunLight.shadow.camera.top = 11;
  sunLight.shadow.camera.bottom = -11;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.022;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight('#8ebee8', '#934b30', 1.05);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const fillLight = new THREE.DirectionalLight('#b7d2eb', 0.42);
  fillLight.position.set(-10, 6, -9);
  scene.add(fillLight);

  // Build Compound World Group (Exportable to GLB for Blender!)
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const textures = createCompoundTextures(maxAniso);

  const worldGroup = new THREE.Group();
  worldGroup.name = 'SonkoUgandanCompound';

  const terrainGroup = buildCompoundTerrain({
    courtyardAlbedo: textures.murramAlbedo,
    courtyardNormal: textures.murramNormal,
    courtyardRoughness: textures.murramRoughness,
    courtyardAO: textures.murramAO,
  });
  worldGroup.add(terrainGroup);

  const archGroup = buildCompoundArchitecture(textures, maxAniso);
  worldGroup.add(archGroup);

  const vegetation = buildUgandanVegetation(textures);
  worldGroup.add(vegetation.group);

  const pineForest = buildPineForestSurroundings({
    isSoftwareGl,
    shadowsEnabled: () => shadowsEnabledSetting,
    maxAnisotropy: maxAniso,
  });
  worldGroup.add(pineForest.group);

  const compoundProps = buildCompoundProps({
    isSoftwareGl,
    shadowsEnabled: () => shadowsEnabledSetting,
    maxAnisotropy: maxAniso,
  });
  worldGroup.add(compoundProps.group);

  const distantWorld = buildDistantWorldSurroundings({
    isSoftwareGl,
    shadowsEnabled: () => shadowsEnabledSetting,
    maxAnisotropy: maxAniso,
  });
  worldGroup.add(distantWorld.group);

  const worldEnvs = buildWorldEnvironments({
    isSoftwareGl,
    shadowsEnabled: () => shadowsEnabledSetting,
    maxAnisotropy: maxAniso,
    onKampalaToggle: (isKampala) => {
      archGroup.visible = isKampala;
      vegetation.group.visible = isKampala;
      pineForest.group.visible = isKampala;
      compoundProps.group.visible = isKampala;
    },
    onOuterHillsToggle: (showHills) => {
      const hills = terrainGroup.getObjectByName('SurroundingKampalaHills');
      if (hills) hills.visible = showHills;
    },
  });
  let currentWorldPlace: WorldPlaceId = options.initialCosmetics.previewPlace ?? 'kampala_compound';
  worldGroup.add(worldEnvs.group);

  // Live Interactive 3D Sonko Court + Stone + Aiming Arc + Puddles/Rain/Lanterns
  const court3D = new SonkoCourt3D(maxAniso, isSoftwareGl);
  court3D.setDynamicWeatherEnabled(dynamicWeatherEnabledSetting);
  worldGroup.add(court3D.group);

  const syncPlaceVisuals = (place: WorldPlaceId) => {
    worldEnvs.setPlace(place);
    distantWorld.setPlace(place);
    applyWorldTerrainTheme(terrainGroup, place, maxAniso);
    court3D.setWorldPlace(place);
  };
  syncPlaceVisuals(currentWorldPlace);

  // Pure GLB Character Rig & Kinematics Controller (Zero Procedural Dummies!)
  const glbChars = new GLBCharacterController(textures, isSoftwareGl);
  worldGroup.add(glbChars.group);

  scene.add(worldGroup);

  // Warm sun-lit courtyard dust motes floating lazily in the afternoon breeze (zero per-frame GPU buffer upload)
  const moteCount = 72;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const mx = Math.sin(i * 19.3) * 0.5 * 14;
    const mz = Math.cos(i * 23.7) * 0.5 * 14;
    motePos[i * 3] = mx;
    motePos[i * 3 + 1] = groundHeightAt(mx, mz) + 0.35 + ((i * 7) % 19) * 0.16;
    motePos[i * 3 + 2] = mz;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: '#ffe5bd',
    size: 0.032,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  dustMotes.name = 'CourtyardDustMotes';
  scene.add(dustMotes);

  // Soft wind-driven mist wisps synced with Dynamic Weather fog & tree breeze
  const mistCount = 72;
  const mistGeo = new THREE.BufferGeometry();
  const mistPos = new Float32Array(mistCount * 3);
  const mistBaseY = new Float32Array(mistCount);
  const mistSpeedFactor = new Float32Array(mistCount);
  for (let i = 0; i < mistCount; i++) {
    const mx = ((i * 73) % 26) - 13 + Math.sin(i * 5.7) * 0.7;
    const mz = ((i * 41) % 26) - 13 + Math.cos(i * 4.3) * 0.7;
    const my = groundHeightAt(mx, mz) + 0.35 + (i % 9) * 0.26;
    mistPos[i * 3] = mx;
    mistPos[i * 3 + 1] = my;
    mistPos[i * 3 + 2] = mz;
    mistBaseY[i] = my;
    mistSpeedFactor[i] = 0.72 + (i % 7) * 0.09;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));

  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 64;
  mistCanvas.height = 64;
  const mistCtx = mistCanvas.getContext('2d');
  if (mistCtx) {
    const grad = mistCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(235, 244, 250, 0.85)');
    grad.addColorStop(0.5, 'rgba(220, 232, 242, 0.35)');
    grad.addColorStop(1, 'rgba(210, 224, 236, 0)');
    mistCtx.fillStyle = grad;
    mistCtx.fillRect(0, 0, 64, 64);
  }
  const mistSpriteTex = new THREE.CanvasTexture(mistCanvas);
  const mistMat = new THREE.PointsMaterial({
    map: mistSpriteTex,
    color: '#d9e5ee',
    size: 2.35,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const mistWisps = new THREE.Points(mistGeo, mistMat);
  mistWisps.name = 'CourtyardMistWisps';
  mistWisps.visible = false;
  mistWisps.frustumCulled = false;
  scene.add(mistWisps);

  // Full SONKO Game Engine
  const engine = new Sonko3DGameEngine(
    options.initialCosmetics,
    court3D,
    options.onHudChange,
    options.onMatchComplete
  );

  // Track saved Studio slot appearances & Player 0 customizer color state
  const slotSavedAppearances = new Map<ModelSlotId, CharacterAppearance>();
  const builtInAppearances = readBuiltInAppearances();
  for (const spec of CHARACTER_SLOTS) {
    const app = builtInAppearances[spec.id];
    if (app) slotSavedAppearances.set(spec.id, app);
  }

  let player0CustomColors: CustomGLBColors | undefined =
    options.initialCosmetics.avatar.primaryColor !== OUTFIT_CATALOG[0].primaryColor ||
    options.initialCosmetics.avatar.accentColor !== OUTFIT_CATALOG[0].accentColor
      ? {
          primaryColor: options.initialCosmetics.avatar.primaryColor,
          accentColor: options.initialCosmetics.avatar.accentColor,
        }
      : undefined;
  let lastAppliedAvatarPrimary = options.initialCosmetics.avatar.primaryColor;
  let lastAppliedAvatarAccent = options.initialCosmetics.avatar.accentColor;

  if (player0CustomColors) {
    glbChars.updateAppearance(
      'kato',
      slotSavedAppearances.get('kato') ?? {
        skinTone: 'original',
        outfitStyle: 'original',
        shoeStyle: 'original',
      },
      player0CustomColors
    );
  }

  glbChars.updateHandStoneSpec(getStoneSpec(options.initialCosmetics.equippedStone));

  // Atmosphere, Daylight & Dynamic Weather state
  let daylightOverride: DaylightPreset = options.initialCosmetics.previewPeriod ?? 'auto';
  let weatherMode: WeatherMode = options.initialCosmetics.weatherMode ?? 'auto';
  let lastAtmosphereKey: AtmosphereKey | '' = '';
  const initialWeatherSpec = WEATHER_SPECS[engine.getWeatherCondition()] ?? WEATHER_SPECS.clear;
  let smoothedWetness = dynamicWeatherEnabledSetting ? initialWeatherSpec.wetness : 0;
  let smoothedWindStrength = dynamicWeatherEnabledSetting ? initialWeatherSpec.windStrength : 0.04;
  let smoothedMistIntensity = dynamicWeatherEnabledSetting ? initialWeatherSpec.mistIntensity : 0;
  let smoothedRainIntensity = dynamicWeatherEnabledSetting ? initialWeatherSpec.rainIntensity : 0;
  let smoothedSkyDimming = dynamicWeatherEnabledSetting ? initialWeatherSpec.skyDimming : 0;
  let smoothedWindDirX = 0.84;
  let smoothedWindDirZ = 0.54;
  let accumulatedWindTime = 0;

  const applyAtmosphere = (key: AtmosphereKey) => {
    const cfg = ATMOSPHERE_CONFIGS[key];
    const dim = smoothedSkyDimming;
    const mist = smoothedMistIntensity;
    const rain = smoothedRainIntensity;
    const effectiveDim =
      key === 'overcast' ? dim * 0.25 : key === 'night' ? dim * 0.25 : dim;

    if (key !== lastAtmosphereKey) {
      lastAtmosphereKey = key;
      const phi = THREE.MathUtils.degToRad(90 - cfg.elevationDeg);
      const theta = THREE.MathUtils.degToRad(cfg.azimuthDeg);
      _sunVec.setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(_sunVec);
      sunLight.position.copy(_sunVec).multiplyScalar(24);
    }

    skyUniforms['turbidity'].value = THREE.MathUtils.lerp(
      cfg.turbidity,
      Math.max(cfg.turbidity, 9.2),
      dim * 0.85
    );
    skyUniforms['rayleigh'].value = THREE.MathUtils.lerp(cfg.rayleigh, 0.55, dim * 0.78);

    sunLight.color.set(cfg.sunColor).lerp(_weatherSunTarget, dim * 0.45);
    sunLight.intensity = cfg.sunIntensity * (1 - effectiveDim * 0.52);

    hemiLight.color.set(cfg.skyColor);
    hemiLight.groundColor.set(cfg.groundBounce);
    hemiLight.intensity = cfg.hemiIntensity * (1 + dim * 0.12);

    fillLight.color.set(cfg.fillColor);
    fillLight.intensity = cfg.fillIntensity * (1 + dim * 0.24);

    fog.color
      .set(cfg.fogColor)
      .lerp(_weatherFogTarget, Math.min(0.78, dim * 0.48 + mist * 0.36 + rain * 0.18));
    const mistSurge = 1.0 + mist * 1.15 + rain * 0.45 + dim * 0.18;
    const gustHazePulse =
      1.0 + (SHARED_TREE_WIND_STATE.liveGust - 0.5) * 0.14 * Math.max(mist, rain);
    fog.density = cfg.fogDensity * mistSurge * gustHazePulse;

    renderer.toneMappingExposure = cfg.exposure * (1 - effectiveDim * 0.08);
    scene.environmentIntensity = cfg.envIntensity * (1 - effectiveDim * 0.18);

    dustMotes.visible =
      dustEnabledSetting &&
      key !== 'overcast' &&
      key !== 'night' &&
      rain < 0.1 &&
      mist < 0.45;
  };

  const syncVenueAtmosphere = () => {
    const key =
      daylightOverride === 'auto' ? venueToAtmosphere(engine.getActiveVenue()) : daylightOverride;
    applyAtmosphere(key);
  };

  let preferredPlayCamera: CompoundCameraPreset =
    options.initialGraphics?.defaultCamera ?? 'play';

  const applyGraphicsSettings = (next: GraphicsSettingsPayload) => {
    shadowsEnabledSetting = next.shadowsEnabled;
    dustEnabledSetting = next.dustEnabled;
    if (typeof next.dynamicWeather === 'boolean') {
      dynamicWeatherEnabledSetting = next.dynamicWeather;
      court3D.setDynamicWeatherEnabled(dynamicWeatherEnabledSetting);
    }
    pixelRatioScaleSetting = next.pixelRatioScale;
    cameraShakeEnabledSetting = next.cameraShake;
    if (next.defaultCamera) {
      preferredPlayCamera = next.defaultCamera;
    }

    renderer.shadowMap.enabled = !isSoftwareGl && shadowsEnabledSetting;
    sunLight.castShadow = !isSoftwareGl && shadowsEnabledSetting;
    pineForest.setShadowsEnabled(shadowsEnabledSetting);
    compoundProps.setShadowsEnabled(shadowsEnabledSetting);
    distantWorld.setShadowsEnabled(shadowsEnabledSetting);
    worldEnvs.setShadowsEnabled(shadowsEnabledSetting);
    renderer.shadowMap.needsUpdate = true;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, pixelRatioScaleSetting, 1.5)
    );
    renderer.setSize(w, h);

    syncVenueAtmosphere();
  };

  syncVenueAtmosphere();
  applyTerrainWeatherWetness(terrainGroup, smoothedWetness);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Camera Preset & Interactive Gameplay Tracking
  let activePreset: CompoundCameraPreset = 'characters';
  let transitioningCamera = false;
  let userManualOrbit = false;
  let prevScreen = engine.getScreen();
  let prevPhase = engine.getPhase();
  let desiredFov = 45;
  let fovLambda = 3.2;
  let stoneReturnTimer = 0;
  const STONE_RETURN_DURATION = 1.5;
  let lastStoneCamX = 0.28;
  let lastStoneCamY = 1.15;
  let lastStoneCamZ = 1.85;
  let lastStoneLookX = 0.25;
  let lastStoneLookZ = 0.1;

  controls.addEventListener('start', () => {
    transitioningCamera = false;
    userManualOrbit = true;
  });

  let lastNotifiedArrival = false;
  const notifyArrivalIfChanged = () => {
    const playing = worldEnvs.isArrivalPlaying();
    if (playing !== lastNotifiedArrival) {
      lastNotifiedArrival = playing;
      options.onArrivalStateChange?.(playing);
      if (!playing && engine.getScreen() === 'PLAYING' && !userManualOrbit) {
        setCameraPreset(preferredPlayCamera);
      }
    }
  };

  const triggerArrivalSequence = (): boolean => {
    const started = worldEnvs.startArrivalSequence(currentWorldPlace);
    if (started) {
      transitioningCamera = false;
      userManualOrbit = false;
      notifyArrivalIfChanged();
    }
    return started;
  };

  const skipArrivalSequence = () => {
    if (!worldEnvs.isArrivalPlaying()) return;
    worldEnvs.skipArrivalSequence();
    notifyArrivalIfChanged();
  };

  const setCameraPreset = (preset: CompoundCameraPreset) => {
    activePreset = preset;
    userManualOrbit = false;
    const wp = CAMERA_PRESETS[preset];
    _desiredCamPos.set(...wp.pos);
    _desiredTarget.set(...wp.lookAt);
    transitioningCamera = true;
  };

  const setDaylight = (preset: DaylightPreset) => {
    daylightOverride = preset;
    engine.setWeatherConfig(preset, weatherMode, false);
    syncVenueAtmosphere();
  };

  const setWeatherMode = (mode: WeatherMode, rerollRandom = false) => {
    weatherMode = mode;
    engine.setWeatherConfig(daylightOverride, mode, rerollRandom);
    syncVenueAtmosphere();
  };

  // Interactive Pointer & Keyboard Wiring for Gameplay
  const getCourtNormFromPointer = (clientX: number, clientY: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    _ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    _raycaster.setFromCamera(_ndc, camera);
    const hit = _raycaster.ray.intersectPlane(_groundPlane, _hitPoint);
    if (!hit) return null;
    return worldToCourtNormalized(hit.x, hit.z);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (worldEnvs.isArrivalPlaying() || engine.isLocalInputLocked()) return;
    const norm = getCourtNormFromPointer(e.clientX, e.clientY);
    if (norm) {
      engine.handleCourtPointerMove(norm.nx, norm.ny);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (worldEnvs.isArrivalPlaying()) {
      if (e.button === 0) skipArrivalSequence();
      return;
    }
    if (e.button !== 0 || engine.isLocalInputLocked()) return;
    const norm = getCourtNormFromPointer(e.clientX, e.clientY);
    if (norm) {
      engine.handleCourtPointerDown(norm.nx, norm.ny);
    } else {
      engine.handleCourtPointerDown(0.5, 0.5);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return;
    engine.handleCourtPointerUp();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (worldEnvs.isArrivalPlaying()) {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        skipArrivalSequence();
      }
      return;
    }
    engine.handleKeyDown(e);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    engine.handleKeyUp(e);
  };

  const onWindowBlur = () => {
    engine.handleWindowBlur();
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);

  // Resize Handler
  const handleResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  // Frame-rate independent loop with Software WebGL pacing
  let disposed = false;
  let frameId = 0;
  let lastTime = performance.now();
  const startTime = lastTime;

  const afterDraw = (cb: () => void) => {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  };

  const syncCalloutOverlay = (viewW: number, viewH: number) => {
    const active = engine.getActiveCallouts();
    const aliveIds = new Set<number>();

    for (const c of active) {
      aliveIds.add(c.id);
      let node = calloutNodes.get(c.id);
      if (!node) {
        node = document.createElement('div');
        node.style.position = 'absolute';
        node.style.left = '0';
        node.style.top = '0';
        node.style.fontFamily = "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif";
        node.style.fontWeight = '800';
        node.style.fontSize = '15px';
        node.style.letterSpacing = '0.03em';
        node.style.whiteSpace = 'nowrap';
        node.style.textShadow = '0 2px 6px rgba(15, 6, 3, 0.92)';
        node.style.willChange = 'transform, opacity';
        calloutHost.appendChild(node);
        calloutNodes.set(c.id, node);
      }
      const t = c.life / c.maxLife;
      const liftY = c.worldY + t * 0.72;
      _projVec.set(c.worldX, liftY, c.worldZ);
      _projVec.project(camera);

      if (_projVec.z > 1) {
        node.style.opacity = '0';
      } else {
        const sx = (_projVec.x * 0.5 + 0.5) * viewW;
        const sy = (-_projVec.y * 0.5 + 0.5) * viewH;
        const alpha = Math.max(0, 1 - Math.pow(t, 1.6));
        node.textContent = c.text;
        node.style.color = c.color;
        node.style.opacity = alpha.toFixed(2);
        node.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
      }
    }

    for (const [id, node] of calloutNodes.entries()) {
      if (!aliveIds.has(id)) {
        node.remove();
        calloutNodes.delete(id);
      }
    }

    // Per-character 3D speech bubbles (driven directly by sonkoVoice without React state churn)
    const nowMs = performance.now();
    const showSubtitles = sonkoVoice.areSubtitlesEnabled();
    for (const spec of CHARACTER_SLOTS) {
      const bubble = showSubtitles ? sonkoVoice.getActiveSpeech(spec.id, nowMs) : null;
      let sNode = speechNodes.get(spec.id);
      if (!bubble) {
        if (sNode) {
          sNode.style.opacity = '0';
        }
        continue;
      }

      if (!glbChars.getSlotWorldHeadPos(spec.id, _headWorldPos)) {
        if (sNode) sNode.style.opacity = '0';
        continue;
      }

      if (!sNode) {
        sNode = document.createElement('div');
        sNode.style.position = 'absolute';
        sNode.style.left = '0';
        sNode.style.top = '0';
        sNode.style.maxWidth = '210px';
        sNode.style.padding = '6px 10px';
        sNode.style.borderRadius = '10px';
        sNode.style.background = 'rgba(22, 11, 7, 0.92)';
        sNode.style.border = '1px solid rgba(251, 191, 36, 0.45)';
        sNode.style.color = '#FAF3E8';
        sNode.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
        sNode.style.fontSize = '11.5px';
        sNode.style.lineHeight = '1.3';
        sNode.style.fontWeight = '500';
        sNode.style.textAlign = 'center';
        sNode.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.45)';
        sNode.style.willChange = 'transform, opacity';
        calloutHost.appendChild(sNode);
        speechNodes.set(spec.id, sNode);
      }

      _headWorldPos.project(camera);
      if (_headWorldPos.z > 1) {
        sNode.style.opacity = '0';
        continue;
      }

      const sx = THREE.MathUtils.clamp((_headWorldPos.x * 0.5 + 0.5) * viewW, 110, Math.max(110, viewW - 110));
      const sy = THREE.MathUtils.clamp((-_headWorldPos.y * 0.5 + 0.5) * viewH - 18, 44, Math.max(44, viewH - 44));
      const frac = (nowMs - bubble.startedAt) / bubble.durationMs;
      const alpha = frac < 0.12 ? frac / 0.12 : frac > 0.82 ? Math.max(0, (1 - frac) / 0.18) : 1;

      const accent =
        bubble.emotion === 'annoyed'
          ? '#FCA5A5'
          : bubble.emotion === 'laugh'
            ? '#FDE047'
            : bubble.emotion === 'cheer'
              ? '#86EFAC'
              : '#FBBF24';

      let nameEl = sNode.firstElementChild as HTMLSpanElement | null;
      let textEl = sNode.lastElementChild as HTMLSpanElement | null;
      if (!nameEl || !textEl || nameEl === textEl) {
        sNode.textContent = '';
        nameEl = document.createElement('span');
        nameEl.style.fontWeight = '700';
        textEl = document.createElement('span');
        sNode.appendChild(nameEl);
        sNode.appendChild(textEl);
      }
      nameEl.style.color = accent;
      nameEl.textContent = `${spec.name}: `;
      textEl.textContent = bubble.text;
      sNode.style.borderColor = accent;
      sNode.style.opacity = alpha.toFixed(2);
      sNode.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
    }
  };

  const tick = () => {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    const elapsed = (now - startTime) / 1000;

    // 1. Update SONKO game simulation & venue lighting
    engine.update(dt);
    syncVenueAtmosphere();

    const curScreen = engine.getScreen();
    const camFocus = engine.getCameraFocusState();
    if (curScreen !== prevScreen) {
      stoneReturnTimer = 0;
      if (curScreen === 'PLAYING') {
        if (!worldEnvs.isArrivalPlaying()) {
          setCameraPreset(preferredPlayCamera);
        }
      } else if (curScreen === 'TITLE_MENU') {
        skipArrivalSequence();
        setCameraPreset('characters');
      } else if (curScreen === 'GAME_OVER') {
        skipArrivalSequence();
        userManualOrbit = false;
        transitioningCamera = false;
      }
      prevScreen = curScreen;
    }

    // Track stone flight transitions for soft return & auto-reengage Dynamic camera on launch
    if (camFocus.phase !== prevPhase) {
      if (camFocus.phase === 'STONE_FLIGHT' || camFocus.phase === 'CLAIM_FLIGHT') {
        stoneReturnTimer = 0;
        if (activePreset === 'play') {
          userManualOrbit = false;
        }
      } else if (prevPhase === 'STONE_FLIGHT' || prevPhase === 'CLAIM_FLIGHT') {
        stoneReturnTimer = STONE_RETURN_DURATION;
      } else if (
        camFocus.phase === 'TOSS_AIM' ||
        camFocus.phase === 'CLAIM_AIM' ||
        camFocus.phase === 'PLAYER_SWITCH'
      ) {
        stoneReturnTimer = 0;
      }
      prevPhase = camFocus.phase;
    }

    // Reserve Left Mouse Button for aiming/hopping during local PLAYING turns; keep Right-drag orbit
    const lockOrbitLeft = curScreen === 'PLAYING' && !engine.isLocalInputLocked() && !worldEnvs.isArrivalPlaying();
    if (lockOrbitLeft) {
      controls.mouseButtons.LEFT = null as unknown as THREE.MOUSE;
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
      renderer.domElement.style.cursor = 'crosshair';
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      renderer.domElement.style.cursor = 'grab';
    }

    // 2. Sync dynamic 3D court, river stone, aiming arc, puddles, lanterns & particles
    const courtSync = engine.getCourtSyncState();
    court3D.sync(courtSync, elapsed, dt);

    // 3. Drive GLB characters (animations, morph blink/smile, skeleton kinematics, stone socket)
    const poses = engine.getCharacterPoses(elapsed);
    glbChars.updateCharacters(elapsed, dt, poses, curScreen === 'TITLE_MENU');

    // 4. Dynamic Weather Breeze, Fog/Mist Intensity, Rain Sync & Animated World Props
    const activeWeatherSpec = WEATHER_SPECS[engine.getWeatherCondition()] ?? WEATHER_SPECS.clear;
    const isEntebbe = engine.getActiveVenue() === 'entebbe_sand' || currentWorldPlace === 'entebbe_lakeside';
    const targetWetness = dynamicWeatherEnabledSetting ? activeWeatherSpec.wetness : 0;
    const targetWind = dynamicWeatherEnabledSetting ? activeWeatherSpec.windStrength : 0.04;
    const targetMist = dynamicWeatherEnabledSetting ? activeWeatherSpec.mistIntensity : 0;
    const targetRain = dynamicWeatherEnabledSetting ? activeWeatherSpec.rainIntensity : 0;
    const targetDim = dynamicWeatherEnabledSetting ? activeWeatherSpec.skyDimming : 0;

    smoothedWetness = THREE.MathUtils.damp(smoothedWetness, targetWetness, 2.8, dt);
    smoothedWindStrength = THREE.MathUtils.damp(smoothedWindStrength, targetWind, 2.6, dt);
    smoothedMistIntensity = THREE.MathUtils.damp(smoothedMistIntensity, targetMist, 2.2, dt);
    smoothedRainIntensity = THREE.MathUtils.damp(smoothedRainIntensity, targetRain, 2.8, dt);
    smoothedSkyDimming = THREE.MathUtils.damp(smoothedSkyDimming, targetDim, 2.2, dt);
    applyTerrainWeatherWetness(terrainGroup, smoothedWetness);

    const targetDirX =
      dynamicWeatherEnabledSetting && Math.abs(courtSync.windX) > 0.006
        ? THREE.MathUtils.clamp(courtSync.windX * 11.0, -0.95, 0.95)
        : 0.84;
    const targetDirZ = 0.54;
    smoothedWindDirX = THREE.MathUtils.damp(smoothedWindDirX, targetDirX, 2.0, dt);
    smoothedWindDirZ = THREE.MathUtils.damp(smoothedWindDirZ, targetDirZ, 2.0, dt);

    const windPace =
      (dynamicWeatherEnabledSetting ? 0.85 : 0.55) +
      smoothedWindStrength * 0.55 +
      (dynamicWeatherEnabledSetting && isEntebbe ? 0.16 : 0);
    accumulatedWindTime += dt * windPace;
    const visualWindStrength = dynamicWeatherEnabledSetting
      ? 0.36 + smoothedWindStrength * 0.96 + (isEntebbe ? 0.16 : 0)
      : 0.22;

    updateGlobalTreeWind(accumulatedWindTime, visualWindStrength, smoothedWindDirX, smoothedWindDirZ);
    vegetation.updateWind(accumulatedWindTime);
    syncVenueAtmosphere();
    worldEnvs.update(dt, elapsed);
    notifyArrivalIfChanged();

    const mistActive = dynamicWeatherEnabledSetting && smoothedMistIntensity > 0.06;
    mistWisps.visible = mistActive;
    if (mistActive) {
      const mAttr = mistGeo.attributes.position as THREE.BufferAttribute;
      const mArr = mAttr.array as Float32Array;
      const mistStep =
        (0.45 + visualWindStrength * 1.35) * (0.65 + 0.55 * SHARED_TREE_WIND_STATE.liveGust) * dt;
      const vx = SHARED_TREE_WIND_STATE.dirX * mistStep;
      const vz = SHARED_TREE_WIND_STATE.dirZ * mistStep;
      for (let i = 0; i < mistCount; i++) {
        const idx = i * 3;
        const spd = mistSpeedFactor[i];
        let x = mArr[idx] + vx * spd;
        let z = mArr[idx + 2] + vz * spd;
        if (x > 13) x -= 26;
        if (x < -13) x += 26;
        if (z > 13) z -= 26;
        if (z < -13) z += 26;
        mArr[idx] = x;
        mArr[idx + 1] = mistBaseY[i] + Math.sin(accumulatedWindTime * 0.6 + i * 0.7) * 0.14;
        mArr[idx + 2] = z;
      }
      mAttr.needsUpdate = true;
      mistMat.opacity = Math.min(0.28, smoothedMistIntensity * 0.24 + smoothedRainIntensity * 0.08);
      mistMat.color.copy(fog.color).lerp(_weatherSunTarget, 0.35);
    }

    if (dustMotes.visible) {
      dustMotes.position.y = Math.sin(elapsed * 0.7) * 0.06;
      dustMotes.rotation.y = elapsed * 0.02;
    }

    // 5. Camera preset glide, Car Arrival Sequence, Aim/Top-Down framing, & Cinematic Stone-Toss Choreography
    desiredFov = 45;
    fovLambda = 3.2;
    const arrivalCam = worldEnvs.getArrivalCameraTarget();
    if (arrivalCam && arrivalCam.active) {
      desiredFov = arrivalCam.fov;
      fovLambda = 4.2;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, arrivalCam.camPos.x, 7.2, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, arrivalCam.camPos.y, 7.2, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, arrivalCam.camPos.z, 7.2, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, arrivalCam.lookAt.x, 8.2, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, arrivalCam.lookAt.y, 8.2, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, arrivalCam.lookAt.z, 8.2, dt);
    } else if (curScreen === 'PLAYING' && activePreset === 'play' && !transitioningCamera && !userManualOrbit) {
      let targetCamX = 0.28 + (camFocus.playerWorldX - 0.25) * 0.25;
      let targetCamY = 3.05;
      let targetCamZ = 5.05 + (camFocus.playerWorldZ - 0.35) * 0.38;
      let targetLookX = 0.25 + (camFocus.playerWorldX - 0.25) * 0.25;
      let targetLookY = 0.35;
      let targetLookZ = camFocus.playerWorldZ * 0.44 - 0.22;
      let posLambda = 3.4;
      let lookLambda = 4.2;

      if (camFocus.phase === 'STONE_FLIGHT' || camFocus.phase === 'CLAIM_FLIGHT') {
        if (camFocus.stoneBounces === 0) {
          // Cinematic airborne swoop tracking the spinning river stone arc
          const lateralArc = Math.sin(elapsed * 2.1) * 0.22 + (camFocus.stoneWorldX >= 0.25 ? -0.58 : 0.58);
          targetCamX = camFocus.stoneWorldX * 0.65 + lateralArc;
          targetCamY = 1.24 + camFocus.stoneWorldY * 0.52;
          targetCamZ = camFocus.stoneWorldZ + 2.38;
          targetLookX = camFocus.stoneWorldX * 0.55 + camFocus.targetSquareWorldX * 0.45;
          targetLookY = 0.14 + camFocus.stoneWorldY * 0.38;
          targetLookZ = camFocus.stoneWorldZ * 0.52 + camFocus.targetSquareWorldZ * 0.48;
          desiredFov = 38.5;
          posLambda = 6.2;
          lookLambda = 7.5;
        } else {
          // Low impact focus on the bounce & chalk square boundary
          const sideSign = camFocus.stoneWorldX >= 0.25 ? -1 : 1;
          targetCamX = camFocus.stoneWorldX + sideSign * 0.72;
          targetCamY = 0.94;
          targetCamZ = camFocus.stoneWorldZ + 1.56;
          targetLookX = camFocus.stoneWorldX;
          targetLookY = 0.06;
          targetLookZ = camFocus.stoneWorldZ;
          desiredFov = 37;
          posLambda = 5.4;
          lookLambda = 6.8;
        }
        lastStoneCamX = targetCamX;
        lastStoneCamY = targetCamY;
        lastStoneCamZ = targetCamZ;
        lastStoneLookX = targetLookX;
        lastStoneLookZ = targetLookZ;
        fovLambda = 4.6;
      } else if (camFocus.phase === 'PLAYER_SWITCH') {
        // Gentle baseline wide shot as outgoing & incoming players walk across the courtyard
        targetCamX = 0.35;
        targetCamY = 2.55;
        targetCamZ = 6.35;
        targetLookX = 0.25;
        targetLookY = 0.72;
        targetLookZ = 2.05;
        desiredFov = 45;
        posLambda = 2.3;
        lookLambda = 2.9;
        fovLambda = 2.4;
      } else if (camFocus.phase === 'TOSS_AIM' || camFocus.phase === 'CLAIM_AIM') {
        if (camFocus.isClaimAim) {
          // Dramatic over-the-shoulder angle for blind House toss
          targetCamX = camFocus.playerWorldX + 1.32;
          targetCamY = 2.18;
          targetCamZ = camFocus.playerWorldZ + 1.48;
          targetLookX = 0.25;
          targetLookY = 0.22;
          targetLookZ = -0.15;
          desiredFov = camFocus.isCharging ? 41.5 : 44;
        } else {
          const chargePull = camFocus.isCharging ? camFocus.aimPower * 0.62 : 0;
          targetCamX = 0.28 - camFocus.aimAngleOffset * 0.45;
          targetCamY = 2.88 - chargePull * 0.48;
          targetCamZ = 5.95 - chargePull * 0.72;
          targetLookX = 0.25 + (camFocus.targetSquareWorldX - 0.25) * 0.45;
          targetLookY = 0.22;
          targetLookZ = camFocus.targetSquareWorldZ * 0.55 + 0.25;
          desiredFov = camFocus.isCharging ? 45 - camFocus.aimPower * 4.5 : 45;
        }
        posLambda = 4.2;
        lookLambda = 4.8;
      } else if (camFocus.phase === 'PICKUP_STONE') {
        targetCamX = camFocus.playerWorldX + 0.95;
        targetCamY = 1.65;
        targetCamZ = camFocus.playerWorldZ + 2.35;
        targetLookX = camFocus.playerWorldX;
        targetLookY = 0.38;
        targetLookZ = camFocus.playerWorldZ;
        desiredFov = 42;
        posLambda = 4.5;
        lookLambda = 5.5;
      } else if (camFocus.phase === 'HOP_BACK' || camFocus.phase === 'HOP_EXIT') {
        targetCamX = 0.28 + (camFocus.playerWorldX - 0.25) * 0.32;
        targetCamY = 2.75;
        targetCamZ = Math.max(4.5, camFocus.playerWorldZ + 3.35);
        targetLookX = camFocus.playerWorldX * 0.45 + 0.14;
        targetLookY = 0.55;
        targetLookZ = camFocus.playerWorldZ * 0.6;
      } else if (camFocus.phase === 'FOUL_RECOVERY') {
        targetCamX = camFocus.playerWorldX + 1.15;
        targetCamY = 1.58;
        targetCamZ = camFocus.playerWorldZ + 2.55;
        targetLookX = camFocus.playerWorldX;
        targetLookY = 0.78;
        targetLookZ = camFocus.playerWorldZ;
        desiredFov = 43;
      }

      if (
        stoneReturnTimer > 0 &&
        camFocus.phase !== 'STONE_FLIGHT' &&
        camFocus.phase !== 'CLAIM_FLIGHT' &&
        camFocus.phase !== 'TOSS_AIM' &&
        camFocus.phase !== 'CLAIM_AIM' &&
        camFocus.phase !== 'PLAYER_SWITCH'
      ) {
        stoneReturnTimer = Math.max(0, stoneReturnTimer - dt);
        const u = 1 - stoneReturnTimer / STONE_RETURN_DURATION;
        const tBlend = THREE.MathUtils.clamp((u - 0.18) / 0.82, 0, 1);
        const ease = tBlend * tBlend * (3 - 2 * tBlend);
        targetCamX = THREE.MathUtils.lerp(lastStoneCamX, targetCamX, ease);
        targetCamY = THREE.MathUtils.lerp(lastStoneCamY, targetCamY, ease);
        targetCamZ = THREE.MathUtils.lerp(lastStoneCamZ, targetCamZ, ease);
        targetLookX = THREE.MathUtils.lerp(lastStoneLookX, targetLookX, ease);
        targetLookY = THREE.MathUtils.lerp(0.08, targetLookY, ease);
        targetLookZ = THREE.MathUtils.lerp(lastStoneLookZ, targetLookZ, ease);
        desiredFov = THREE.MathUtils.lerp(38.5, desiredFov, ease);
        posLambda = THREE.MathUtils.lerp(1.35, 3.1, ease);
        lookLambda = THREE.MathUtils.lerp(1.6, 3.8, ease);
        fovLambda = 2.0;
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, posLambda, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, posLambda, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, posLambda, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLookX, lookLambda, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLookY, lookLambda, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLookZ, lookLambda, dt);
    } else if (curScreen === 'PLAYING' && activePreset === 'aim_target' && !userManualOrbit) {
      // Dedicated close-up Aim View pointing cleanly into the active target square
      const targetCamX = camFocus.playerWorldX - camFocus.aimAngleOffset * 0.55;
      const targetCamY = 2.15;
      const targetCamZ = Math.max(4.65, camFocus.playerWorldZ + 1.92);
      const lookX = camFocus.targetSquareWorldX;
      const lookY = 0.08;
      const lookZ = camFocus.targetSquareWorldZ;
      desiredFov = 40;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 5.2, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 5.2, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 5.2, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, lookX, 6.0, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, lookY, 6.0, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, lookZ, 6.0, dt);
      transitioningCamera = false;
    } else if (curScreen === 'PLAYING' && activePreset === 'top_aim' && !userManualOrbit) {
      // Dedicated near-overhead view so chalk boundaries and squares are crystal clear
      const wp = CAMERA_PRESETS.top_aim;
      desiredFov = 43;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, wp.pos[0], 5.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, wp.pos[1], 5.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, wp.pos[2], 5.5, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, wp.lookAt[0], 6.0, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, wp.lookAt[1], 6.0, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, wp.lookAt[2], 6.0, dt);
      transitioningCamera = false;
    } else if (curScreen === 'GAME_OVER' && !transitioningCamera && !userManualOrbit) {
      // Celebratory front-court framing showcasing the winning character's victory dance on the right side
      desiredFov = 42;
      fovLambda = 2.6;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, -0.22, 2.6, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.64, 2.6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 4.38, 2.6, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, 0.08, 3.2, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, 0.78, 3.2, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, 1.72, 3.2, dt);
    } else if (transitioningCamera) {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 4.8, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 4.8, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 4.8, dt);

      controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredTarget.x, 5.4, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredTarget.y, 5.4, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredTarget.z, 5.4, dt);

      if (
        camera.position.distanceToSquared(_desiredCamPos) < 0.002 &&
        controls.target.distanceToSquared(_desiredTarget) < 0.002
      ) {
        camera.position.copy(_desiredCamPos);
        controls.target.copy(_desiredTarget);
        transitioningCamera = false;
      }
    }

    const nextFov = THREE.MathUtils.damp(camera.fov, desiredFov, fovLambda, dt);
    if (Math.abs(nextFov - camera.fov) > 0.02) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    controls.update();

    const floorY = groundHeightAt(camera.position.x, camera.position.z) + 0.34;
    if (camera.position.y < floorY) {
      camera.position.y = floorY;
    }

    // Subtle foul camera jolt
    const shake = cameraShakeEnabledSetting ? engine.getShakeMag() : 0;
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }

    const renderT0 = performance.now();
    renderer.render(scene, camera);
    lastRenderCpuMs = performance.now() - renderT0;
    syncCalloutOverlay(container.clientWidth, container.clientHeight);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  };

  let lastRenderCpuMs = 0;
  (window as unknown as { __sonkoPerf?: () => unknown }).__sonkoPerf = () => ({
    place: currentWorldPlace,
    pendingLoads: getPendingModelLoadCount(),
    render: {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      frame: renderer.info.render.frame,
    },
    memory: {
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    },
    renderCpuMs: +lastRenderCpuMs.toFixed(2),
    assets: getAssetLoadMetrics(),
  });

  options.onReady?.();
  tick();

  const setPose = (pose: CharacterViewportPose) => {
    glbChars.setPose(pose);
  };

  const setSpeechState = (state: SpeechState) => {
    glbChars.setSpeechState(state);
  };

  let customSurfaceTextures: THREE.Texture[] = [];
  const disposeCustomSurfaceTextures = () => {
    for (const tex of customSurfaceTextures) {
      if (!isSharedResource(tex)) tex.dispose();
    }
    customSurfaceTextures = [];
  };

  const configureRepeatingTexture = (tex: THREE.Texture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = Math.min(4, Math.max(1, maxAniso));
    tex.needsUpdate = true;
    return tex;
  };

  const loadSlotGLBFromUrl = async (
    slot: ModelSlotId,
    url: string,
    appearance?: CharacterAppearance,
    meta?: {
      assetType?: 'model' | 'surface-textures';
      textureSet?: SurfaceTextureSet;
      fileNameHint?: string;
    }
  ): Promise<{ animations: string[]; hasSkeleton: boolean }> => {
    if (slot === 'stone') {
      const gltf = await load3DModelFromUrl(url, meta?.fileNameHint);
      if (disposed) {
        disposeLoadedModel(gltf.scene);
        return { animations: [], hasSkeleton: false };
      }

      const stoneScene = gltf.scene;
      stoneScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(stoneScene);
      const size = box.getSize(new THREE.Vector3());
      const maxSpan = Math.max(0.001, size.x, size.z, size.y);
      const scale = 0.145 / maxSpan;
      stoneScene.scale.multiplyScalar(scale);
      stoneScene.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(stoneScene);
      const center = scaledBox.getCenter(new THREE.Vector3());
      stoneScene.position.set(-center.x, -scaledBox.min.y - 0.004, -center.z);

      const wrapper = new THREE.Group();
      wrapper.add(stoneScene);
      court3D.setCustomStoneModel(wrapper);
      glbChars.setCustomHandStoneModel(wrapper);
      return {
        animations: gltf.animations.map((c) => c.name || 'Clip'),
        hasSkeleton: false,
      };
    }

    if (slot === 'surface') {
      const texLoader = new THREE.TextureLoader();
      const loadTex = async (tUrl: string | undefined, isColor: boolean) => {
        if (!tUrl) return null;
        const t = await texLoader.loadAsync(tUrl);
        configureRepeatingTexture(t, isColor);
        return t;
      };

      if (meta?.assetType === 'surface-textures' && meta.textureSet) {
        const [albedo, normal, roughness, ao] = await Promise.all([
          loadTex(meta.textureSet.albedo, true),
          loadTex(meta.textureSet.normal, false),
          loadTex(meta.textureSet.roughness, false),
          loadTex(meta.textureSet.ao, false),
        ]);
        if (disposed) {
          albedo?.dispose();
          normal?.dispose();
          roughness?.dispose();
          ao?.dispose();
          return { animations: [], hasSkeleton: false };
        }
        disposeCustomSurfaceTextures();
        const nextList: THREE.Texture[] = [];
        for (const t of [albedo, normal, roughness, ao]) {
          if (t) nextList.push(t);
        }
        customSurfaceTextures = nextList;
        applyCompoundTerrainSurface(terrainGroup, { albedo, normal, roughness, ao });
        return { animations: [], hasSkeleton: false };
      }

      // .glb / .gltf / .usdz surface asset: extract PBR maps onto MurramCourtyardGround
      const gltf = await load3DModelFromUrl(url, meta?.fileNameHint);
      if (disposed) {
        disposeLoadedModel(gltf.scene);
        return { animations: [], hasSkeleton: false };
      }

      const extracted: CustomTerrainMaps = {};
      gltf.scene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const m = (child as THREE.Mesh).material;
        const mat = Array.isArray(m) ? m[0] : m;
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (!extracted.albedo && mat.map) extracted.albedo = configureRepeatingTexture(mat.map, true);
          if (!extracted.normal && mat.normalMap) extracted.normal = configureRepeatingTexture(mat.normalMap, false);
          if (!extracted.roughness && mat.roughnessMap) extracted.roughness = configureRepeatingTexture(mat.roughnessMap, false);
          if (!extracted.ao && mat.aoMap) extracted.ao = configureRepeatingTexture(mat.aoMap, false);
        }
      });

      disposeCustomSurfaceTextures();
      customSurfaceTextures = [extracted.albedo, extracted.normal, extracted.roughness, extracted.ao].filter(
        (t): t is THREE.Texture => Boolean(t)
      );
      if (customSurfaceTextures.length > 0) {
        applyCompoundTerrainSurface(terrainGroup, extracted);
      }
      return { animations: [], hasSkeleton: false };
    }

    if (appearance) {
      slotSavedAppearances.set(slot, appearance);
    }
    const custom = slot === 'kato' ? player0CustomColors : undefined;
    return glbChars.loadSlotFromUrl(slot, url, appearance, custom, meta?.fileNameHint);
  };

  const updateSlotAppearance = (slot: ModelSlotId, appearance: CharacterAppearance) => {
    slotSavedAppearances.set(slot, appearance);
    if (slot !== 'prop' && slot !== 'stone' && slot !== 'surface' && glbChars.isUsingBuiltIn(slot)) {
      writeBuiltInAppearance(slot, appearance);
    }
    if (slot === 'kato' && appearance.outfitStyle !== 'original') {
      // Allow Studio's fabric preset to take precedence when chosen explicitly
      player0CustomColors = undefined;
    }
    const custom = slot === 'kato' ? player0CustomColors : undefined;
    glbChars.updateAppearance(slot, appearance, custom);
  };

  const clearSlotGLB = (slot: ModelSlotId) => {
    if (slot === 'stone') {
      court3D.setCustomStoneModel(null);
      glbChars.setCustomHandStoneModel(null);
      return;
    }
    if (slot === 'surface') {
      disposeCustomSurfaceTextures();
      applyCompoundTerrainSurface(terrainGroup, null);
      return;
    }
    slotSavedAppearances.delete(slot);
    if (slot !== 'prop') {
      clearBuiltInAppearance(slot);
    }
    glbChars.clearSlot(slot, true);
    if (slot === 'kato' && player0CustomColors) {
      glbChars.updateAppearance(
        'kato',
        { skinTone: 'original', outfitStyle: 'original', shoeStyle: 'original' },
        player0CustomColors
      );
    }
  };

  const updateCosmetics = (cosmetics: EngineCosmetics) => {
    if (cosmetics.previewPeriod) {
      daylightOverride = cosmetics.previewPeriod;
    }
    if (cosmetics.weatherMode) {
      weatherMode = cosmetics.weatherMode;
    }
    engine.updateCosmetics(cosmetics);
    glbChars.updateHandStoneSpec(getStoneSpec(cosmetics.equippedStone));

    if (
      cosmetics.avatar.primaryColor !== lastAppliedAvatarPrimary ||
      cosmetics.avatar.accentColor !== lastAppliedAvatarAccent
    ) {
      lastAppliedAvatarPrimary = cosmetics.avatar.primaryColor;
      lastAppliedAvatarAccent = cosmetics.avatar.accentColor;
      player0CustomColors = {
        primaryColor: cosmetics.avatar.primaryColor,
        accentColor: cosmetics.avatar.accentColor,
      };
      const katoApp = slotSavedAppearances.get('kato') ?? {
        skinTone: 'original',
        outfitStyle: 'original',
        shoeStyle: 'original',
      };
      glbChars.updateAppearance('kato', katoApp, player0CustomColors);
    }

    const nextPlace: WorldPlaceId = cosmetics.previewPlace ?? 'kampala_compound';
    if (nextPlace !== currentWorldPlace) {
      currentWorldPlace = nextPlace;
      skipArrivalSequence();
      syncPlaceVisuals(nextPlace);
      applyTerrainWeatherWetness(terrainGroup, smoothedWetness);
    }

    syncVenueAtmosphere();
  };

  const hydratedBlobUrls: string[] = [];

  // Hydrate curated Blender GLB / glTF / ZIP models from server manifest AND IndexedDB fallback
  void (async () => {
    const loadedSlots = new Set<string>();
    try {
      const res = await fetch('/api/models');
      if (res.ok && !disposed) {
        const data = (await res.json()) as {
          slots?: Partial<
            Record<
              ModelSlotId,
              {
                url?: string;
                originalName?: string;
                fileExists?: boolean;
                appearance?: CharacterAppearance;
                assetType?: 'model' | 'surface-textures';
                textureSet?: SurfaceTextureSet;
              }
            >
          >;
        };
        if (data.slots && !disposed) {
          for (const [slotKey, entry] of Object.entries(data.slots)) {
            if (entry?.url && entry.fileExists !== false) {
              try {
                await loadSlotGLBFromUrl(slotKey as ModelSlotId, entry.url, entry.appearance, {
                  assetType: entry.assetType,
                  textureSet: entry.textureSet,
                  fileNameHint: entry.originalName,
                });
                loadedSlots.add(slotKey);
              } catch {
                // Keep built-in character intact if custom file cannot be parsed
              }
            }
          }
        }
      }
    } catch {
      // Optional server hydration
    }

    if (disposed) return;

    try {
      const idbSlots = await getAllPersistedSlotsFromIDB();
      for (const rec of idbSlots) {
        if (disposed) break;
        if (loadedSlots.has(rec.slot)) continue;
        try {
          if (rec.sourceKind === 'upload-blob' && rec.blob) {
            const objUrl = URL.createObjectURL(rec.blob);
            hydratedBlobUrls.push(objUrl);
            await loadSlotGLBFromUrl(rec.slot, objUrl, rec.appearance, {
              assetType: rec.assetType,
              fileNameHint: rec.originalName || rec.fileName,
            });
            loadedSlots.add(rec.slot);
          } else if (rec.sourceKind === 'asset-ref' && rec.assetUrl) {
            await loadSlotGLBFromUrl(rec.slot, rec.assetUrl, rec.appearance, {
              assetType: rec.assetType,
              textureSet: rec.textureSet,
              fileNameHint: rec.originalName || rec.fileName,
            });
            loadedSlots.add(rec.slot);
          }
        } catch {
          // Keep built-in character intact on error
        }
      }
    } catch {
      // Optional IDB hydration
    }
  })();

  const exportGLB = () =>
    new Promise<Blob>((resolve, reject) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        worldGroup,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(new Blob([result], { type: 'model/gltf-binary' }));
          } else {
            resolve(new Blob([JSON.stringify(result)], { type: 'application/json' }));
          }
        },
        (err) => reject(err),
        { binary: true }
      );
    });

  const dispose = () => {
    disposed = true;
    delete (window as unknown as { __sonkoPerf?: unknown }).__sonkoPerf;
    for (const u of hydratedBlobUrls) {
      URL.revokeObjectURL(u);
    }
    hydratedBlobUrls.length = 0;
    cancelAnimationFrame(frameId);
    window.clearTimeout(frameId);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onWindowBlur);
    resizeObserver.disconnect();
    engine.dispose();
    court3D.dispose();
    glbChars.dispose();
    archGroup.userData.__disposed = true;
    const archExtraTex = archGroup.userData.__extraTextures as THREE.Texture[] | undefined;
    if (archExtraTex) {
      for (const t of archExtraTex) t.dispose();
    }
    pineForest.dispose();
    compoundProps.dispose();
    distantWorld.dispose();
    worldEnvs.dispose();
    (terrainGroup.userData.__stonePlazaTex as THREE.Texture | undefined)?.dispose();
    disposeCustomSurfaceTextures();
    controls.dispose();
    envTex.dispose();
    textures.disposeAll();

    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
          (mesh as THREE.InstancedMesh).dispose();
        }
        if (mesh.userData.__persistentShared) return;
        if (mesh.geometry && !isSharedResource(mesh.geometry)) {
          mesh.geometry.dispose();
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m && !isSharedResource(m)) m.dispose();
        }
      }
    });
    moteGeo.dispose();
    moteMat.dispose();
    mistGeo.dispose();
    mistMat.dispose();
    mistSpriteTex.dispose();
    calloutNodes.clear();
    speechNodes.clear();
    calloutHost.remove();

    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    engine,
    setCameraPreset,
    setDaylight,
    setWeatherMode,
    setPose,
    setSpeechState,
    applyGraphicsSettings,
    updateCosmetics,
    setGameCallbacks: (onHud, onComplete) => engine.setCallbacks(onHud, onComplete),
    exportGLB,
    loadSlotGLBFromUrl,
    updateSlotAppearance,
    clearSlotGLB,
    triggerArrivalSequence,
    skipArrivalSequence,
    isArrivalPlaying: () => worldEnvs.isArrivalPlaying(),
    dispose,
  };
}
