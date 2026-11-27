import React, { useEffect } from 'react';
import {
  Camera,
  CloudRain,
  Crosshair,
  ExternalLink,
  Gamepad2,
  Monitor,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react';
import { TiltStatus } from '../hooks/useDeviceTilt';
import { Link } from '../router';
import {
  DEFAULT_SETTINGS,
  DefaultMatchCamera,
  GraphicsQuality,
  QUALITY_PRESET_VALUES,
  SonkoSettings,
  TouchControlsMode,
} from '../game/settings';

interface SettingsModalProps {
  settings: SonkoSettings;
  onUpdateSettings: (patch: Partial<SonkoSettings>) => void;
  onResetDefaults: () => void;
  onClose: () => void;
  tiltSupported?: boolean;
  tiltStatus?: TiltStatus;
  onRequestTiltEnable?: () => Promise<boolean>;
  onCalibrateTilt?: () => void;
}

const PIXEL_DENSITY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.75, label: '0.75x Saver' },
  { value: 1, label: '1.0x Standard' },
  { value: 1.25, label: '1.25x Crisp' },
  { value: 2, label: '2.0x Ultra' },
];

const CAMERA_OPTIONS: Array<{ id: DefaultMatchCamera; label: string; desc: string }> = [
  { id: 'play', label: 'Dynamic', desc: 'Follows hops & stone throws smoothly' },
  { id: 'aim_target', label: 'Aim Focus', desc: 'Low angle aimed at target square' },
  { id: 'top_aim', label: 'Top-Down', desc: 'Overhead court & chalk boundary view' },
];

const TOUCH_MODE_OPTIONS: Array<{ id: TouchControlsMode; label: string; desc: string }> = [
  { id: 'auto', label: 'Auto', desc: 'Shows on phones & tablets' },
  { id: 'always', label: 'Always On', desc: 'Enable on touchscreen laptops too' },
  { id: 'off', label: 'Off', desc: 'Keyboard & mouse / direct tap only' },
];

export function SettingsModal({
  settings,
  onUpdateSettings,
  onResetDefaults,
  onClose,
  tiltSupported = true,
  tiltStatus = 'disabled',
  onRequestTiltEnable,
  onCalibrateTilt,
}: SettingsModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleQualityPreset = (quality: GraphicsQuality) => {
    const preset = QUALITY_PRESET_VALUES[quality];
    onUpdateSettings({
      graphicsQuality: quality,
      shadowsEnabled: preset.shadowsEnabled,
      dustEnabled: preset.dustEnabled,
      pixelRatioScale: preset.pixelRatioScale,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#22110B] border border-[#FAF3E8]/20 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12 bg-[#1A0B07]">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8]">Settings</h2>
            <p className="text-xs text-[#E5D3BE]/75 mt-0.5">
              Audio, 3D courtyard performance, camera behavior, and controls
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-xs font-medium text-[#E5D3BE] hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Settings"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* 1. Audio & Voices */}
          <section className="bg-[#190C08] border border-[#FAF3E8]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <h3 className="font-display font-bold text-base text-[#FAF3E8]">Audio &amp; Voices</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#E5D3BE]">Sound Effects Volume</span>
                  <span className="font-mono-num text-amber-300 font-semibold">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings.sfxVolume * 100)}
                  onChange={(e) => onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })}
                  className="accent-[#F59E0B] cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#E5D3BE]">Voice &amp; Dialogue Volume</span>
                  <span className="font-mono-num text-amber-300 font-semibold">
                    {Math.round(settings.voiceVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings.voiceVolume * 100)}
                  onChange={(e) => onUpdateSettings({ voiceVolume: Number(e.target.value) / 100 })}
                  className="accent-[#F59E0B] cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#FAF3E8]/10">
              <div>
                <div className="text-sm font-medium text-[#FAF3E8]">Character Subtitles</div>
                <div className="text-xs text-[#E5D3BE]/65">
                  Display floating 3D speech bubbles above characters during matches
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.subtitlesEnabled}
                onClick={() => onUpdateSettings({ subtitlesEnabled: !settings.subtitlesEnabled })}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.subtitlesEnabled
                    ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07]'
                    : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75 hover:text-white'
                }`}
              >
                {settings.subtitlesEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </section>

          {/* 2. Graphics & Performance */}
          <section className="bg-[#190C08] border border-[#FAF3E8]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <h3 className="font-display font-bold text-base text-[#FAF3E8]">
                Graphics &amp; Performance
              </h3>
            </div>

            <div>
              <div className="text-xs font-medium text-[#E5D3BE]/80 mb-2">Quality Preset</div>
              <div className="grid grid-cols-3 gap-2 p-1 bg-[#120805] border border-[#FAF3E8]/12 rounded-lg">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQualityPreset(q)}
                    className={`py-2 px-3 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      settings.graphicsQuality === q
                        ? 'bg-[#D97706] text-[#1A0B07]'
                        : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center justify-between gap-3 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3.5 py-2.5">
                <div>
                  <div className="text-xs font-semibold text-[#FAF3E8]">Sunlight Shadows</div>
                  <div className="text-[11px] text-[#E5D3BE]/60">Soft ground &amp; character shadows</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.shadowsEnabled}
                  onClick={() => onUpdateSettings({ shadowsEnabled: !settings.shadowsEnabled })}
                  className={`px-3 py-1 rounded-md text-xs font-semibold border cursor-pointer ${
                    settings.shadowsEnabled
                      ? 'bg-emerald-500/90 border-emerald-400 text-[#0B1910]'
                      : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75'
                  }`}
                >
                  {settings.shadowsEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3.5 py-2.5">
                <div>
                  <div className="text-xs font-semibold text-[#FAF3E8]">Courtyard Dust Motes</div>
                  <div className="text-[11px] text-[#E5D3BE]/60">Floating sun-lit dust particles</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.dustEnabled}
                  onClick={() => onUpdateSettings({ dustEnabled: !settings.dustEnabled })}
                  className={`px-3 py-1 rounded-md text-xs font-semibold border cursor-pointer ${
                    settings.dustEnabled
                      ? 'bg-emerald-500/90 border-emerald-400 text-[#0B1910]'
                      : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75'
                  }`}
                >
                  {settings.dustEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <div className="sm:col-span-2 flex items-center justify-between gap-3 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3.5 py-2.5">
                <div className="flex items-start gap-2.5">
                  <CloudRain className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold text-[#FAF3E8]">Dynamic Weather</div>
                    <div className="text-[11px] text-[#E5D3BE]/60">
                      Scale rain intensity, fog density, mist &amp; synced tree wind from match weather conditions
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.dynamicWeather}
                  onClick={() => onUpdateSettings({ dynamicWeather: !settings.dynamicWeather })}
                  className={`px-3 py-1 rounded-md text-xs font-semibold border cursor-pointer shrink-0 ${
                    settings.dynamicWeather
                      ? 'bg-emerald-500/90 border-emerald-400 text-[#0B1910]'
                      : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75'
                  }`}
                >
                  {settings.dynamicWeather ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-[#E5D3BE]/80 mb-2">
                Pixel Density / Scaling
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#120805] border border-[#FAF3E8]/12 rounded-lg">
                {PIXEL_DENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateSettings({ pixelRatioScale: opt.value })}
                    className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      settings.pixelRatioScale === opt.value
                        ? 'bg-[#FAF3E8] text-[#1A0B07] font-semibold'
                        : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Gameplay & Camera */}
          <section className="bg-[#190C08] border border-[#FAF3E8]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <h3 className="font-display font-bold text-base text-[#FAF3E8]">
                Gameplay &amp; Camera
              </h3>
            </div>

            <div>
              <div className="text-xs font-medium text-[#E5D3BE]/80 mb-2">
                Default Match Camera
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CAMERA_OPTIONS.map((cam) => {
                  const active = settings.defaultCamera === cam.id;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => onUpdateSettings({ defaultCamera: cam.id })}
                      className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#341A11] border-amber-400 text-[#FAF3E8]'
                          : 'bg-[#120805] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:border-[#FAF3E8]/30'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#FAF3E8]">{cam.label}</div>
                      <div className="text-[11px] text-[#E5D3BE]/65 mt-0.5">{cam.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#FAF3E8]/10">
              <div>
                <div className="text-sm font-medium text-[#FAF3E8]">Camera Shake on Fouls</div>
                <div className="text-xs text-[#E5D3BE]/65">
                  Subtle impact jolt when stepping on a line or losing balance
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.cameraShake}
                onClick={() => onUpdateSettings({ cameraShake: !settings.cameraShake })}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.cameraShake
                    ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07]'
                    : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75 hover:text-white'
                }`}
              >
                {settings.cameraShake ? 'On' : 'Off'}
              </button>
            </div>

            {/* Touch & Motion Tilt Controls */}
            <div className="pt-3 border-t border-[#FAF3E8]/10 flex flex-col gap-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Touch &amp; Device Tilt Controls</span>
              </div>

              <div>
                <div className="text-xs font-medium text-[#E5D3BE]/80 mb-2">
                  Virtual Touch Controls
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {TOUCH_MODE_OPTIONS.map((opt) => {
                    const active = settings.touchControlsMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onUpdateSettings({ touchControlsMode: opt.id })}
                        className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#341A11] border-amber-400 text-[#FAF3E8]'
                            : 'bg-[#120805] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:border-[#FAF3E8]/30'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[#FAF3E8]">{opt.label}</div>
                        <div className="text-[11px] text-[#E5D3BE]/65 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3.5 py-3">
                <div>
                  <div className="text-sm font-medium text-[#FAF3E8]">
                    Device Tilt Steering (Optional)
                  </div>
                  <div className="text-xs text-[#E5D3BE]/65">
                    Tilt phone left or right to balance on one foot &amp; fine-tune aim
                  </div>
                  {settings.tiltEnabled &&
                    (tiltStatus === 'denied' || tiltStatus === 'unsupported' || !tiltSupported) && (
                      <div className="text-[11px] text-amber-300 mt-1">
                        Motion sensor unavailable or permission denied — falling back cleanly to touch controls.
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {settings.tiltEnabled && tiltStatus === 'active' && onCalibrateTilt && (
                    <button
                      type="button"
                      onClick={onCalibrateTilt}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#26140D] hover:bg-[#381E14] border border-amber-400/35 text-xs font-semibold text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Calibrate</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.tiltEnabled}
                    onClick={() => {
                      if (settings.tiltEnabled) {
                        onUpdateSettings({ tiltEnabled: false });
                      } else if (onRequestTiltEnable) {
                        void onRequestTiltEnable().then((ok) => {
                          onUpdateSettings({ tiltEnabled: ok });
                        });
                      } else {
                        onUpdateSettings({ tiltEnabled: true });
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      settings.tiltEnabled
                        ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07]'
                        : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75 hover:text-white'
                    }`}
                  >
                    {settings.tiltEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>

              {settings.tiltEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3.5 py-3">
                  <label className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#E5D3BE]">Tilt Sensitivity</span>
                      <span className="font-mono-num text-amber-300 font-semibold">
                        {settings.tiltSensitivity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={settings.tiltSensitivity}
                      onChange={(e) =>
                        onUpdateSettings({ tiltSensitivity: Number(e.target.value) })
                      }
                      className="accent-[#F59E0B] cursor-pointer"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#E5D3BE]">Tilt Smoothing</span>
                      <span className="font-mono-num text-amber-300 font-semibold">
                        {Math.round(settings.tiltSmoothing * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={0.95}
                      step={0.05}
                      value={settings.tiltSmoothing}
                      onChange={(e) =>
                        onUpdateSettings({ tiltSmoothing: Number(e.target.value) })
                      }
                      className="accent-[#F59E0B] cursor-pointer"
                    />
                  </label>

                  <div className="sm:col-span-2 flex items-center justify-between gap-4 pt-2 border-t border-[#FAF3E8]/10">
                    <span className="text-xs font-medium text-[#E5D3BE]">
                      Invert Left / Right Tilt
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.tiltInvert}
                      onClick={() => onUpdateSettings({ tiltInvert: !settings.tiltInvert })}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                        settings.tiltInvert
                          ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07]'
                          : 'bg-[#26140D] border-[#FAF3E8]/15 text-[#E5D3BE]/75 hover:text-white'
                      }`}
                    >
                      {settings.tiltInvert ? 'Inverted' : 'Standard'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls Reference */}
            <div className="pt-2 border-t border-[#FAF3E8]/10">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200 mb-2.5">
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Controls Reference</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { action: 'Aim & Charge Toss', keys: 'Hold Click / Space or Touch Pad' },
                  { action: 'Hop Squares', keys: 'Click Tile, Space, W/S, or Tap Hop' },
                  { action: 'Steer Aim / Balance', keys: 'A/D, Arrows, Stick, or Tilt' },
                  { action: 'Scoop River Stone', keys: 'E, Enter, Space, Click, or Tap Scoop' },
                  { action: 'Switch Match Camera', keys: 'C Key or Camera Button' },
                  { action: 'Orbit / View Dock', keys: 'Right-Drag / 2-Finger · H Key' },
                ].map((item) => (
                  <div
                    key={item.action}
                    className="flex items-center justify-between gap-2 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3 py-2"
                  >
                    <span className="text-[#E5D3BE]/80">{item.action}</span>
                    <span className="font-mono-num text-[11px] font-semibold text-amber-200 text-right">
                      {item.keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Privacy, Ads & Information */}
          <section className="bg-[#190C08] border border-[#FAF3E8]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <h3 className="font-display font-bold text-base text-[#FAF3E8]">
                Privacy, Ads &amp; Information
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#120805] border border-[#FAF3E8]/10 rounded-lg px-3.5 py-3">
              <div>
                <div className="text-xs font-semibold text-[#FAF3E8]">Google Ad Personalization</div>
                <div className="text-[11px] text-[#E5D3BE]/65">
                  Choose whether optional sponsor spots &amp; breaks may use ad personalization cookies
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#1B0D08] border border-[#FAF3E8]/12 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ adPersonalizationConsent: 'personalized' })}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    settings.adPersonalizationConsent !== 'non_personalized'
                      ? 'bg-[#D97706] text-[#1A0B07]'
                      : 'text-[#E5D3BE]/80 hover:text-white'
                  }`}
                >
                  Personalized
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ adPersonalizationConsent: 'non_personalized' })}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    settings.adPersonalizationConsent === 'non_personalized'
                      ? 'bg-emerald-500/90 text-[#0B1910]'
                      : 'text-[#E5D3BE]/80 hover:text-white'
                  }`}
                >
                  Non-Personalized
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {[
                { href: '/how-to-play', label: 'How to Play' },
                { href: '/about', label: 'About Sonko' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms of Use' },
                { href: '/contact', label: 'Contact Us' },
              ].map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#120805] hover:bg-[#26140D] border border-[#FAF3E8]/15 text-amber-200 hover:text-amber-100 font-medium transition-colors"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="w-3 h-3 opacity-75" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#FAF3E8]/12 bg-[#1A0B07] flex items-center justify-between text-xs text-[#E5D3BE]/70">
          <span>
            Saved automatically ·{' '}
            {settings.graphicsQuality === DEFAULT_SETTINGS.graphicsQuality &&
            settings.shadowsEnabled === DEFAULT_SETTINGS.shadowsEnabled &&
            settings.dynamicWeather === DEFAULT_SETTINGS.dynamicWeather
              ? 'Ready for play'
              : 'Custom profile active'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
