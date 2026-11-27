import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Copy,
  Download,
  Music,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Upload,
} from 'lucide-react';
import { AssetLibraryFile, AssetManager } from './AssetManager';
import {
  getAllPersistedSlotsFromIDB,
  readBuiltInAppearances,
  removeSlotFromIDB,
  saveSlotToIDB,
  updateSlotAppearanceInIDB,
} from '../game/modelPersistence';
import { OnlineRoomState } from '../game/onlineClient';
import { AvatarCustomization, WorldPlaceId } from '../game/progression';
import { sonkoVoice } from '../game/voiceEngine';
import { ChildStyle } from '../scene3d/characters';
import {
  CourtSize,
  CourtVenueId,
  Difficulty,
  GameScreen,
  HudSnapshot,
  MatchRewardSummary,
  OutfitId,
  PlayerState,
  PlayMode,
  SpeechState,
  StencilId,
  StoneId,
  WeatherMode,
} from '../game/types';
import { WEATHER_MODE_OPTIONS } from '../game/weather';
import {
  CharacterAppearance,
  DEFAULT_APPEARANCE,
  OUTFIT_STYLE_OPTIONS,
  OutfitStylePreset,
  SHOE_STYLE_OPTIONS,
  ShoeStylePreset,
  SKIN_TONE_OPTIONS,
  SkinTonePreset,
} from '../scene3d/glbAppearance';
import {
  CharacterViewportPose,
  CompoundCameraPreset,
  DaylightPreset,
  GraphicsSettingsPayload,
  ModelSlotId,
  mountUgandanCompoundScene,
  SurfaceTextureSet,
  UgandanCompoundController,
} from '../scene3d/ugandanCompoundScene';

export type { CharacterViewportPose, CompoundCameraPreset, DaylightPreset, SpeechState };

export interface UgandanCompoundHandle {
  startGame: (mode: PlayMode, difficulty: Difficulty, courtSize: CourtSize, venue?: CourtVenueId) => void;
  startOnlineGame: (room: OnlineRoomState, localSlot: 0 | 1) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  returnToTitle: () => void;
  nudgeBalance: (dir: -1 | 1) => void;
  triggerAction: () => void;
  setCameraPreset: (preset: CompoundCameraPreset) => void;
  setPose: (pose: CharacterViewportPose) => void;
  setSpeechState: (state: SpeechState) => void;
  openCreatorStudio: () => void;
  playArrivalSequence: () => boolean;
  skipArrivalSequence: () => void;
}

interface UgandanCompoundViewportProps {
  screen: GameScreen;
  pose?: CharacterViewportPose;
  onPoseChange?: (pose: CharacterViewportPose) => void;
  speechState?: SpeechState;
  onSpeechStateChange?: (state: SpeechState) => void;
  cameraPreset?: CompoundCameraPreset;
  onCameraPresetChange?: (preset: CompoundCameraPreset) => void;
  daylight?: DaylightPreset;
  onDaylightChange?: (preset: DaylightPreset) => void;
  weatherMode?: WeatherMode;
  onWeatherModeChange?: (mode: WeatherMode) => void;
  graphicsSettings?: GraphicsSettingsPayload;
  onStudioAvailabilityChange?: (available: boolean) => void;
  onArrivalPlayingChange?: (playing: boolean) => void;
  equippedStone: StoneId;
  equippedOutfit: OutfitId;
  equippedStencil: StencilId;
  avatar: AvatarCustomization;
  previewVenue: CourtVenueId;
  previewPlace?: WorldPlaceId;
  previewCourtSize: CourtSize;
  onHudChange: (snapshot: HudSnapshot) => void;
  onMatchComplete?: (
    reward: MatchRewardSummary,
    won: boolean,
    humanStats: PlayerState,
    venue: CourtVenueId,
    meta?: { mode: PlayMode; difficulty: Difficulty }
  ) => void;
}

interface StoredModelEntry {
  slot: string;
  originalName: string;
  url: string;
  bytes: number;
  fileExists?: boolean;
  assetType?: 'model' | 'surface-textures';
  textureSet?: SurfaceTextureSet;
  appearance?: CharacterAppearance;
}

const CAMERA_OPTIONS: Array<{ id: CompoundCameraPreset; label: string }> = [
  { id: 'lobby_home', label: 'Lobby Hero' },
  { id: 'play', label: 'Dynamic' },
  { id: 'aim_target', label: 'Aim Focus' },
  { id: 'top_aim', label: 'Top-Down' },
  { id: 'characters', label: 'Characters' },
  { id: 'courtyard', label: 'Courtyard' },
  { id: 'ground_low', label: 'Ground Low' },
  { id: 'veranda', label: 'Veranda' },
  { id: 'overhead', label: 'Overhead' },
];

const DAYLIGHT_OPTIONS: Array<{ id: DaylightPreset; label: string }> = [
  { id: 'auto', label: 'Venue Auto' },
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'golden', label: 'Golden Hour' },
  { id: 'night', label: 'Night' },
];

const SLOT_OPTIONS: Array<{ id: ModelSlotId; label: string }> = [
  { id: 'kato', label: 'Kato (P1)' },
  { id: 'namukasa', label: 'Namukasa (Rival)' },
  { id: 'ssemakula', label: 'Ssemakula (P3)' },
  { id: 'auma', label: 'Auma (P4)' },
  { id: 'stone', label: 'Stone (Ejjinja)' },
  { id: 'surface', label: 'Courtyard Surface' },
  { id: 'prop', label: 'Courtyard Prop' },
];

const POSE_OPTIONS: Array<{ id: CharacterViewportPose; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'hopping', label: 'Hopping' },
  { id: 'balancing', label: 'Balancing' },
  { id: 'landing', label: 'Landing' },
  { id: 'victory', label: 'Victory' },
];

const SPEECH_OPTIONS: Array<{ id: SpeechState; label: string }> = [
  { id: 'silent', label: 'Silent' },
  { id: 'aiming', label: 'Aiming' },
  { id: 'throwing', label: 'Throwing' },
  { id: 'cheering', label: 'Cheering' },
  { id: 'laughing', label: 'Laughing' },
  { id: 'annoyed', label: 'Annoyed' },
  { id: 'banter', label: 'Banter' },
];

export const UgandanCompoundViewport = forwardRef<UgandanCompoundHandle, UgandanCompoundViewportProps>(
  function UgandanCompoundViewport(
    {
      screen,
      pose = 'idle',
      onPoseChange,
      speechState = 'silent',
      onSpeechStateChange,
      cameraPreset: cameraPresetProp,
      onCameraPresetChange,
      daylight: daylightProp,
      onDaylightChange,
      weatherMode: weatherModeProp,
      onWeatherModeChange,
      graphicsSettings,
      onStudioAvailabilityChange,
      onArrivalPlayingChange,
      equippedStone,
      equippedOutfit,
      equippedStencil,
      avatar,
      previewVenue,
      previewPlace = 'kampala_compound',
      previewCourtSize,
      onHudChange,
      onMatchComplete,
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const controllerRef = useRef<UgandanCompoundController | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const voiceFileInputRef = useRef<HTMLInputElement | null>(null);

    const onHudChangeRef = useRef(onHudChange);
    onHudChangeRef.current = onHudChange;
    const onMatchCompleteRef = useRef(onMatchComplete);
    onMatchCompleteRef.current = onMatchComplete;
    const onStudioAvailabilityChangeRef = useRef(onStudioAvailabilityChange);
    onStudioAvailabilityChangeRef.current = onStudioAvailabilityChange;
    const onArrivalPlayingChangeRef = useRef(onArrivalPlayingChange);
    onArrivalPlayingChangeRef.current = onArrivalPlayingChange;
    const previewPlaceRef = useRef(previewPlace);
    previewPlaceRef.current = previewPlace;

    const [cameraPreset, setCameraPreset] = useState<CompoundCameraPreset>(
      cameraPresetProp ?? 'lobby_home'
    );
    const [daylight, setDaylight] = useState<DaylightPreset>(daylightProp ?? 'auto');
    const [weatherMode, setWeatherMode] = useState<WeatherMode>(weatherModeProp ?? 'auto');
    const [activePose, setActivePose] = useState<CharacterViewportPose>(pose);
    const [activeSpeech, setActiveSpeech] = useState<SpeechState>(speechState);
    const [dockCollapsed, setDockCollapsed] = useState(true);
    const [arrivalPlaying, setArrivalPlaying] = useState(false);

    // Creator Studio & Asset Manager mode (also openable via ?studio=1, Shift+U, or View bar button)
    const [studioOpen, setStudioOpen] = useState<boolean>(() => {
      if (typeof window === 'undefined') return false;
      return new URLSearchParams(window.location.search).get('studio') === '1';
    });
    const [studioAvailable, setStudioAvailable] = useState(false);
    const [requiresKey, setRequiresKey] = useState(false);
    const [studioKey, setStudioKey] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<ModelSlotId>('kato');
    const [duplicateTarget, setDuplicateTarget] = useState<ModelSlotId>('namukasa');
    const [savedSlots, setSavedSlots] = useState<Partial<Record<ModelSlotId, StoredModelEntry>>>({});
    const [builtInAppearances, setBuiltInAppearances] = useState<
      Partial<Record<ChildStyle, CharacterAppearance>>
    >(() => readBuiltInAppearances());
    const [exporting, setExporting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [studioNotice, setStudioNotice] = useState<string | null>(null);

    // World Assets Folder Library State
    const [assetFolders, setAssetFolders] = useState<string[]>([]);
    const [defaultAssetFolders, setDefaultAssetFolders] = useState<string[]>([]);
    const [assetFiles, setAssetFiles] = useState<AssetLibraryFile[]>([]);

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;
      const ctrl = mountUgandanCompoundScene(el, {
        initialCosmetics: {
          equippedStone,
          equippedOutfit,
          equippedStencil,
          avatar,
          previewVenue,
          previewPlace,
          previewCourtSize,
          previewPeriod: daylightProp ?? 'auto',
          weatherMode: weatherModeProp ?? 'auto',
        },
        initialGraphics: graphicsSettings,
        onHudChange: (snap) => onHudChangeRef.current(snap),
        onMatchComplete: (reward, won, stats, venue, meta) =>
          onMatchCompleteRef.current?.(reward, won, stats, venue, meta),
        onArrivalStateChange: (playing) => {
          setArrivalPlaying(playing);
          onArrivalPlayingChangeRef.current?.(playing);
        },
      });
      if (daylightProp && daylightProp !== 'auto') {
        ctrl.setDaylight(daylightProp);
      }
      controllerRef.current = ctrl;
      return () => {
        controllerRef.current = null;
        ctrl.dispose();
      };
      // Mount once on startup
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live sync progression cosmetics & preview court/venue/place to the 3D world
    useEffect(() => {
      controllerRef.current?.updateCosmetics({
        equippedStone,
        equippedOutfit,
        equippedStencil,
        avatar,
        previewVenue,
        previewPlace,
        previewCourtSize,
        previewPeriod: daylightProp ?? 'auto',
        weatherMode: weatherModeProp ?? 'auto',
      });
    }, [
      equippedStone,
      equippedOutfit,
      equippedStencil,
      avatar,
      previewVenue,
      previewPlace,
      previewCourtSize,
      daylightProp,
      weatherModeProp,
    ]);

    // Collapse dock automatically when entering active match so HUD stays unobstructed
    useEffect(() => {
      if (screen === 'PLAYING') {
        setDockCollapsed(true);
        setCameraPreset(cameraPresetProp ?? 'play');
      } else if (screen === 'TITLE_MENU') {
        setCameraPreset(cameraPresetProp ?? 'lobby_home');
      }
    }, [screen, cameraPresetProp]);

    // Sync external cameraPreset prop to the 3D scene controller
    useEffect(() => {
      if (!cameraPresetProp) return;
      setCameraPreset(cameraPresetProp);
      controllerRef.current?.setCameraPreset(cameraPresetProp);
    }, [cameraPresetProp]);

    // Sync external daylight period prop to the 3D scene controller
    useEffect(() => {
      if (!daylightProp) return;
      setDaylight(daylightProp);
      controllerRef.current?.setDaylight(daylightProp);
    }, [daylightProp]);

    // Sync external weather mode prop to the 3D scene controller
    useEffect(() => {
      if (!weatherModeProp) return;
      setWeatherMode(weatherModeProp);
      controllerRef.current?.setWeatherMode(weatherModeProp, false);
    }, [weatherModeProp]);

    // Sync graphics & performance settings live to the 3D renderer
    useEffect(() => {
      if (!graphicsSettings) return;
      controllerRef.current?.applyGraphicsSettings(graphicsSettings);
    }, [graphicsSettings]);

    // Sync external pose & speechState props to the 3D animation controller
    useEffect(() => {
      setActivePose(pose);
      controllerRef.current?.setPose(pose);
    }, [pose]);

    useEffect(() => {
      setActiveSpeech(speechState);
      controllerRef.current?.setSpeechState(speechState);
    }, [speechState]);

    useImperativeHandle(ref, () => ({
      startGame: (mode, difficulty, courtSize, venue) => {
        controllerRef.current?.engine.startGame(mode, difficulty, courtSize, venue, {
          period: daylightProp ?? daylight,
          weatherMode: weatherModeProp ?? weatherMode,
        });
      },
      startOnlineGame: (room, localSlot) => {
        controllerRef.current?.engine.startOnlineGame(room, localSlot);
      },
      pauseGame: () => {
        controllerRef.current?.engine.pauseGame();
      },
      resumeGame: () => {
        controllerRef.current?.engine.resumeGame();
      },
      restartGame: () => {
        controllerRef.current?.engine.restartGame();
      },
      returnToTitle: () => {
        controllerRef.current?.skipArrivalSequence();
        controllerRef.current?.engine.returnToTitle();
      },
      nudgeBalance: (dir) => {
        controllerRef.current?.engine.nudgeBalance(dir);
      },
      triggerAction: () => {
        controllerRef.current?.engine.triggerAction();
      },
      setCameraPreset: (preset) => {
        setCameraPreset(preset);
        controllerRef.current?.setCameraPreset(preset);
        onCameraPresetChange?.(preset);
      },
      setPose: (nextPose) => {
        setActivePose(nextPose);
        controllerRef.current?.setPose(nextPose);
      },
      setSpeechState: (nextSpeech) => {
        setActiveSpeech(nextSpeech);
        controllerRef.current?.setSpeechState(nextSpeech);
      },
      openCreatorStudio: () => {
        setDockCollapsed(false);
        setStudioOpen(true);
      },
      playArrivalSequence: () => controllerRef.current?.triggerArrivalSequence() ?? false,
      skipArrivalSequence: () => controllerRef.current?.skipArrivalSequence(),
    }));

    // Fetch studio availability, curated GLB slot metadata, IDB backup slots & organized /public/assets library
    useEffect(() => {
      let active = true;
      void (async () => {
        let mergedSlots: Partial<Record<ModelSlotId, StoredModelEntry>> = {};
        let isStudioReady = false;
        let needsKey = false;

        try {
          const [modelsRes, assetsRes] = await Promise.all([
            fetch('/api/models'),
            fetch('/api/assets'),
          ]);
          if (modelsRes.ok && active) {
            const data = (await modelsRes.json()) as {
              slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
              studioUploadAvailable?: boolean;
              requiresKey?: boolean;
            };
            isStudioReady = Boolean(data.studioUploadAvailable);
            needsKey = Boolean(data.requiresKey);
            mergedSlots = { ...(data.slots ?? {}) };
            setStudioAvailable(isStudioReady);
            onStudioAvailabilityChangeRef.current?.(isStudioReady);
            setRequiresKey(needsKey);
            if (new URLSearchParams(window.location.search).get('studio') === '1') {
              setDockCollapsed(false);
            }
          }
          if (assetsRes.ok && active) {
            const aData = (await assetsRes.json()) as {
              folders?: string[];
              defaultFolders?: string[];
              files?: AssetLibraryFile[];
            };
            if (aData.folders) setAssetFolders(aData.folders);
            if (aData.defaultFolders) setDefaultAssetFolders(aData.defaultFolders);
            if (aData.files) setAssetFiles(aData.files);
          }
        } catch {
          // Ignore network fetch errors offline
        }

        try {
          const idbRecords = await getAllPersistedSlotsFromIDB();
          if (!active) return;
          for (const rec of idbRecords) {
            const existing = mergedSlots[rec.slot];
            if (!existing || existing.fileExists === false) {
              mergedSlots[rec.slot] = {
                slot: rec.slot,
                originalName: rec.originalName || rec.fileName,
                url: rec.assetUrl ?? `idb://${rec.slot}`,
                bytes: rec.bytes,
                fileExists: true,
                assetType: rec.assetType,
                textureSet: rec.textureSet,
                appearance: rec.appearance,
              };

              // Re-sync local IDB binary blob back to server disk if studio upload is unlocked
              if (rec.sourceKind === 'upload-blob' && rec.blob && isStudioReady && !needsKey) {
                void (async () => {
                  try {
                    const buf = await rec.blob!.arrayBuffer();
                    const res = await fetch(`/api/models/${rec.slot}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/octet-stream',
                        'x-studio-intent': 'sonko-creator',
                        'x-file-name': rec.originalName || rec.fileName,
                      },
                      body: buf,
                    });
                    if (res.ok && active) {
                      const payload = (await res.json()) as {
                        slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
                      };
                      if (payload.slots) {
                        setSavedSlots((prev) => ({ ...prev, ...payload.slots }));
                      }
                    }
                  } catch {
                    // Best-effort server re-sync
                  }
                })();
              }
            }
          }
        } catch {
          // Ignore IDB read errors
        }

        if (active) {
          setSavedSlots(mergedSlots);
        }
      })();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key.toLowerCase() === 'h' && !e.shiftKey) {
          setDockCollapsed((prev) => !prev);
        } else if (e.key.toLowerCase() === 'u' && e.shiftKey && studioAvailable) {
          setStudioOpen((prev) => !prev);
          setDockCollapsed(false);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [studioAvailable]);

    const handleSelectCamera = (preset: CompoundCameraPreset) => {
      setCameraPreset(preset);
      controllerRef.current?.setCameraPreset(preset);
      onCameraPresetChange?.(preset);
    };

    const handleSelectDaylight = (preset: DaylightPreset) => {
      setDaylight(preset);
      controllerRef.current?.setDaylight(preset);
      onDaylightChange?.(preset);
    };

    const handleSelectWeatherMode = (nextMode: WeatherMode) => {
      setWeatherMode(nextMode);
      controllerRef.current?.setWeatherMode(nextMode, nextMode === 'random');
      onWeatherModeChange?.(nextMode);
    };

    const handleSelectSpeech = (nextSpeech: SpeechState) => {
      setActiveSpeech(nextSpeech);
      controllerRef.current?.setSpeechState(nextSpeech);
      onSpeechStateChange?.(nextSpeech);
      if (screen === 'TITLE_MENU') {
        sonkoVoice.triggerSpeechState('kato', nextSpeech, { priority: 'high' });
      }
    };

    const handleExportGLB = async () => {
      if (!controllerRef.current || exporting) return;
      setExporting(true);
      setStudioNotice(null);
      try {
        const blob = await controllerRef.current.exportGLB();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sonko_ugandan_compound.glb';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStudioNotice('Exported sonko_ugandan_compound.glb for Blender.');
      } catch {
        setStudioNotice('Could not export GLB.');
      } finally {
        setExporting(false);
      }
    };

    const handleSelectPose = (nextPose: CharacterViewportPose) => {
      setActivePose(nextPose);
      controllerRef.current?.setPose(nextPose);
      onPoseChange?.(nextPose);
    };

    const handleUploadSlotGLB = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !controllerRef.current || uploading) return;

      const lower = file.name.toLowerCase();
      const validModel =
        /\.(glb|gltf|usdz|usd|usda|usdc|zip)$/i.test(lower);
      const validSurfaceImg = selectedSlot === 'surface' && /\.(png|jpg|jpeg|webp)$/i.test(lower);

      if (!validModel && !validSurfaceImg) {
        setStudioNotice(
          selectedSlot === 'surface'
            ? 'Upload a .zip (with PBR maps or .glb/.gltf/.usdz), .glb, .gltf, .usdz, or .png/.jpg texture.'
            : 'Please upload a .glb, .gltf, .usdz, or .zip model archive.'
        );
        return;
      }

      setUploading(true);
      setStudioNotice(null);
      try {
        const buf = await file.arrayBuffer();
        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'x-studio-intent': 'sonko-creator',
          'x-file-name': file.name,
        };
        if (studioKey.trim()) {
          headers['x-studio-key'] = studioKey.trim();
        }

        let persistedOnServer = false;
        let loadUrl = '';
        let entryAppearance = savedSlots[selectedSlot]?.appearance;
        let entryAssetType: 'model' | 'surface-textures' | undefined;
        let entryTextureSet: SurfaceTextureSet | undefined;

        try {
          const res = await fetch(`/api/models/${selectedSlot}`, {
            method: 'POST',
            headers,
            body: buf,
          });
          const payload = (await res.json()) as {
            ok?: boolean;
            error?: string;
            entry?: StoredModelEntry;
            slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
          };

          if (res.ok && payload.entry) {
            persistedOnServer = true;
            loadUrl = payload.entry.url;
            entryAppearance = payload.entry.appearance;
            entryAssetType = payload.entry.assetType;
            entryTextureSet = payload.entry.textureSet;
            const updatedSlots = { ...(payload.slots ?? {}) };
            if (updatedSlots[selectedSlot]) {
              updatedSlots[selectedSlot] = { ...updatedSlots[selectedSlot]!, fileExists: true };
            }
            setSavedSlots(updatedSlots);
          } else if (res.status !== 403 && !/zip/i.test(lower)) {
            setStudioNotice(payload.error ?? 'Upload failed.');
            return;
          }
        } catch {
          // Offline / read-only fallback below
        }

        const isZipArchive = /\.zip$/i.test(lower);
        if (!persistedOnServer && isZipArchive) {
          setStudioNotice('ZIP packages require Creator Studio server upload access.');
          return;
        }

        // Persist binary blob in IndexedDB so slot survives reloads even without server disk
        const isSurfaceImage = selectedSlot === 'surface' && /\.(png|jpg|jpeg|webp)$/i.test(lower);
        const idbAssetType: 'model' | 'surface-textures' =
          entryAssetType ?? (isSurfaceImage ? 'surface-textures' : 'model');

        await saveSlotToIDB({
          slot: selectedSlot,
          fileName: file.name,
          originalName: file.name,
          sourceKind: 'upload-blob',
          blob: file,
          assetType: idbAssetType,
          appearance: entryAppearance,
          bytes: file.size,
          updatedAt: new Date().toISOString(),
        });

        let localObjectUrl: string | null = null;
        if (!persistedOnServer) {
          localObjectUrl = URL.createObjectURL(file);
          loadUrl = localObjectUrl;
          if (isSurfaceImage) {
            entryTextureSet = { albedo: localObjectUrl };
          }
          setSavedSlots((prev) => ({
            ...prev,
            [selectedSlot]: {
              slot: selectedSlot,
              originalName: file.name,
              url: `idb://${selectedSlot}`,
              bytes: file.size,
              fileExists: true,
              assetType: idbAssetType,
              appearance: entryAppearance,
            },
          }));
        }

        try {
          const { animations, hasSkeleton } = await controllerRef.current.loadSlotGLBFromUrl(
            selectedSlot,
            loadUrl,
            entryAppearance,
            {
              assetType: idbAssetType,
              textureSet: entryTextureSet,
              fileNameHint: file.name,
            }
          );
          if (selectedSlot === 'stone') {
            setStudioNotice(`Loaded & persisted river stone "${file.name}".`);
          } else if (selectedSlot === 'surface') {
            setStudioNotice(`Applied & persisted courtyard surface "${file.name}".`);
          } else {
            const rigMsg = hasSkeleton ? ' · skeleton rigged' : ' · rigid mesh';
            const animMsg = animations.length > 0 ? ` · clip "${animations[0]}"` : '';
            const scopeMsg = persistedOnServer ? '' : ' (browser-persisted)';
            setStudioNotice(`Loaded ${file.name} into "${selectedSlot}"${rigMsg}${animMsg}${scopeMsg}.`);
          }
        } finally {
          if (localObjectUrl && !isSurfaceImage) {
            // Keep brief lifetime for GLTF internal fetches, then safely handled on reload
            window.setTimeout(() => URL.revokeObjectURL(localObjectUrl!), 30000);
          }
        }
      } catch {
        setStudioNotice('Could not save or parse the uploaded asset.');
      } finally {
        setUploading(false);
      }
    };

    const handleDuplicateSlot = async () => {
      if (!controllerRef.current || uploading || duplicateTarget === selectedSlot) return;
      setUploading(true);
      setStudioNotice(null);
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-studio-intent': 'sonko-creator',
        };
        if (studioKey.trim()) {
          headers['x-studio-key'] = studioKey.trim();
        }
        const res = await fetch(`/api/models/${duplicateTarget}/duplicate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ sourceSlot: selectedSlot }),
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          entry?: StoredModelEntry;
          slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
        };
        if (!res.ok || !payload.entry) {
          setStudioNotice(payload.error ?? 'Could not duplicate slot.');
          return;
        }
        const updatedSlots = { ...(payload.slots ?? {}) };
        if (updatedSlots[duplicateTarget]) {
          updatedSlots[duplicateTarget] = { ...updatedSlots[duplicateTarget]!, fileExists: true };
        }
        setSavedSlots(updatedSlots);

        try {
          const blobRes = await fetch(payload.entry.url);
          if (blobRes.ok) {
            const blob = await blobRes.blob();
            await saveSlotToIDB({
              slot: duplicateTarget,
              fileName: payload.entry.originalName || `${duplicateTarget}.glb`,
              originalName: payload.entry.originalName,
              sourceKind: 'upload-blob',
              blob,
              assetType: payload.entry.assetType,
              appearance: payload.entry.appearance,
              bytes: blob.size,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Non-fatal IDB mirror
        }

        await controllerRef.current.loadSlotGLBFromUrl(
          duplicateTarget,
          payload.entry.url,
          payload.entry.appearance,
          {
            assetType: payload.entry.assetType,
            textureSet: payload.entry.textureSet,
            fileNameHint: payload.entry.originalName,
          }
        );
        setStudioNotice(`Duplicated "${selectedSlot}" model into "${duplicateTarget}".`);
      } catch {
        setStudioNotice('Failed to duplicate model.');
      } finally {
        setUploading(false);
      }
    };

    const handleUploadVoiceClip = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || uploading) return;
      if (!/\.(mp3|ogg|wav|m4a|webm)$/i.test(file.name)) {
        setStudioNotice('Voice clips must be .mp3, .ogg, .wav, .m4a, or .webm.');
        return;
      }
      setUploading(true);
      setStudioNotice(null);
      try {
        const buf = await file.arrayBuffer();
        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'x-studio-intent': 'sonko-creator',
          'x-file-name': file.name,
        };
        if (studioKey.trim()) headers['x-studio-key'] = studioKey.trim();
        const res = await fetch('/api/voices/upload', {
          method: 'POST',
          headers,
          body: buf,
        });
        const payload = (await res.json()) as { ok?: boolean; fileName?: string; error?: string };
        if (!res.ok) {
          setStudioNotice(payload.error ?? 'Voice upload failed.');
          return;
        }
        setStudioNotice(
          `Saved "${payload.fileName}" in /public/audio/voices/. Link it in a .txt script via: "Line | ${payload.fileName}"`
        );
      } catch {
        setStudioNotice('Could not upload voice clip.');
      } finally {
        setUploading(false);
      }
    };

    const handleAppearanceChange = async (patch: Partial<CharacterAppearance>) => {
      if (selectedSlot === 'prop' || selectedSlot === 'stone' || selectedSlot === 'surface') return;
      const currentEntry = savedSlots[selectedSlot];
      const hasCustomSlot = Boolean(currentEntry && currentEntry.fileExists !== false);
      const currentApp: CharacterAppearance =
        (hasCustomSlot ? currentEntry?.appearance : builtInAppearances[selectedSlot]) ?? {
          ...DEFAULT_APPEARANCE,
          skinTone: selectedSlot === 'ssemakula' ? 'chestnut' : 'original',
        };
      const nextApp: CharacterAppearance = { ...currentApp, ...patch };

      controllerRef.current?.updateSlotAppearance(selectedSlot, nextApp);

      if (!hasCustomSlot) {
        setBuiltInAppearances((prev) => ({ ...prev, [selectedSlot]: nextApp }));
        setStudioNotice(`Saved built-in style for ${selectedSlot}.`);
        return;
      }

      if (currentEntry) {
        setSavedSlots((prev) => ({
          ...prev,
          [selectedSlot]: { ...currentEntry, appearance: nextApp },
        }));
      }

      await updateSlotAppearanceInIDB(selectedSlot, nextApp);

      if (requiresKey && !studioKey.trim()) {
        setStudioNotice('Saved style in browser · enter Studio key to sync server manifest.');
        return;
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-studio-intent': 'sonko-creator',
        };
        if (studioKey.trim()) {
          headers['x-studio-key'] = studioKey.trim();
        }
        const res = await fetch(`/api/models/${selectedSlot}/appearance`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(nextApp),
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
        };
        if (!res.ok) {
          setStudioNotice('Saved style in browser.');
          return;
        }
        if (payload.slots) {
          setSavedSlots((prev) => ({ ...prev, ...payload.slots }));
        }
        setStudioNotice(`Saved style for ${selectedSlot}.`);
      } catch {
        setStudioNotice('Saved style in browser.');
      }
    };

    const handleClearSlot = async () => {
      if (!controllerRef.current) return;
      setStudioNotice(null);
      try {
        await removeSlotFromIDB(selectedSlot);
        if (
          selectedSlot === 'kato' ||
          selectedSlot === 'namukasa' ||
          selectedSlot === 'auma' ||
          selectedSlot === 'ssemakula'
        ) {
          setBuiltInAppearances((prev) => {
            const copy = { ...prev };
            delete copy[selectedSlot];
            return copy;
          });
        }

        const headers: Record<string, string> = {
          'x-studio-intent': 'sonko-creator',
        };
        if (studioKey.trim()) {
          headers['x-studio-key'] = studioKey.trim();
        }
        try {
          const res = await fetch(`/api/models/${selectedSlot}`, {
            method: 'DELETE',
            headers,
          });
          if (res.ok) {
            const payload = (await res.json()) as {
              slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
            };
            setSavedSlots(payload.slots ?? {});
          } else {
            setSavedSlots((prev) => {
              const copy = { ...prev };
              delete copy[selectedSlot];
              return copy;
            });
          }
        } catch {
          setSavedSlots((prev) => {
            const copy = { ...prev };
            delete copy[selectedSlot];
            return copy;
          });
        }

        controllerRef.current.clearSlotGLB(selectedSlot);
        const isChar =
          selectedSlot === 'kato' ||
          selectedSlot === 'namukasa' ||
          selectedSlot === 'auma' ||
          selectedSlot === 'ssemakula';
        setStudioNotice(
          isChar
            ? `Restored built-in 3D character for "${selectedSlot}".`
            : `Cleared "${selectedSlot}".`
        );
      } catch {
        setStudioNotice('Failed to clear slot.');
      }
    };

    const handleApplyAssetToSlot = async (
      file: AssetLibraryFile,
      slot: ModelSlotId
    ): Promise<string> => {
      if (!controllerRef.current) {
        throw new Error('3D Courtyard viewport is not ready yet.');
      }
      const isSurfaceImg = slot === 'surface' && /^(png|jpg|jpeg|webp)$/i.test(file.ext);
      const isModelFile = /^(glb|gltf|usdz|usd|usda|usdc)$/i.test(file.ext);
      if (!isSurfaceImg && !isModelFile) {
        throw new Error(`"${file.name}" cannot be loaded into 3D slot "${slot}".`);
      }

      const headers: Record<string, string> = {
        'x-studio-intent': 'sonko-creator',
      };
      if (studioKey.trim()) {
        headers['x-studio-key'] = studioKey.trim();
      }

      let loadUrl = file.url;
      let persistedScope = 'browser-persisted';
      let entryAppearance = savedSlots[slot]?.appearance;
      let entryAssetType: 'model' | 'surface-textures' = isSurfaceImg
        ? 'surface-textures'
        : 'model';
      let entryTextureSet: SurfaceTextureSet | undefined = isSurfaceImg
        ? { albedo: file.url }
        : undefined;

      if (file.source !== 'local-vfs') {
        try {
          const res = await fetch(`/api/models/${slot}/assign`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: file.folder, fileName: file.name }),
          });
          const payload = (await res.json()) as {
            ok?: boolean;
            entry?: StoredModelEntry;
            slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
          };
          if (res.ok && payload.entry) {
            persistedScope = 'saved to /public/models/';
            loadUrl = payload.entry.url;
            entryAppearance = payload.entry.appearance;
            entryAssetType = payload.entry.assetType ?? entryAssetType;
            entryTextureSet = payload.entry.textureSet ?? entryTextureSet;
            if (payload.slots) {
              setSavedSlots(payload.slots);
            }
          }
        } catch {
          // Fall back to IDB persistence below
        }

        await saveSlotToIDB({
          slot,
          fileName: file.name,
          originalName: file.name,
          sourceKind: 'asset-ref',
          assetUrl: file.url,
          assetFolder: file.folder,
          assetFileName: file.name,
          assetType: entryAssetType,
          textureSet: entryTextureSet,
          appearance: entryAppearance,
          bytes: file.sizeBytes,
          updatedAt: new Date().toISOString(),
        });

        if (persistedScope === 'browser-persisted') {
          setSavedSlots((prev) => ({
            ...prev,
            [slot]: {
              slot,
              originalName: file.name,
              url: file.url,
              bytes: file.sizeBytes,
              fileExists: true,
              assetType: entryAssetType,
              textureSet: entryTextureSet,
              appearance: entryAppearance,
            },
          }));
        }
      } else {
        // Local VFS asset -> persist blob in IDB + try syncing to server /api/models/:slot
        const blobRes = await fetch(file.url);
        const blob = await blobRes.blob();
        let syncedServer = false;

        try {
          const buf = await blob.arrayBuffer();
          const upRes = await fetch(`/api/models/${slot}`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/octet-stream',
              'x-file-name': file.name,
            },
            body: buf,
          });
          const upPayload = (await upRes.json()) as {
            ok?: boolean;
            entry?: StoredModelEntry;
            slots?: Partial<Record<ModelSlotId, StoredModelEntry>>;
          };
          if (upRes.ok && upPayload.entry) {
            syncedServer = true;
            persistedScope = 'saved to /public/models/';
            loadUrl = upPayload.entry.url;
            entryAppearance = upPayload.entry.appearance;
            entryAssetType = upPayload.entry.assetType ?? entryAssetType;
            entryTextureSet = upPayload.entry.textureSet ?? entryTextureSet;
            if (upPayload.slots) setSavedSlots(upPayload.slots);
          }
        } catch {
          // Keep local IDB persistence
        }

        await saveSlotToIDB({
          slot,
          fileName: file.name,
          originalName: file.name,
          sourceKind: 'upload-blob',
          blob,
          assetType: entryAssetType,
          appearance: entryAppearance,
          bytes: blob.size,
          updatedAt: new Date().toISOString(),
        });

        if (!syncedServer) {
          setSavedSlots((prev) => ({
            ...prev,
            [slot]: {
              slot,
              originalName: file.name,
              url: `idb://${slot}`,
              bytes: blob.size,
              fileExists: true,
              assetType: entryAssetType,
              appearance: entryAppearance,
            },
          }));
        }
      }

      if (isSurfaceImg) {
        await controllerRef.current.loadSlotGLBFromUrl('surface', loadUrl, undefined, {
          assetType: 'surface-textures',
          textureSet: entryTextureSet ?? { albedo: loadUrl },
        });
        return `Applied & persisted texture "${file.name}" onto Courtyard Surface (${persistedScope}).`;
      }

      const { animations, hasSkeleton } = await controllerRef.current.loadSlotGLBFromUrl(
        slot,
        loadUrl,
        entryAppearance,
        { fileNameHint: file.name }
      );
      const rigInfo = hasSkeleton ? ' · rigged' : '';
      const animInfo = animations.length > 0 ? ` · ${animations.length} clips` : '';
      return `Loaded & persisted "${file.name}" into "${slot}"${rigInfo}${animInfo} (${persistedScope}).`;
    };

    const activeSlotSaved = savedSlots[selectedSlot];
    const activeSlotMissingOnDisk =
      Boolean(activeSlotSaved) && activeSlotSaved?.fileExists === false;
    const isSelectedCharSlot =
      selectedSlot === 'kato' ||
      selectedSlot === 'namukasa' ||
      selectedSlot === 'auma' ||
      selectedSlot === 'ssemakula';
    const activeAppearance: CharacterAppearance =
      (activeSlotSaved && !activeSlotMissingOnDisk
        ? activeSlotSaved.appearance
        : isSelectedCharSlot
          ? builtInAppearances[selectedSlot]
          : undefined) ?? {
        ...DEFAULT_APPEARANCE,
        skinTone: selectedSlot === 'ssemakula' ? 'chestnut' : 'original',
      };

    const slotsPanelContent = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {SLOT_OPTIONS.map((slot) => {
              const entry = savedSlots[slot.id];
              const ready = Boolean(entry) && entry?.fileExists !== false;
              const missing = Boolean(entry) && entry?.fileExists === false;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    const alt = SLOT_OPTIONS.find((o) => o.id !== slot.id)?.id ?? 'namukasa';
                    if (duplicateTarget === slot.id) setDuplicateTarget(alt);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                    selectedSlot === slot.id
                      ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07] font-semibold'
                      : 'bg-[#26140D] border-[#FAF3E8]/12 text-[#E5D3BE]/85 hover:text-white'
                  }`}
                >
                  {slot.label}
                  {ready ? ' ✓' : missing ? ' !' : ''}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#D97706] hover:bg-[#EA8A1A] text-xs font-semibold text-[#1A0B07] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {uploading
                  ? 'Uploading...'
                  : selectedSlot === 'surface'
                    ? 'Upload .zip/.usdz/.png'
                    : 'Upload .glb/.usdz/.zip'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={
                selectedSlot === 'surface'
                  ? '.glb,.gltf,.usdz,.usd,.usda,.usdc,.zip,.png,.jpg,.jpeg,.webp'
                  : '.glb,.gltf,.usdz,.usd,.usda,.usdc,.zip'
              }
              onChange={(e) => void handleUploadSlotGLB(e)}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => voiceFileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2E1911] hover:bg-[#3F2318] border border-[#FAF3E8]/15 text-xs font-medium text-[#F3E6D6] cursor-pointer whitespace-nowrap"
            >
              <Music className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>Voice .mp3/.ogg</span>
            </button>
            <input
              ref={voiceFileInputRef}
              type="file"
              accept=".mp3,.ogg,.wav,.m4a,.webm"
              onChange={(e) => void handleUploadVoiceClip(e)}
              className="hidden"
            />

            {activeSlotSaved && !activeSlotMissingOnDisk && (
              <div className="inline-flex items-center gap-1 bg-[#120906] border border-[#FAF3E8]/15 rounded-lg px-1.5 py-1">
                <select
                  value={duplicateTarget}
                  onChange={(e) => setDuplicateTarget(e.target.value as ModelSlotId)}
                  aria-label="Target slot to duplicate into"
                  className="bg-transparent text-xs text-[#FAF3E8] outline-none cursor-pointer"
                >
                  {SLOT_OPTIONS.filter((s) => s.id !== selectedSlot).map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#1B100C] text-[#FAF3E8]">
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleDuplicateSlot()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#381E14] hover:bg-[#4B291C] text-[11px] font-medium text-amber-200 cursor-pointer"
                >
                  <Copy className="w-3 h-3" aria-hidden="true" />
                  <span>Duplicate</span>
                </button>
              </div>
            )}

            {(activeSlotSaved || (isSelectedCharSlot && builtInAppearances[selectedSlot])) && (
              <button
                type="button"
                onClick={() => void handleClearSlot()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2E1911] hover:bg-[#3F2318] border border-[#FAF3E8]/15 text-xs font-medium text-[#F3E6D6] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span>{activeSlotSaved ? 'Clear' : 'Reset Style'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleExportGLB()}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2E1911] hover:bg-[#3F2318] border border-[#FAF3E8]/15 text-xs font-medium text-[#F3E6D6] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>{exporting ? 'Exporting...' : 'Export .glb'}</span>
            </button>
          </div>
        </div>

        {activeSlotMissingOnDisk && activeSlotSaved && (
          <div className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-md px-2.5 py-1.5">
            Previous custom file &ldquo;{activeSlotSaved.originalName}&rdquo; is not on disk —
            using built-in 3D character fallback. Upload or assign from Asset Library to restore a custom model.
          </div>
        )}

        {/* Active Model Status & Live Skin Tone / Outfit / Shoes Customizer */}
        {isSelectedCharSlot && (
          <div className="pt-2 border-t border-[#FAF3E8]/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#E5D3BE]/75">Active 3D Actor</span>
              <span
                className={`px-2 py-0.5 rounded font-medium ${
                  activeSlotSaved && !activeSlotMissingOnDisk
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-950/60 text-amber-200 border border-amber-400/25'
                }`}
              >
                {activeSlotSaved && !activeSlotMissingOnDisk
                  ? `Custom Persisted (${activeSlotSaved.originalName})`
                  : 'Built-in Rigged 3D Character'}
              </span>
            </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-[#E5D3BE]/75 w-14">Skin</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {SKIN_TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        void handleAppearanceChange({ skinTone: opt.id as SkinTonePreset })
                      }
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border cursor-pointer ${
                        activeAppearance.skinTone === opt.id
                          ? 'bg-[#2F1B12] border-amber-400 text-[#FAF3E8] font-semibold'
                          : 'bg-[#120906] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm border border-white/25"
                        style={{ backgroundColor: opt.hex }}
                      />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-[#E5D3BE]/75 w-14">Outfit</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {OUTFIT_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        void handleAppearanceChange({
                          outfitStyle: opt.id as OutfitStylePreset,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border cursor-pointer ${
                        activeAppearance.outfitStyle === opt.id
                          ? 'bg-[#2F1B12] border-amber-400 text-[#FAF3E8] font-semibold'
                          : 'bg-[#120906] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm border border-white/25"
                        style={{ backgroundColor: opt.hex }}
                      />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedSlot !== 'auma' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[#E5D3BE]/75 w-14">Shoes</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {SHOE_STYLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          void handleAppearanceChange({
                            shoeStyle: opt.id as ShoeStylePreset,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border cursor-pointer ${
                          activeAppearance.shoeStyle === opt.id
                            ? 'bg-[#2F1B12] border-amber-400 text-[#FAF3E8] font-semibold'
                            : 'bg-[#120906] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm border border-white/25"
                          style={{ backgroundColor: opt.hex }}
                        />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        {studioNotice && (
          <div className="text-xs text-amber-200/95 bg-[#110805] border border-amber-400/20 rounded-lg px-3 py-2">
            {studioNotice}
          </div>
        )}
      </div>
    );

    return (
      <div className="absolute inset-0">
        {/* Full-Viewport Three.js WebGL Container */}
        <div ref={mountRef} className="absolute inset-0" />

        {/* Car Arrival Intro Overlay (during Trailer Park -> Playground drive-in) */}
        {arrivalPlaying && (
          <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 bg-[#1B100C]/92 border border-amber-400/35 rounded-lg px-4 py-2 shadow-xl">
              <div className="text-xs font-medium text-[#FAF3E8]">
                <span className="text-amber-300 font-semibold">Schoolyard Park Arrival</span>
                <span className="mx-2 text-[#FAF3E8]/35" aria-hidden="true">
                  ·
                </span>
                <span className="text-[#E5D3BE]">Driving in beside Playground</span>
              </div>
              <button
                type="button"
                onClick={() => controllerRef.current?.skipArrivalSequence()}
                className="px-2.5 py-1 rounded-md bg-[#D97706] hover:bg-[#EA8A1A] text-[11px] font-semibold text-[#1A0B07] transition-colors cursor-pointer"
              >
                Skip Intro
              </button>
            </div>
          </div>
        )}

        {/* Classic 3-Pane AssetManager & Creator Studio Modal */}
        <AssetManager
          isOpen={studioOpen && studioAvailable}
          onClose={() => setStudioOpen(false)}
          folders={assetFolders}
          files={assetFiles}
          defaultFolders={defaultAssetFolders}
          requiresKey={requiresKey}
          studioKey={studioKey}
          onStudioKeyChange={setStudioKey}
          onLibraryUpdate={(nextFolders, nextFiles) => {
            setAssetFolders(nextFolders);
            setAssetFiles(nextFiles);
          }}
          onApplyToSlot={handleApplyAssetToSlot}
          slotsPanel={slotsPanelContent}
        />

        {/* Collapsible Camera & Creator Studio Dock (hidden when collapsed on TITLE_MENU; accessible via WORLD tab or 'H') */}
        {(screen === 'PLAYING' || !dockCollapsed) && (
          <div
            className={`pointer-events-none fixed z-30 flex flex-col items-end ${
              screen === 'PLAYING'
                ? 'bottom-16 right-4 w-[min(860px,92vw)]'
                : 'bottom-14 right-4 w-[min(920px,95vw)]'
            }`}
          >

            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              aria-expanded={!dockCollapsed}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B100C]/92 border border-[#FAF3E8]/15 text-[11px] font-medium text-[#E5D3BE]/85 hover:text-[#FAF3E8] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>{dockCollapsed ? 'Camera & View (H)' : 'Hide View Bar (H)'}</span>
              {dockCollapsed ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto w-full mt-1.5 bg-[#1B100C]/94 border border-[#FAF3E8]/15 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E5D3BE]/75">
                  <Camera className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>View</span>
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-[#120906] border border-[#FAF3E8]/10 rounded-lg flex-wrap">
                  {CAMERA_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectCamera(opt.id)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        cameraPreset === opt.id
                          ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                          : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-[#E5D3BE]/75">Pose</span>
                <div className="flex items-center gap-1 p-0.5 bg-[#120906] border border-[#FAF3E8]/10 rounded-lg flex-wrap">
                  {POSE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectPose(opt.id)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activePose === opt.id
                          ? 'bg-emerald-500 text-[#0B1910] font-semibold'
                          : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-[#E5D3BE]/75">Speech</span>
                <div className="flex items-center gap-1 p-0.5 bg-[#120906] border border-[#FAF3E8]/10 rounded-lg flex-wrap">
                  {SPEECH_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectSpeech(opt.id)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeSpeech === opt.id
                          ? 'bg-sky-400 text-[#071520] font-semibold'
                          : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E5D3BE]/75">
                  <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Sky</span>
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-[#120906] border border-[#FAF3E8]/10 rounded-lg flex-wrap">
                  {DAYLIGHT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectDaylight(opt.id)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        daylight === opt.id
                          ? 'bg-[#FAF3E8] text-[#1A0B07] font-semibold'
                          : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E5D3BE]/75">
                  <CloudRain className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  <span>Weather</span>
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-[#120906] border border-[#FAF3E8]/10 rounded-lg flex-wrap">
                  {WEATHER_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.hint}
                      onClick={() => handleSelectWeatherMode(opt.id)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        weatherMode === opt.id
                          ? 'bg-sky-300 text-[#071520] font-semibold'
                          : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {studioAvailable && (
                  <button
                    type="button"
                    onClick={() => setStudioOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      studioOpen
                        ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07] font-semibold'
                        : 'bg-[#26140D] border-[#FAF3E8]/15 text-amber-200 hover:bg-[#351B12]'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Asset Manager &amp; Studio</span>
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
        )}
      </div>
    );
  }
);
