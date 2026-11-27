import { useCallback, useEffect, useRef, useState } from 'react';

export type TiltStatus =
  | 'disabled'
  | 'needs_permission'
  | 'calibrating'
  | 'active'
  | 'denied'
  | 'unsupported';

interface UseDeviceTiltOptions {
  enabled: boolean;
  sensitivity: number; // 0.5 .. 2.0
  smoothing: number; // 0.15 .. 0.95
  invert: boolean;
  onAxisChange: (axis: number) => void;
  onUnavailableOrDenied?: () => void;
}

export interface UseDeviceTiltResult {
  supported: boolean;
  requiresPermission: boolean;
  status: TiltStatus;
  axis: number;
  rawDeltaDeg: number;
  requestAndEnable: () => Promise<boolean>;
  calibrate: () => void;
}

type DeviceOrientationStaticWithPerm = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

function getScreenOrientationAngle(): number {
  if (typeof window === 'undefined') return 0;
  const raw =
    window.screen?.orientation?.angle ??
    (window as unknown as { orientation?: number }).orientation ??
    0;
  const norm = ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
  return norm;
}

function extractLateralRollDeg(beta: number | null, gamma: number | null): number | null {
  if (typeof beta !== 'number' || typeof gamma !== 'number') return null;
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const angle = getScreenOrientationAngle();
  switch (angle) {
    case 90:
      return beta;
    case 270:
      return -beta;
    case 180:
      return -gamma;
    case 0:
    default:
      return gamma;
  }
}

const DEADZONE_DEG = 2.2;
const BASE_FULL_TILT_DEG = 26;

export function useDeviceTilt({
  enabled,
  sensitivity,
  smoothing,
  invert,
  onAxisChange,
  onUnavailableOrDenied,
}: UseDeviceTiltOptions): UseDeviceTiltResult {
  const supported =
    typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';

  const requiresPermission =
    supported &&
    typeof (window.DeviceOrientationEvent as DeviceOrientationStaticWithPerm)
      .requestPermission === 'function';

  const [permissionGranted, setPermissionGranted] = useState<boolean>(() => !requiresPermission);
  const [status, setStatus] = useState<TiltStatus>(() => {
    if (!supported) return 'unsupported';
    if (!enabled) return 'disabled';
    return requiresPermission ? 'needs_permission' : 'calibrating';
  });
  const [axisUi, setAxisUi] = useState(0);
  const [rawDeltaDeg, setRawDeltaDeg] = useState(0);

  const baselineRollRef = useRef<number | null>(null);
  const lastRawRollRef = useRef<number | null>(null);
  const smoothedAxisRef = useRef(0);
  const lastUiSyncRef = useRef(0);

  const onAxisChangeRef = useRef(onAxisChange);
  onAxisChangeRef.current = onAxisChange;
  const onUnavailableRef = useRef(onUnavailableOrDenied);
  onUnavailableRef.current = onUnavailableOrDenied;

  const settingsRef = useRef({ sensitivity, smoothing, invert });
  settingsRef.current = { sensitivity, smoothing, invert };

  const calibrate = useCallback(() => {
    if (lastRawRollRef.current !== null) {
      baselineRollRef.current = lastRawRollRef.current;
    } else {
      baselineRollRef.current = null;
    }
    smoothedAxisRef.current = 0;
    setAxisUi(0);
    setRawDeltaDeg(0);
    onAxisChangeRef.current(0);
  }, []);

  const requestAndEnable = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setStatus('unsupported');
      onAxisChangeRef.current(0);
      return false;
    }
    if (requiresPermission) {
      try {
        const permFn = (window.DeviceOrientationEvent as DeviceOrientationStaticWithPerm)
          .requestPermission;
        if (permFn) {
          const result = await permFn();
          if (result !== 'granted') {
            setPermissionGranted(false);
            setStatus('denied');
            onAxisChangeRef.current(0);
            onUnavailableRef.current?.();
            return false;
          }
        }
        setPermissionGranted(true);
      } catch {
        setPermissionGranted(false);
        setStatus('denied');
        onAxisChangeRef.current(0);
        onUnavailableRef.current?.();
        return false;
      }
    }
    baselineRollRef.current = null;
    smoothedAxisRef.current = 0;
    setStatus('calibrating');
    return true;
  }, [supported, requiresPermission]);

  useEffect(() => {
    if (!enabled) {
      baselineRollRef.current = null;
      smoothedAxisRef.current = 0;
      setAxisUi(0);
      setRawDeltaDeg(0);
      onAxisChangeRef.current(0);
      setStatus(supported ? 'disabled' : 'unsupported');
      return;
    }

    if (!supported) {
      setStatus('unsupported');
      onAxisChangeRef.current(0);
      return;
    }

    if (requiresPermission && !permissionGranted) {
      setStatus('needs_permission');
      onAxisChangeRef.current(0);
      return;
    }

    let gotSample = false;
    setStatus('calibrating');

    const timeoutId = window.setTimeout(() => {
      if (!gotSample) {
        setStatus('unsupported');
        onAxisChangeRef.current(0);
      }
    }, 1500);

    const handleOrientation = (ev: DeviceOrientationEvent) => {
      const roll = extractLateralRollDeg(ev.beta, ev.gamma);
      if (roll === null) return;

      lastRawRollRef.current = roll;
      if (!gotSample) {
        gotSample = true;
        window.clearTimeout(timeoutId);
        setStatus('active');
      }

      if (baselineRollRef.current === null) {
        baselineRollRef.current = roll;
      }

      let delta = roll - baselineRollRef.current;
      // Handle wraparound around ±180 when phone approaches vertical landscape edge
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      const { sensitivity: sens, smoothing: smooth, invert: inv } = settingsRef.current;
      if (inv) delta = -delta;

      const absDelta = Math.abs(delta);
      let normalized = 0;
      if (absDelta > DEADZONE_DEG) {
        const effectiveRange = Math.max(8, BASE_FULL_TILT_DEG / Math.max(0.5, sens));
        const mag = Math.min(1, (absDelta - DEADZONE_DEG) / effectiveRange);
        normalized = delta > 0 ? mag : -mag;
      }

      const alpha = Math.max(0.08, Math.min(0.85, 1 - smooth * 0.82));
      const nextSmoothed =
        smoothedAxisRef.current + (normalized - smoothedAxisRef.current) * alpha;
      const clamped = Math.abs(nextSmoothed) < 0.015 ? 0 : Math.max(-1, Math.min(1, nextSmoothed));

      smoothedAxisRef.current = clamped;
      onAxisChangeRef.current(clamped);

      const now = performance.now();
      if (now - lastUiSyncRef.current >= 55) {
        lastUiSyncRef.current = now;
        setAxisUi(clamped);
        setRawDeltaDeg(Math.round(delta));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('deviceorientation', handleOrientation);
      onAxisChangeRef.current(0);
    };
  }, [enabled, supported, requiresPermission, permissionGranted]);

  return {
    supported,
    requiresPermission,
    status,
    axis: axisUi,
    rawDeltaDeg,
    requestAndEnable,
    calibrate,
  };
}
