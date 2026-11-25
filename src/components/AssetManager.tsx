import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Archive,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Music,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { disposeLoadedModel, load3DModelFromUrl } from '../scene3d/modelLoader';
import { ModelSlotId } from '../scene3d/ugandanCompoundScene';
import {
  deleteVfsBlobFromIDB,
  getAllVfsBlobsFromIDB,
  saveVfsBlobToIDB,
} from '../game/modelPersistence';

export interface AssetLibraryFile {
  name: string;
  folder: string;
  sizeBytes: number;
  ext: string;
  url: string;
  modifiedAt: string;
  source?: 'app' | 'local-vfs';
}

export interface UploadQueueItem {
  id: string;
  name: string;
  folder: string;
  sizeBytes: number;
  progress: number;
  status: 'queued' | 'uploading' | 'saved' | 'local-vfs' | 'error';
  error?: string;
}

interface LocalVfsManifest {
  folders: string[];
  files: Array<AssetLibraryFile & { dataUrl?: string }>;
}

interface AssetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  folders: string[];
  files: AssetLibraryFile[];
  defaultFolders?: string[];
  requiresKey: boolean;
  studioKey: string;
  onStudioKeyChange: (key: string) => void;
  onLibraryUpdate: (folders: string[], files: AssetLibraryFile[]) => void;
  onApplyToSlot?: (file: AssetLibraryFile, slot: ModelSlotId) => Promise<string | void>;
  slotsPanel?: React.ReactNode;
  initialTab?: 'library' | 'slots';
}

interface PreviewStats {
  meshes: number;
  materials: number;
  animations: number;
  width: number;
  height: number;
  depth: number;
}

const LOCAL_VFS_KEY = 'sonko_asset_manager_vfs_v1';

const BUILTIN_DEFAULT_FOLDERS = new Set([
  'worlds',
  'worlds/kampala_compound',
  'worlds/primary_schoolyard',
  'worlds/entebbe_lakeside',
  'worlds/trading_centre',
  'worlds/ndere_festival',
  'characters',
  'props',
  'vehicles',
  'textures',
  'audio',
  'unsorted',
]);

const MODEL_EXT_RE = /^(glb|gltf|usdz|usd|usda|usdc)$/i;
const IMAGE_EXT_RE = /^(png|jpg|jpeg|webp)$/i;
const AUDIO_EXT_RE = /^(mp3|ogg|wav|m4a|webm)$/i;
const SUPPORTED_EXT_RE = /\.(glb|gltf|usdz|usd|usda|usdc|zip|png|jpg|jpeg|webp|mp3|ogg|wav|m4a|webm)$/i;

const QUICK_SLOT_TARGETS: Array<{ id: ModelSlotId; label: string; kind: 'model' | 'any' }> = [
  { id: 'prop', label: 'Courtyard Prop', kind: 'model' },
  { id: 'surface', label: 'Courtyard Surface', kind: 'any' },
  { id: 'stone', label: 'River Stone', kind: 'model' },
  { id: 'kato', label: 'Kato (P1)', kind: 'model' },
  { id: 'namukasa', label: 'Namukasa', kind: 'model' },
  { id: 'ssemakula', label: 'Ssemakula', kind: 'model' },
  { id: 'auma', label: 'Auma', kind: 'model' },
];

export function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatFolderSegmentLabel(segment: string): string {
  return segment
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatFolderFullLabel(folder: string): string {
  return folder
    .split('/')
    .filter(Boolean)
    .map(formatFolderSegmentLabel)
    .join(' / ');
}

function readLocalVfs(): LocalVfsManifest {
  try {
    const raw = localStorage.getItem(LOCAL_VFS_KEY);
    if (!raw) return { folders: [], files: [] };
    const parsed = JSON.parse(raw) as Partial<LocalVfsManifest>;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return { folders: [], files: [] };
  }
}

function writeLocalVfs(manifest: LocalVfsManifest) {
  try {
    localStorage.setItem(LOCAL_VFS_KEY, JSON.stringify(manifest));
  } catch {
    // Ignore storage quota errors
  }
}

function fileToSmallDataUrl(file: File): Promise<string | undefined> {
  if (file.size > 420 * 1024) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

function disposeObjectResources(root: THREE.Object3D) {
  disposeLoadedModel(root);
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  isOpen,
  onClose,
  folders,
  files,
  defaultFolders,
  requiresKey,
  studioKey,
  onStudioKeyChange,
  onLibraryUpdate,
  onApplyToSlot,
  slotsPanel,
  initialTab = 'library',
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'slots'>(initialTab);
  const [localVfs, setLocalVfs] = useState<LocalVfsManifest>(() => readLocalVfs());
  const [vfsHydrateTick, setVfsHydrateTick] = useState(0);
  const sessionBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const sessionBlobsRef = useRef<Map<string, Blob>>(new Map());

  const [activeFolder, setActiveFolder] = useState<string>('worlds/kampala_compound');
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    worlds: true,
    characters: true,
    props: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'models' | 'textures' | 'audio'>('all');

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string>('');
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);
  const [turntableSpin, setTurntableSpin] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [applyingSlot, setApplyingSlot] = useState<ModelSlotId | null>(null);

  const fallbackFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const previewRigRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    modelGroup: THREE.Group;
    fitCamera: () => void;
  } | null>(null);
  const turntableRef = useRef(turntableSpin);
  turntableRef.current = turntableSpin;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Hydrate large Local VFS blobs from IndexedDB & revoke session blob URLs on unmount
  useEffect(() => {
    let active = true;
    const urlMap = sessionBlobUrlsRef.current;
    const blobMap = sessionBlobsRef.current;

    void getAllVfsBlobsFromIDB().then((blobs) => {
      if (!active) return;
      let changed = false;
      for (const [key, blob] of Object.entries(blobs)) {
        blobMap.set(key, blob);
        if (!urlMap.has(key)) {
          urlMap.set(key, URL.createObjectURL(blob));
          changed = true;
        }
      }
      if (changed) {
        setVfsHydrateTick((n) => n + 1);
      }
    });

    return () => {
      active = false;
      for (const u of urlMap.values()) {
        URL.revokeObjectURL(u);
      }
      urlMap.clear();
      blobMap.clear();
    };
  }, []);

  // Keyboard Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const builtinFolderSet = useMemo(
    () => new Set([...(defaultFolders ?? []), ...BUILTIN_DEFAULT_FOLDERS]),
    [defaultFolders]
  );

  // Merge server folders/files with any local-VFS-only entries
  const mergedFolders = useMemo(() => {
    const set = new Set<string>([...folders, ...localVfs.folders]);
    if (set.size === 0) {
      for (const f of BUILTIN_DEFAULT_FOLDERS) set.add(f);
    }
    return [...set];
  }, [folders, localVfs.folders]);

  const mergedFiles = useMemo<AssetLibraryFile[]>(() => {
    const seen = new Set<string>();
    const combined: AssetLibraryFile[] = [];
    for (const f of files) {
      const k = `${f.folder}/${f.name}`;
      seen.add(k);
      combined.push({ ...f, source: 'app' });
    }
    for (const lf of localVfs.files) {
      const k = `${lf.folder}/${lf.name}`;
      if (seen.has(k)) continue;
      const resolvedUrl =
        sessionBlobUrlsRef.current.get(k) || lf.dataUrl || (lf.url.startsWith('blob:') ? '' : lf.url);
      if (!resolvedUrl) continue;
      combined.push({
        ...lf,
        url: resolvedUrl,
        source: 'local-vfs',
      });
    }
    return combined;
  }, [files, localVfs.files, vfsHydrateTick]);

  // Ensure activeFolder points to an existing folder
  useEffect(() => {
    if (mergedFolders.length > 0 && !mergedFolders.includes(activeFolder)) {
      setActiveFolder(
        mergedFolders.includes('worlds/kampala_compound')
          ? 'worlds/kampala_compound'
          : mergedFolders[0]
      );
    }
  }, [mergedFolders, activeFolder]);

  // Organize folder tree (top-level parents and child subfolders)
  const folderTree = useMemo(() => {
    const topLevel: string[] = [];
    const childrenByParent = new Map<string, string[]>();

    for (const folder of mergedFolders) {
      const slashIdx = folder.indexOf('/');
      if (slashIdx === -1) {
        if (!topLevel.includes(folder)) topLevel.push(folder);
      } else {
        const parent = folder.slice(0, slashIdx);
        if (!topLevel.includes(parent)) topLevel.push(parent);
        const list = childrenByParent.get(parent) ?? [];
        if (!list.includes(folder)) list.push(folder);
        childrenByParent.set(parent, list);
      }
    }

    return { topLevel, childrenByParent };
  }, [mergedFolders]);

  const countInFolder = useCallback(
    (folder: string, includeChildren = false) => {
      return mergedFiles.filter((f) =>
        includeChildren
          ? f.folder === folder || f.folder.startsWith(`${folder}/`)
          : f.folder === folder
      ).length;
    },
    [mergedFiles]
  );

  // Filter files shown in Center Grid
  const visibleFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedFiles.filter((f) => {
      const matchesFolder =
        f.folder === activeFolder ||
        (activeFolder === 'worlds' && f.folder.startsWith('worlds/'));
      if (!matchesFolder) return false;
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (typeFilter === 'models') return MODEL_EXT_RE.test(f.ext);
      if (typeFilter === 'textures') return IMAGE_EXT_RE.test(f.ext);
      if (typeFilter === 'audio') return AUDIO_EXT_RE.test(f.ext);
      return true;
    });
  }, [mergedFiles, activeFolder, searchQuery, typeFilter]);

  const selectedFile = useMemo(() => {
    if (selectedFileKey) {
      const found = mergedFiles.find((f) => `${f.folder}/${f.name}` === selectedFileKey);
      if (found) return found;
    }
    return visibleFiles[0] ?? null;
  }, [mergedFiles, selectedFileKey, visibleFiles]);

  // Auto-select first file in folder if none selected or when switching folders
  useEffect(() => {
    if (!selectedFile && visibleFiles.length > 0) {
      setSelectedFileKey(`${visibleFiles[0].folder}/${visibleFiles[0].name}`);
    }
  }, [selectedFile, visibleFiles]);

  const studioAuthHeaders = useCallback(
    (extra?: Record<string, string>) => {
      const headers: Record<string, string> = {
        'x-studio-intent': 'sonko-creator',
        ...extra,
      };
      if (studioKey.trim()) {
        headers['x-studio-key'] = studioKey.trim();
      }
      return headers;
    },
    [studioKey]
  );

  // Mount & manage dedicated Three.js 3D Preview Window when Asset Library tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'library') return;
    const container = previewMountRef.current;
    if (!container) return;

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(200, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#160C08');

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 500);
    camera.position.set(2.8, 1.9, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.65, 0);
    controls.update();

    // Studio 3-point warm courtyard lighting
    const hemi = new THREE.HemisphereLight('#FFF3DC', '#4A2C18', 1.1);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFE7BD', 1.9);
    keyLight.position.set(4.5, 6.5, 4.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#93C5FD', 0.75);
    rimLight.position.set(-4.5, 3.5, -4.0);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(6, 12, 0xd97706, 0x3b2216);
    scene.add(grid);

    const pedestalGeo = new THREE.RingGeometry(0.95, 1.02, 48);
    pedestalGeo.rotateX(-Math.PI / 2);
    const pedestalMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const pedestalRing = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalRing.position.y = 0.002;
    scene.add(pedestalRing);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const fitCamera = () => {
      const box = new THREE.Box3().setFromObject(modelGroup);
      if (box.isEmpty()) {
        camera.position.set(2.8, 1.8, 3.2);
        controls.target.set(0, 0.5, 0);
        controls.update();
        return;
      }
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(0.25, size.x, size.y, size.z);
      const dist = maxDim * 1.65;
      camera.near = Math.max(0.01, maxDim / 200);
      camera.far = Math.max(200, maxDim * 40);
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      camera.position.set(center.x + dist * 0.75, center.y + dist * 0.48, center.z + dist * 0.88);
      controls.update();
    };

    previewRigRef.current = { scene, camera, controls, renderer, modelGroup, fitCamera };

    let rafId = 0;
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (turntableRef.current && modelGroup.children.length > 0) {
        modelGroup.rotation.y += dt * 0.45;
      }
      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(200, container.clientWidth);
      const h = Math.max(180, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      for (const child of [...modelGroup.children]) {
        disposeObjectResources(child);
        modelGroup.remove(child);
      }
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      pedestalGeo.dispose();
      pedestalMat.dispose();
      controls.dispose();
      renderer.dispose();
      previewRigRef.current = null;
    };
  }, [isOpen, activeTab]);

  // Load selected 3D model into the Preview Window
  useEffect(() => {
    const rig = previewRigRef.current;
    if (!rig || !isOpen || activeTab !== 'library') return;

    const clearPrevious = () => {
      for (const child of [...rig.modelGroup.children]) {
        disposeObjectResources(child);
        rig.modelGroup.remove(child);
      }
      rig.modelGroup.rotation.set(0, 0, 0);
    };

    setImageDims(null);
    setPreviewError(null);
    setPreviewStats(null);

    if (!selectedFile || !MODEL_EXT_RE.test(selectedFile.ext)) {
      clearPrevious();
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    clearPrevious();

    void (async () => {
      try {
        const loaded = await load3DModelFromUrl(selectedFile.url, selectedFile.name);
        if (cancelled) {
          disposeObjectResources(loaded.scene);
          return;
        }

        const root = loaded.scene;
        root.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(root);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawMax = Math.max(0.001, rawSize.x, rawSize.y, rawSize.z);
        // Normalize preview footprint cleanly around ~2.1m while keeping true meters in stats
        const normScale = 2.1 / rawMax;
        root.scale.multiplyScalar(normScale);
        root.updateMatrixWorld(true);

        const normBox = new THREE.Box3().setFromObject(root);
        const normCenter = normBox.getCenter(new THREE.Vector3());
        root.position.set(-normCenter.x, -normBox.min.y, -normCenter.z);

        let meshes = 0;
        const matSet = new Set<THREE.Material>();
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            meshes++;
            const m = obj as THREE.Mesh;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) {
              if (!mat) continue;
              matSet.add(mat);
              if ('wireframe' in mat) {
                (mat as THREE.MeshStandardMaterial).wireframe = wireframeMode;
              }
            }
          }
        });

        rig.modelGroup.add(root);
        rig.fitCamera();
        setPreviewStats({
          meshes,
          materials: matSet.size,
          animations: loaded.animations.length,
          width: rawSize.x,
          height: rawSize.y,
          depth: rawSize.z,
        });
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : 'Could not render 3D preview.');
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFile, isOpen, activeTab]); // wireframeMode handled separately below

  // Toggle wireframe without reloading model
  useEffect(() => {
    const rig = previewRigRef.current;
    if (!rig) return;
    rig.modelGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (mat && 'wireframe' in mat) {
            (mat as THREE.MeshStandardMaterial).wireframe = wireframeMode;
          }
        }
      }
    });
  }, [wireframeMode]);

  const uploadSingleWithProgress = (
    file: File,
    targetFolder: string,
    onProgress: (pct: number) => void
  ): Promise<{ folders?: string[]; files?: AssetLibraryFile[]; entry?: AssetLibraryFile }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/assets/upload', true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('x-studio-intent', 'sonko-creator');
      xhr.setRequestHeader('x-file-name', file.name);
      xhr.setRequestHeader('x-asset-folder', targetFolder);
      if (studioKey.trim()) {
        xhr.setRequestHeader('x-studio-key', studioKey.trim());
      }

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          onProgress(Math.min(98, Math.round((ev.loaded / ev.total) * 100)));
        }
      };

      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}') as {
            ok?: boolean;
            error?: string;
            folders?: string[];
            files?: AssetLibraryFile[];
            entry?: AssetLibraryFile;
          };
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(100);
            resolve(payload);
          } else {
            const err = new Error(payload.error || `Upload failed (${xhr.status})`) as Error & {
              status?: number;
            };
            err.status = xhr.status;
            reject(err);
          }
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading.'));
      xhr.send(file);
    });
  };

  const saveToLocalVfsFallback = async (
    file: File,
    targetFolder: string
  ): Promise<AssetLibraryFile> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `${targetFolder}/${file.name}`;
    const blobUrl = URL.createObjectURL(file);
    const prev = sessionBlobUrlsRef.current.get(key);
    if (prev) URL.revokeObjectURL(prev);
    sessionBlobUrlsRef.current.set(key, blobUrl);
    sessionBlobsRef.current.set(key, file);
    await saveVfsBlobToIDB(key, file);

    const dataUrl = await fileToSmallDataUrl(file);
    const entry: AssetLibraryFile & { dataUrl?: string } = {
      name: file.name,
      folder: targetFolder,
      sizeBytes: file.size,
      ext,
      url: blobUrl,
      modifiedAt: new Date().toISOString(),
      source: 'local-vfs',
      ...(dataUrl ? { dataUrl } : {}),
    };

    setLocalVfs((prevVfs) => {
      const nextFolders = prevVfs.folders.includes(targetFolder)
        ? prevVfs.folders
        : [...prevVfs.folders, targetFolder];
      const nextFiles = [
        ...prevVfs.files.filter((f) => !(f.folder === targetFolder && f.name === file.name)),
        entry,
      ];
      const updated = { folders: nextFolders, files: nextFiles };
      writeLocalVfs(updated);
      return updated;
    });

    return entry;
  };

  const uploadSelectedFiles = async (selected: File[], destinationFolder: string) => {
    const targetFolder = destinationFolder === 'worlds' ? 'worlds/kampala_compound' : destinationFolder;
    const valid = selected.filter((f) => SUPPORTED_EXT_RE.test(f.name));
    if (valid.length === 0) {
      setStatusNotice(
        'Supported formats: .glb, .gltf, .usdz, .usd, .zip, .png, .jpg, .webp, .mp3, .ogg, .wav'
      );
      return;
    }

    const batchItems: UploadQueueItem[] = valid.map((f, idx) => ({
      id: `${Date.now()}_${idx}_${f.name}`,
      name: f.name,
      folder: targetFolder,
      sizeBytes: f.size,
      progress: 0,
      status: 'queued',
    }));

    setUploadQueue((prev) => [...batchItems, ...prev].slice(0, 30));
    setUploading(true);
    setStatusNotice(null);

    let savedInAppCount = 0;
    let savedLocallyCount = 0;
    let lastEntryKey: string | null = null;

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const itemId = batchItems[i].id;

      setUploadQueue((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'uploading', progress: 5 } : it))
      );

      try {
        const res = await uploadSingleWithProgress(file, targetFolder, (pct) => {
          setUploadQueue((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, progress: pct } : it))
          );
        });

        savedInAppCount++;
        if (res.folders && res.files) {
          onLibraryUpdate(res.folders, res.files);
        }
        const entryName = res.entry?.name ?? file.name;
        lastEntryKey = `${targetFolder}/${entryName}`;
        setUploadQueue((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, name: entryName, status: 'saved', progress: 100 } : it
          )
        );
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 403) {
          // Requires Studio Key for disk write — store cleanly in Local VFS session and surface notice
          const localEntry = await saveToLocalVfsFallback(file, targetFolder);
          savedLocallyCount++;
          lastEntryKey = `${localEntry.folder}/${localEntry.name}`;
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    status: 'local-vfs',
                    progress: 100,
                    error: 'Studio Key needed to write to server disk — staged in Local VFS.',
                  }
                : it
            )
          );
        } else {
          // Offline or read-only filesystem fallback -> Local VFS
          const localEntry = await saveToLocalVfsFallback(file, targetFolder);
          savedLocallyCount++;
          lastEntryKey = `${localEntry.folder}/${localEntry.name}`;
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    status: 'local-vfs',
                    progress: 100,
                    error: err instanceof Error ? err.message : 'Saved to Local VFS.',
                  }
                : it
            )
          );
        }
      }
    }

    if (lastEntryKey) {
      setSelectedFileKey(lastEntryKey);
    }

    if (savedInAppCount > 0 && savedLocallyCount === 0) {
      setStatusNotice(
        `Saved ${savedInAppCount} ${savedInAppCount === 1 ? 'file' : 'files'} inside /assets/${targetFolder}/.`
      );
    } else if (savedLocallyCount > 0) {
      setStatusNotice(
        savedInAppCount > 0
          ? `Saved ${savedInAppCount} in App + ${savedLocallyCount} in Local VFS.`
          : `Staged ${savedLocallyCount} ${savedLocallyCount === 1 ? 'file' : 'files'} in Local VFS (enter Studio Key to persist to server disk).`
      );
    }

    setUploading(false);
  };

  // Multi-file picker using File System Access API (showOpenFilePicker) with seamless iframe fallback
  const handleMultiFilePick = async () => {
    if (uploading) return;
    const win = window as unknown as {
      showOpenFilePicker?: (opts: {
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<Array<{ getFile: () => Promise<File> }>>;
    };

    if (typeof win.showOpenFilePicker === 'function') {
      try {
        const handles = await win.showOpenFilePicker({
          multiple: true,
          excludeAcceptAllOption: false,
          types: [
            {
              description: '3D Models, Textures, ZIPs & Audio',
              accept: {
                'model/gltf-binary': ['.glb'],
                'model/gltf+json': ['.gltf'],
                'model/vnd.usdz+zip': ['.usdz', '.usd', '.usda', '.usdc'],
                'application/zip': ['.zip'],
                'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                'audio/*': ['.mp3', '.ogg', '.wav', '.m4a', '.webm'],
              },
            },
          ],
        });
        const picked = await Promise.all(handles.map((h) => h.getFile()));
        if (picked.length > 0) {
          await uploadSelectedFiles(picked, activeFolder);
        }
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // User cancelled picker
        }
        // In cross-origin iframes (SecurityError / NotAllowedError), fall through to <input type="file" multiple>
      }
    }

    fallbackFileInputRef.current?.click();
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newFolderName.trim();
    if (!raw || uploading) return;
    const targetPath = newFolderParent ? `${newFolderParent}/${raw}` : raw;
    setStatusNotice(null);

    try {
      const res = await fetch('/api/assets/folders', {
        method: 'POST',
        headers: studioAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: targetPath }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        folder?: string;
        error?: string;
        folders?: string[];
        files?: AssetLibraryFile[];
      };
      if (!res.ok) {
        setStatusNotice(payload.error ?? 'Could not create folder.');
        return;
      }
      if (payload.folders && payload.files) {
        onLibraryUpdate(payload.folders, payload.files);
      }
      if (payload.folder) {
        setActiveFolder(payload.folder);
        const parent = payload.folder.split('/')[0];
        if (parent) {
          setExpandedParents((prev) => ({ ...prev, [parent]: true }));
        }
      }
      setNewFolderName('');
      setStatusNotice(`Created folder "/assets/${payload.folder}/".`);
    } catch {
      const cleanLocal = targetPath
        .toLowerCase()
        .replace(/[^a-z0-9/_-]/g, '_')
        .replace(/^\/+|\/+$/g, '');
      if (cleanLocal) {
        setLocalVfs((prev) => {
          const next = {
            ...prev,
            folders: prev.folders.includes(cleanLocal) ? prev.folders : [...prev.folders, cleanLocal],
          };
          writeLocalVfs(next);
          return next;
        });
        setActiveFolder(cleanLocal);
        setNewFolderName('');
        setStatusNotice(`Created virtual folder "${cleanLocal}".`);
      }
    }
  };

  const handleDeleteCustomFolder = async (folder: string) => {
    if (builtinFolderSet.has(folder) || uploading) return;
    setStatusNotice(null);
    try {
      const res = await fetch('/api/assets/folders', {
        method: 'DELETE',
        headers: studioAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ folder }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        folders?: string[];
        files?: AssetLibraryFile[];
      };
      if (!res.ok) {
        setStatusNotice(payload.error ?? 'Could not remove folder.');
        return;
      }
      if (payload.folders && payload.files) {
        onLibraryUpdate(payload.folders, payload.files);
      }
      setActiveFolder('worlds/kampala_compound');
      setStatusNotice(`Removed empty folder "${folder}".`);
    } catch {
      setStatusNotice('Could not remove folder.');
    }
  };

  const handleMoveFile = async (file: AssetLibraryFile, toFolder: string) => {
    if (file.folder === toFolder || uploading) return;
    setStatusNotice(null);

    if (file.source === 'local-vfs') {
      const oldKey = `${file.folder}/${file.name}`;
      const newKey = `${toFolder}/${file.name}`;
      const blobUrl = sessionBlobUrlsRef.current.get(oldKey);
      if (blobUrl) {
        sessionBlobUrlsRef.current.delete(oldKey);
        sessionBlobUrlsRef.current.set(newKey, blobUrl);
      }
      const blob = sessionBlobsRef.current.get(oldKey);
      if (blob) {
        sessionBlobsRef.current.delete(oldKey);
        sessionBlobsRef.current.set(newKey, blob);
        await saveVfsBlobToIDB(newKey, blob);
      }
      await deleteVfsBlobFromIDB(oldKey);
      setLocalVfs((prev) => {
        const nextFiles = prev.files.map((f) =>
          f.folder === file.folder && f.name === file.name ? { ...f, folder: toFolder } : f
        );
        const updated = { ...prev, files: nextFiles };
        writeLocalVfs(updated);
        return updated;
      });
      setSelectedFileKey(newKey);
      setStatusNotice(`Moved "${file.name}" to "${formatFolderFullLabel(toFolder)}".`);
      return;
    }

    try {
      const res = await fetch('/api/assets/move', {
        method: 'PATCH',
        headers: studioAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          fromFolder: file.folder,
          fileName: file.name,
          toFolder,
        }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        folders?: string[];
        files?: AssetLibraryFile[];
        entry?: AssetLibraryFile;
      };
      if (!res.ok) {
        setStatusNotice(payload.error ?? 'Could not move file.');
        return;
      }
      if (payload.folders && payload.files) {
        onLibraryUpdate(payload.folders, payload.files);
      }
      const nextName = payload.entry?.name ?? file.name;
      setSelectedFileKey(`${toFolder}/${nextName}`);
      setStatusNotice(`Moved "${file.name}" into "${formatFolderFullLabel(toFolder)}".`);
    } catch {
      setStatusNotice('Could not move file.');
    }
  };

  const handleDeleteFile = async (file: AssetLibraryFile) => {
    if (uploading) return;
    setStatusNotice(null);
    const key = `${file.folder}/${file.name}`;

    if (file.source === 'local-vfs') {
      const blobUrl = sessionBlobUrlsRef.current.get(key);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        sessionBlobUrlsRef.current.delete(key);
      }
      sessionBlobsRef.current.delete(key);
      await deleteVfsBlobFromIDB(key);
      setLocalVfs((prev) => {
        const updated = {
          ...prev,
          files: prev.files.filter((f) => !(f.folder === file.folder && f.name === file.name)),
        };
        writeLocalVfs(updated);
        return updated;
      });
      if (selectedFileKey === key) setSelectedFileKey(null);
      setStatusNotice(`Removed "${file.name}" from Local VFS.`);
      return;
    }

    try {
      const res = await fetch('/api/assets/file', {
        method: 'DELETE',
        headers: studioAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ folder: file.folder, fileName: file.name }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        folders?: string[];
        files?: AssetLibraryFile[];
      };
      if (!res.ok) {
        setStatusNotice(payload.error ?? 'Could not delete file.');
        return;
      }
      if (payload.folders && payload.files) {
        onLibraryUpdate(payload.folders, payload.files);
      }
      if (selectedFileKey === key) setSelectedFileKey(null);
      setStatusNotice(`Deleted "${file.name}".`);
    } catch {
      setStatusNotice('Could not delete file.');
    }
  };

  const handleApplySelectedToSlot = async (slot: ModelSlotId) => {
    if (!selectedFile || !onApplyToSlot || applyingSlot) return;
    setApplyingSlot(slot);
    setStatusNotice(null);
    try {
      const msg = await onApplyToSlot(selectedFile, slot);
      setStatusNotice(
        msg || `Applied "${selectedFile.name}" to ${slot} in the live courtyard.`
      );
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : `Could not apply "${selectedFile.name}" to ${slot}.`
      );
    } finally {
      setApplyingSlot(null);
    }
  };

  if (!isOpen) return null;

  const isSelectedModel = selectedFile ? MODEL_EXT_RE.test(selectedFile.ext) : false;
  const isSelectedImage = selectedFile ? IMAGE_EXT_RE.test(selectedFile.ext) : false;
  const isSelectedAudio = selectedFile ? AUDIO_EXT_RE.test(selectedFile.ext) : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sonko Game Asset Manager"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2.5 sm:p-5"
    >
      <div className="w-full max-w-7xl h-[min(90vh,820px)] bg-[#160C08] border border-amber-400/35 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#FAF3E8]">
        {/* Top Classic Studio Header Bar */}
        <header className="px-4 py-3 bg-[#1E100A] border-b border-[#FAF3E8]/12 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-[#D97706]/20 border border-amber-400/40 flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-300" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base leading-tight text-[#FAF3E8]">
                Sonko Asset Studio
              </h2>
              <p className="text-[11px] text-[#E5D3BE]/70">
                Stored in App (<span className="font-mono text-amber-200/90">/public/assets/</span>) · {mergedFiles.length} total assets
              </p>
            </div>

            {slotsPanel && (
              <div className="inline-flex items-center bg-[#100805] border border-[#FAF3E8]/15 rounded-lg p-0.5 ml-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'library'
                      ? 'bg-[#D97706] text-[#1A0B07]'
                      : 'text-[#E5D3BE]/80 hover:text-white'
                  }`}
                >
                  Asset Manager ({mergedFiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('slots')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'slots'
                      ? 'bg-[#D97706] text-[#1A0B07]'
                      : 'text-[#E5D3BE]/80 hover:text-white'
                  }`}
                >
                  Character &amp; Prop Slots
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {requiresKey && (
              <label className="inline-flex items-center gap-1.5 bg-[#110805] border border-[#FAF3E8]/18 rounded-lg px-2.5 py-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <input
                  type="password"
                  value={studioKey}
                  onChange={(e) => onStudioKeyChange(e.target.value)}
                  placeholder="Studio key"
                  className="bg-transparent text-xs text-[#FAF3E8] w-28 outline-none placeholder:text-[#E5D3BE]/40"
                />
              </label>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#28150E] hover:bg-[#3A1F14] border border-[#FAF3E8]/15 text-xs text-[#E5D3BE] hover:text-white cursor-pointer"
              aria-label="Close Asset Manager"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </header>

        {activeTab === 'slots' && slotsPanel ? (
          <div className="flex-1 overflow-y-auto p-4">{slotsPanel}</div>
        ) : (
          /* 3-Pane Classic Game Engine Asset Browser */
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_340px]">
            {/* LEFT PANE: Folder Explorer Tree */}
            <aside className="border-b lg:border-b-0 lg:border-r border-[#FAF3E8]/12 bg-[#120906] flex flex-col min-h-0">
              <div className="px-3 py-2.5 border-b border-[#FAF3E8]/10 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
                  Project Folders
                </span>
                <span className="text-[10px] font-mono text-[#E5D3BE]/55">
                  {mergedFolders.length} dirs
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
                {folderTree.topLevel.map((parent) => {
                  const children = folderTree.childrenByParent.get(parent) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedParents[parent] ?? true;
                  const isActiveParent = activeFolder === parent;
                  const parentCount = countInFolder(parent, hasChildren);

                  return (
                    <div key={parent} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-0.5">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedParents((prev) => ({
                                ...prev,
                                [parent]: !isExpanded,
                              }))
                            }
                            aria-label={`Toggle ${parent} subfolders`}
                            className="p-1 text-[#E5D3BE]/60 hover:text-white cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveFolder(parent)}
                          className={`flex-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                            isActiveParent
                              ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                              : 'text-[#E5D3BE]/85 hover:bg-[#23120C] hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            {isActiveParent ? (
                              <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 shrink-0 text-amber-300/80" aria-hidden="true" />
                            )}
                            <span className="truncate">{formatFolderSegmentLabel(parent)}</span>
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isActiveParent
                                ? 'bg-black/20 text-[#1A0B07]'
                                : 'bg-black/35 text-amber-200/80'
                            }`}
                          >
                            {parentCount}
                          </span>
                        </button>
                      </div>

                      {hasChildren && isExpanded && (
                        <div className="ml-5 pl-2 border-l border-[#FAF3E8]/10 flex flex-col gap-0.5 my-0.5">
                          {children.map((child) => {
                            const childName = child.slice(parent.length + 1);
                            const isActiveChild = activeFolder === child;
                            const count = countInFolder(child, false);
                            return (
                              <button
                                key={child}
                                type="button"
                                onClick={() => setActiveFolder(child)}
                                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                                  isActiveChild
                                    ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                                    : 'text-[#E5D3BE]/80 hover:bg-[#23120C] hover:text-white'
                                }`}
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {isActiveChild ? (
                                    <FolderOpen className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <Folder className="w-3 h-3 shrink-0 text-amber-300/70" aria-hidden="true" />
                                  )}
                                  <span className="truncate">{formatFolderSegmentLabel(childName)}</span>
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-1 rounded ${
                                    isActiveChild
                                      ? 'bg-black/20 text-[#1A0B07]'
                                      : 'bg-black/35 text-amber-200/75'
                                  }`}
                                >
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* New Folder Creator */}
              <form
                onSubmit={(e) => void handleCreateFolder(e)}
                className="p-2.5 border-t border-[#FAF3E8]/10 bg-[#170C08] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#E5D3BE]/65">
                    Create Folder
                  </span>
                  <select
                    value={newFolderParent}
                    onChange={(e) => setNewFolderParent(e.target.value)}
                    aria-label="Parent folder"
                    className="bg-[#100805] border border-[#FAF3E8]/15 rounded px-1.5 py-0.5 text-[10px] text-[#E5D3BE] outline-none cursor-pointer"
                  >
                    <option value="">/assets/ (root)</option>
                    <option value="worlds">/worlds/</option>
                    <option value="characters">/characters/</option>
                    <option value="props">/props/</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name..."
                    className="flex-1 min-w-0 bg-[#100805] border border-[#FAF3E8]/15 rounded-lg px-2 py-1 text-xs text-[#FAF3E8] outline-none placeholder:text-[#E5D3BE]/35 focus:border-amber-400/60"
                  />
                  <button
                    type="submit"
                    disabled={!newFolderName.trim() || uploading}
                    title="Create folder"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2C1810] hover:bg-[#3F2318] border border-amber-400/25 text-xs font-medium text-amber-200 cursor-pointer disabled:opacity-45"
                  >
                    <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </aside>

            {/* CENTER PANE: Multi-File Upload, Progress List & Visual Asset Grid */}
            <section
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) {
                  void uploadSelectedFiles(Array.from(e.dataTransfer.files), activeFolder);
                }
              }}
              className={`flex flex-col min-h-0 transition-colors ${
                dragOver ? 'bg-[#29150C]' : 'bg-[#180D09]'
              }`}
            >
              {/* Action Toolbar */}
              <div className="px-3.5 py-2.5 border-b border-[#FAF3E8]/10 bg-[#1B0F0A] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-amber-300 bg-[#100805] border border-[#FAF3E8]/12 px-2 py-1 rounded-md">
                    /assets/{activeFolder === 'worlds' ? 'worlds/kampala_compound' : activeFolder}/
                  </span>

                  {!builtinFolderSet.has(activeFolder) &&
                    countInFolder(activeFolder, true) === 0 && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteCustomFolder(activeFolder)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#2A150E] hover:bg-red-950/70 border border-red-400/25 text-[11px] text-red-300 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>Delete Empty Folder</span>
                      </button>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search
                      className="w-3.5 h-3.5 text-[#E5D3BE]/50 absolute left-2.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search assets..."
                      className="bg-[#100805] border border-[#FAF3E8]/15 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[#FAF3E8] w-40 outline-none placeholder:text-[#E5D3BE]/40 focus:border-amber-400/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleMultiFilePick()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D97706] hover:bg-[#EA8A1A] text-xs font-bold text-[#1A0B07] transition-colors cursor-pointer disabled:opacity-60 shadow"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{uploading ? 'Uploading...' : 'Upload Multi-Files'}</span>
                  </button>
                  <input
                    ref={fallbackFileInputRef}
                    type="file"
                    multiple
                    accept=".glb,.gltf,.usdz,.usd,.usda,.usdc,.zip,.png,.jpg,.jpeg,.webp,.mp3,.ogg,.wav,.m4a,.webm"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        void uploadSelectedFiles(Array.from(e.target.files), activeFolder);
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Filter Tabs + Drag Hint */}
              <div className="px-3.5 py-2 border-b border-[#FAF3E8]/8 flex flex-wrap items-center justify-between gap-2 bg-[#140B07]">
                <div className="inline-flex items-center gap-1 bg-[#0E0704] border border-[#FAF3E8]/10 rounded-lg p-0.5">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'models', label: '3D Models' },
                      { id: 'textures', label: 'Textures' },
                      { id: 'audio', label: 'Audio' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTypeFilter(tab.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        typeFilter === tab.id
                          ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                          : 'text-[#E5D3BE]/75 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-[#E5D3BE]/55">
                  Drag &amp; drop multiple <span className="text-amber-200/85">.glb / .usdz / .zip / textures</span> anywhere here
                </span>
              </div>

              {/* Upload Progress Queue List */}
              {uploadQueue.length > 0 && (
                <div className="px-3.5 py-2 border-b border-amber-400/20 bg-[#1F110B] max-h-40 overflow-y-auto flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-200">
                      Upload Queue ({uploadQueue.length})
                    </span>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => setUploadQueue([])}
                        className="text-[10px] text-[#E5D3BE]/70 hover:text-white cursor-pointer"
                      >
                        Clear list
                      </button>
                    )}
                  </div>

                  {uploadQueue.map((item) => (
                    <div
                      key={item.id}
                      className="px-2.5 py-1.5 rounded-lg bg-[#120906] border border-[#FAF3E8]/10 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {item.status === 'uploading' && (
                            <Loader2 className="w-3 h-3 text-amber-300 animate-spin shrink-0" aria-hidden="true" />
                          )}
                          {(item.status === 'saved' || item.status === 'local-vfs') && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate font-medium text-[#FAF3E8]">{item.name}</span>
                          <span className="text-[10px] text-[#E5D3BE]/50 font-mono shrink-0">
                            {formatBytesShort(item.sizeBytes)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-[#E5D3BE]/60">→ {item.folder}</span>
                          <span
                            className={`text-[10px] font-mono font-semibold ${
                              item.status === 'saved'
                                ? 'text-emerald-300'
                                : item.status === 'local-vfs'
                                  ? 'text-sky-300'
                                  : item.status === 'error'
                                    ? 'text-red-300'
                                    : 'text-amber-300'
                            }`}
                          >
                            {item.status === 'saved'
                              ? 'Saved in App'
                              : item.status === 'local-vfs'
                                ? 'Local VFS'
                                : item.status === 'queued'
                                  ? 'Queued'
                                  : item.status === 'error'
                                    ? 'Error'
                                    : `${item.progress}%`}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${
                            item.status === 'saved'
                              ? 'bg-emerald-500'
                              : item.status === 'local-vfs'
                                ? 'bg-sky-400'
                                : item.status === 'error'
                                  ? 'bg-red-500'
                                  : 'bg-[#D97706]'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      {item.error && (
                        <div className="text-[10px] text-amber-200/80">{item.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Visual Asset Cards Grid */}
              <div className="flex-1 overflow-y-auto p-3.5">
                {visibleFiles.length === 0 ? (
                  <div className="h-full min-h-[200px] border border-dashed border-[#FAF3E8]/15 rounded-xl bg-[#120906]/70 flex flex-col items-center justify-center p-6 text-center gap-2.5">
                    <Box className="w-9 h-9 text-amber-300/45" aria-hidden="true" />
                    <div className="text-sm font-medium text-[#FAF3E8]">
                      No matching assets in {formatFolderFullLabel(activeFolder)}
                    </div>
                    <p className="text-xs text-[#E5D3BE]/60 max-w-sm">
                      Click <span className="text-amber-300 font-semibold">Upload Multi-Files</span> or drag multiple `.glb`, `.usdz`, `.zip`, textures, or audio clips directly here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {visibleFiles.map((file) => {
                      const fileKey = `${file.folder}/${file.name}`;
                      const isSelected =
                        selectedFile && `${selectedFile.folder}/${selectedFile.name}` === fileKey;
                      const isImg = IMAGE_EXT_RE.test(file.ext);
                      const isModel = MODEL_EXT_RE.test(file.ext);
                      const isAud = AUDIO_EXT_RE.test(file.ext);

                      return (
                        <div
                          key={fileKey}
                          onClick={() => setSelectedFileKey(fileKey)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedFileKey(fileKey);
                            }
                          }}
                          className={`group rounded-xl border p-2.5 flex flex-col gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#2A170F] border-amber-400 shadow-lg'
                              : 'bg-[#130A07] border-[#FAF3E8]/12 hover:border-amber-400/45 hover:bg-[#1E100B]'
                          }`}
                        >
                          {/* Visual Thumbnail Frame */}
                          <div className="h-24 rounded-lg bg-[#0D0604] border border-[#FAF3E8]/10 relative overflow-hidden flex items-center justify-center">
                            {isImg ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : isModel ? (
                              <div className="flex flex-col items-center gap-1 text-amber-300/85">
                                <Box className="w-8 h-8" aria-hidden="true" />
                                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-200/80">
                                  3D {file.ext}
                                </span>
                              </div>
                            ) : isAud ? (
                              <div className="flex flex-col items-center gap-1 text-sky-300/85">
                                <Music className="w-7 h-7" aria-hidden="true" />
                                <span className="text-[10px] font-mono uppercase">Audio</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-emerald-300/85">
                                <Archive className="w-7 h-7" aria-hidden="true" />
                                <span className="text-[10px] font-mono uppercase">{file.ext}</span>
                              </div>
                            )}

                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 border border-white/10 text-[9px] font-mono font-bold uppercase text-amber-300">
                              {file.ext}
                            </span>

                            <span
                              className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                file.source === 'local-vfs'
                                  ? 'bg-sky-950/90 text-sky-200 border border-sky-400/30'
                                  : 'bg-emerald-950/90 text-emerald-200 border border-emerald-400/30'
                              }`}
                            >
                              {file.source === 'local-vfs' ? 'VFS' : 'In App'}
                            </span>
                          </div>

                          {/* Metadata & Quick Actions */}
                          <div className="min-w-0">
                            <div
                              title={file.name}
                              className="text-xs font-semibold text-[#FAF3E8] truncate"
                            >
                              {file.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#E5D3BE]/60 font-mono mt-0.5">
                              <span>{formatBytesShort(file.sizeBytes)}</span>
                              <span className="truncate max-w-[115px]">{file.folder}</span>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1 pt-1 border-t border-[#FAF3E8]/8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={file.folder}
                              onChange={(e) => void handleMoveFile(file, e.target.value)}
                              aria-label={`Move ${file.name} to folder`}
                              className="flex-1 min-w-0 bg-[#0D0604] border border-[#FAF3E8]/15 rounded px-1.5 py-1 text-[10px] text-[#E5D3BE] outline-none cursor-pointer"
                            >
                              {mergedFolders
                                .filter((tf) => tf !== 'worlds')
                                .map((tf) => (
                                  <option key={tf} value={tf} className="bg-[#1B100C] text-[#FAF3E8]">
                                    {tf === file.folder
                                      ? `In: ${formatFolderFullLabel(tf)}`
                                      : `Move -> ${formatFolderFullLabel(tf)}`}
                                  </option>
                                ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => void handleDeleteFile(file)}
                              aria-label={`Delete ${file.name}`}
                              className="p-1 rounded bg-[#24120C] hover:bg-red-950/80 border border-[#FAF3E8]/12 text-[#E5D3BE]/75 hover:text-red-300 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {statusNotice && (
                <div className="px-3.5 py-2 border-t border-[#FAF3E8]/10 bg-[#120906] text-xs text-amber-200 flex items-center justify-between gap-2">
                  <span>{statusNotice}</span>
                  <button
                    type="button"
                    onClick={() => setStatusNotice(null)}
                    className="text-[#E5D3BE]/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </section>

            {/* RIGHT PANE: Dedicated 3D Preview Window & Courtyard Slot Assignment */}
            <aside className="border-t lg:border-t-0 lg:border-l border-[#FAF3E8]/12 bg-[#140B07] flex flex-col min-h-0 overflow-y-auto p-3.5 gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
                  Asset Preview Window
                </span>
                {selectedFile && isSelectedModel && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTurntableSpin((v) => !v)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
                        turntableSpin
                          ? 'bg-[#D97706] border-amber-400 text-[#1A0B07]'
                          : 'bg-[#21110B] border-[#FAF3E8]/15 text-[#E5D3BE]'
                      }`}
                    >
                      Spin
                    </button>
                    <button
                      type="button"
                      onClick={() => setWireframeMode((v) => !v)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
                        wireframeMode
                          ? 'bg-[#D97706] border-amber-400 text-[#1A0B07]'
                          : 'bg-[#21110B] border-[#FAF3E8]/15 text-[#E5D3BE]'
                      }`}
                    >
                      Wire
                    </button>
                    <button
                      type="button"
                      onClick={() => previewRigRef.current?.fitCamera()}
                      title="Reset camera framing"
                      className="p-1 rounded bg-[#21110B] hover:bg-[#321B12] border border-[#FAF3E8]/15 text-[#E5D3BE] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {/* Dedicated Viewport Box */}
              <div className="relative h-60 w-full rounded-xl overflow-hidden border border-[#FAF3E8]/15 bg-[#0D0604] shrink-0">
                <div
                  ref={previewMountRef}
                  className={`absolute inset-0 ${isSelectedModel ? 'block' : 'hidden'}`}
                />

                {!selectedFile && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 gap-1.5 text-[#E5D3BE]/55">
                    <Box className="w-8 h-8 text-amber-300/35" aria-hidden="true" />
                    <span className="text-xs">Select an asset card to inspect it</span>
                  </div>
                )}

                {selectedFile && isSelectedModel && previewLoading && (
                  <div className="absolute inset-0 bg-[#0D0604]/80 flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <Loader2 className="w-6 h-6 text-amber-300 animate-spin" aria-hidden="true" />
                    <span className="text-xs text-amber-200">Loading 3D preview...</span>
                  </div>
                )}

                {selectedFile && isSelectedModel && previewError && (
                  <div className="absolute inset-0 bg-[#1B0A08]/90 flex flex-col items-center justify-center p-4 text-center gap-1">
                    <span className="text-xs font-semibold text-red-300">Preview Unavailable</span>
                    <span className="text-[11px] text-[#E5D3BE]/75">{previewError}</span>
                  </div>
                )}

                {selectedFile && isSelectedImage && (
                  <div className="absolute inset-0 flex items-center justify-center p-2 bg-[#0D0604]">
                    <img
                      src={selectedFile.url}
                      alt={selectedFile.name}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
                      }}
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                )}

                {selectedFile && isSelectedAudio && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-3 bg-[#0D0604]">
                    <Music className="w-10 h-10 text-sky-300" aria-hidden="true" />
                    <audio controls src={selectedFile.url} className="w-full" />
                  </div>
                )}

                {selectedFile && !isSelectedModel && !isSelectedImage && !isSelectedAudio && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center gap-2 bg-[#0D0604]">
                    <Archive className="w-10 h-10 text-emerald-300/80" aria-hidden="true" />
                    <span className="text-xs text-[#E5D3BE]/80">
                      Archive package stored safely in {selectedFile.folder}
                    </span>
                  </div>
                )}

                {selectedFile && isSelectedModel && !previewLoading && !previewError && (
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-[#E5D3BE]/80 pointer-events-none">
                    Drag to orbit · Scroll to zoom
                  </span>
                )}
              </div>

              {/* Inspector Details */}
              {selectedFile && (
                <div className="rounded-xl bg-[#1C0F0A] border border-[#FAF3E8]/12 p-3 flex flex-col gap-2">
                  <div className="text-xs font-bold text-[#FAF3E8] break-all">
                    {selectedFile.name}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="bg-[#110805] rounded-lg px-2.5 py-1.5 border border-[#FAF3E8]/8">
                      <div className="text-[10px] text-[#E5D3BE]/55">Folder</div>
                      <div className="font-mono text-amber-200 truncate">{selectedFile.folder}</div>
                    </div>
                    <div className="bg-[#110805] rounded-lg px-2.5 py-1.5 border border-[#FAF3E8]/8">
                      <div className="text-[10px] text-[#E5D3BE]/55">Size</div>
                      <div className="font-mono text-[#FAF3E8]">{formatBytesShort(selectedFile.sizeBytes)}</div>
                    </div>
                  </div>

                  {previewStats && (
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <div className="bg-[#110805] rounded-lg px-2 py-1.5 border border-[#FAF3E8]/8">
                        <div className="text-[10px] text-[#E5D3BE]/55">Meshes</div>
                        <div className="font-mono text-[#FAF3E8]">{previewStats.meshes}</div>
                      </div>
                      <div className="bg-[#110805] rounded-lg px-2 py-1.5 border border-[#FAF3E8]/8">
                        <div className="text-[10px] text-[#E5D3BE]/55">Materials</div>
                        <div className="font-mono text-[#FAF3E8]">{previewStats.materials}</div>
                      </div>
                      <div className="bg-[#110805] rounded-lg px-2 py-1.5 border border-[#FAF3E8]/8">
                        <div className="text-[10px] text-[#E5D3BE]/55">Clips</div>
                        <div className="font-mono text-[#FAF3E8]">{previewStats.animations}</div>
                      </div>
                      <div className="col-span-3 bg-[#110805] rounded-lg px-2.5 py-1.5 border border-[#FAF3E8]/8 flex items-center justify-between">
                        <span className="text-[10px] text-[#E5D3BE]/55">Raw Bounds (W × H × D)</span>
                        <span className="font-mono text-[10px] text-amber-200">
                          {previewStats.width.toFixed(2)} × {previewStats.height.toFixed(2)} × {previewStats.depth.toFixed(2)} m
                        </span>
                      </div>
                    </div>
                  )}

                  {imageDims && (
                    <div className="bg-[#110805] rounded-lg px-2.5 py-1.5 border border-[#FAF3E8]/8 flex items-center justify-between text-[11px]">
                      <span className="text-[#E5D3BE]/55 inline-flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" aria-hidden="true" />
                        <span>Resolution</span>
                      </span>
                      <span className="font-mono text-amber-200">
                        {imageDims.w} × {imageDims.h} px
                      </span>
                    </div>
                  )}

                  {/* Apply to Live Courtyard Slot */}
                  {onApplyToSlot && (isSelectedModel || isSelectedImage) && (
                    <div className="pt-2 border-t border-[#FAF3E8]/10 flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>Load into Live Courtyard Slot</span>
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {QUICK_SLOT_TARGETS.filter(
                          (t) => isSelectedModel || t.kind === 'any'
                        ).map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            disabled={Boolean(applyingSlot)}
                            onClick={() => void handleApplySelectedToSlot(target.id)}
                            className="px-2 py-1.5 rounded-lg bg-[#28150D] hover:bg-[#D97706] hover:text-[#1A0B07] border border-[#FAF3E8]/15 text-[11px] font-medium text-[#FAF3E8] transition-colors cursor-pointer disabled:opacity-50 text-left truncate"
                          >
                            {applyingSlot === target.id ? 'Applying...' : target.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};
