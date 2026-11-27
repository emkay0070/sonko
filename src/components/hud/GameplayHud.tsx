import React from 'react';
import {
  Camera,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  Crosshair,
  Footprints,
  Gamepad2,
  Globe,
  Pause,
  Smartphone,
  Sun,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { TiltStatus } from '../../hooks/useDeviceTilt';
import { CourtVenueSpec } from '../../game/progression';
import { HudSnapshot } from '../../game/types';
import { CompoundCameraPreset } from '../UgandanCompoundViewport';
import { TouchActionPad } from './TouchActionPad';
import { VirtualJoystick } from './VirtualJoystick';

interface GameplayHudProps {
  hud: HudSnapshot;
  activeVenueSpec: CourtVenueSpec;
  arrivalPlaying: boolean;
  matchCamera: CompoundCameraPreset;
  onChangeMatchCamera: (preset: CompoundCameraPreset) => void;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  showTouchControls: boolean;
  canToggleTouchControls: boolean;
  onToggleTouchControls: () => void;
  tiltEnabled: boolean;
  tiltSupported: boolean;
  tiltStatus: TiltStatus;
  onToggleTilt: () => void;
  onCalibrateTilt: () => void;
  onTouchAxisChange: (x: number) => void;
  onStartAimCharge: () => void;
  onReleaseAimCharge: () => void;
  onCancelAimCharge: () => void;
  onTriggerAction: () => void;
}

const SURFACE_GLASS =
  'bg-[#140A06]/62 border border-[#FAF3E8]/15 shadow-[inset_0_1px_0_rgba(255,248,235,0.08)]';
const SURFACE_BTN =
  'bg-[#140A06]/62 hover:bg-[#24130C]/78 border border-[#FAF3E8]/15 shadow-[inset_0_1px_0_rgba(255,248,235,0.08)]';

export function GameplayHud({
  hud,
  activeVenueSpec,
  arrivalPlaying,
  matchCamera,
  onChangeMatchCamera,
  muted,
  onToggleMute,
  onPause,
  showTouchControls,
  canToggleTouchControls,
  onToggleTouchControls,
  tiltEnabled,
  tiltSupported,
  tiltStatus,
  onToggleTilt,
  onCalibrateTilt,
  onTouchAxisChange,
  onStartAimCharge,
  onReleaseAimCharge,
  onCancelAimCharge,
  onTriggerAction,
}: GameplayHudProps) {
  const activePlayer = hud.players[hud.activePlayerIndex] ?? hud.players[0];
  const isLocalTurn =
    !activePlayer?.isBot &&
    (hud.mode !== 'ONLINE_1V1' || hud.activePlayerIndex === hud.onlineLocalSlot);
  const isAimPhase = hud.phase === 'TOSS_AIM' || hud.phase === 'CLAIM_AIM';
  const isHopPhase =
    hud.phase === 'HOP_OUT' ||
    hud.phase === 'HOP_BACK' ||
    hud.phase === 'PICKUP_STONE' ||
    hud.phase === 'HOP_EXIT';

  const balanceTextColor =
    hud.balance >= 70
      ? 'text-emerald-300'
      : hud.balance >= 40
        ? 'text-amber-300'
        : 'text-red-300';
  const balanceStateLabel =
    hud.balance >= 70 ? 'Steady' : hud.balance >= 40 ? 'Wobble' : 'Falling';

  const swayPct = 50 + Math.max(-1, Math.min(1, hud.balanceSway ?? 0)) * 44;

  const cycleCamera = () => {
    const quickPresets: CompoundCameraPreset[] = ['play', 'aim_target', 'top_aim', 'courtyard'];
    const idx = quickPresets.indexOf(matchCamera);
    const next = quickPresets[(idx + 1) % quickPresets.length];
    onChangeMatchCamera(next);
  };

  const showTiltControls = tiltSupported || tiltEnabled;

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 lg:p-5 [@media(max-height:480px)]:p-2"
      style={{
        paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.625rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.625rem, env(safe-area-inset-right))',
      }}
    >
      {/* TOP PERIMETER + CONTEXTUAL STATUS STRIP */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          {/* Top-Left: Translucent Match Scoreboard */}
          <div
            className={`${SURFACE_GLASS} rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 flex flex-col gap-1 max-w-[54vw] sm:max-w-none`}
          >
            {hud.mode === 'TEAM_2V2' ? (
              ([0, 1] as const).map((teamId) => {
                const isTeamTurn = activePlayer?.teamId === teamId;
                const teamHouses = Object.values(hud.houses).filter((o) => o === teamId).length;
                const teamLabel = teamId === 0 ? 'Cranes' : 'Waves';
                return (
                  <div
                    key={teamId}
                    className={`flex items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs ${
                      isTeamTurn ? 'text-[#FAF3E8] font-semibold' : 'text-[#E5D3BE]/65'
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm shrink-0 ${
                        teamId === 0 ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[92px] sm:max-w-[160px]">
                      {isTeamTurn ? activePlayer.name : teamLabel}
                    </span>
                    {isTeamTurn && (
                      <span className="text-[10px] font-mono-num text-amber-300">TURN</span>
                    )}
                    <span aria-hidden="true" className="text-[#FAF3E8]/25">
                      ·
                    </span>
                    <span className="font-mono-num whitespace-nowrap">
                      Sq {hud.teamTargets[teamId]}/{hud.courtSize}
                    </span>
                    <span aria-hidden="true" className="hidden sm:inline text-[#FAF3E8]/25">
                      ·
                    </span>
                    <span className="hidden sm:inline font-mono-num whitespace-nowrap">
                      H {teamHouses}
                    </span>
                    <span aria-hidden="true" className="text-[#FAF3E8]/25">
                      ·
                    </span>
                    <span className="font-mono-num text-amber-200 whitespace-nowrap">
                      {hud.teamScores[teamId]}p
                    </span>
                  </div>
                );
              })
            ) : (
              hud.players.map((p, idx) => {
                const isTurn = hud.activePlayerIndex === idx;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs ${
                      isTurn ? 'text-[#FAF3E8] font-semibold' : 'text-[#E5D3BE]/65'
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm shrink-0 ${
                        p.teamId === 0 ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[78px] sm:max-w-[120px]">{p.name}</span>
                    {isTurn && (
                      <span className="text-[10px] font-mono-num text-amber-300">TURN</span>
                    )}
                    <span aria-hidden="true" className="text-[#FAF3E8]/25">
                      ·
                    </span>
                    <span className="font-mono-num whitespace-nowrap">
                      Sq {p.targetSquare}/{hud.courtSize}
                    </span>
                    <span aria-hidden="true" className="hidden sm:inline text-[#FAF3E8]/25">
                      ·
                    </span>
                    <span className="hidden sm:inline font-mono-num whitespace-nowrap">
                      Houses {p.housesOwned.length}
                    </span>
                    <span aria-hidden="true" className="text-[#FAF3E8]/25">
                      ·
                    </span>
                    <span className="font-mono-num text-amber-200 whitespace-nowrap">
                      {p.score} pts
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Top-Right: Condition Readout + Tilt/Touch/Camera/Audio/Pause */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap pointer-events-auto">
            {hud.mode === 'ONLINE_1V1' && hud.onlineRoomCode && (
              <div
                className={`hidden sm:flex items-center gap-1.5 ${SURFACE_GLASS} border-amber-400/30 rounded-xl px-2.5 py-2 text-xs`}
              >
                <Globe className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span className="font-mono-num font-semibold text-amber-200">
                  {hud.onlineRoomCode}
                </span>
                {hud.onlineOpponentConnected === false && (
                  <span className="text-red-300">· Reconnecting</span>
                )}
              </div>
            )}

            {/* Venue + Weather + Wind (md+ full, <md compact wind badge if windy) */}
            <div
              className={`hidden md:flex items-center gap-2 ${SURFACE_GLASS} rounded-xl px-3 py-2 text-xs`}
            >
              <span className="font-semibold text-[#FAF3E8]">{activeVenueSpec.shortName}</span>
              <span aria-hidden="true" className="text-[#FAF3E8]/25">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-amber-200 font-medium">
                {hud.weatherCondition === 'storm_shower' ? (
                  <CloudRain className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                ) : hud.weatherCondition === 'light_rain' ? (
                  <CloudDrizzle className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                ) : hud.weatherCondition === 'misty_dew' ? (
                  <CloudFog className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                ) : hud.weatherCondition === 'breezy' ? (
                  <Wind className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                )}
                <span>{hud.weatherLabel}</span>
              </span>
              {Math.abs(hud.windX) > 0.008 && (
                <>
                  <span aria-hidden="true" className="text-[#FAF3E8]/25">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-sky-300 font-mono-num">
                    <Wind className="w-3 h-3" aria-hidden="true" />
                    <span>
                      {hud.windX >= 0 ? '→' : '←'} {Math.round(Math.abs(hud.windX) * 100)}
                    </span>
                  </span>
                </>
              )}
              {hud.puddleSquares.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#FAF3E8]/25">
                    ·
                  </span>
                  <span className="text-sky-200 font-mono-num">
                    {hud.puddleSquares.length} Puddles
                  </span>
                </>
              )}
            </div>

            {Math.abs(hud.windX) > 0.008 && (
              <div
                className={`flex md:hidden items-center gap-1 ${SURFACE_GLASS} rounded-xl px-2.5 min-h-[44px] text-[11px] text-sky-300 font-mono-num`}
              >
                <Wind className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {hud.windX >= 0 ? '→' : '←'}
                  {Math.round(Math.abs(hud.windX) * 100)}
                </span>
              </div>
            )}

            {/* Desktop Balance Pill (always lightweight readout when not on mobile) */}
            <div
              className={`hidden lg:flex items-center gap-2 ${SURFACE_GLASS} rounded-xl px-3 py-2 text-xs`}
            >
              <Footprints className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span className="text-[#E5D3BE]/75">Balance</span>
              <span className={`font-mono-num font-semibold ${balanceTextColor}`}>
                {hud.balance}% · {balanceStateLabel}
              </span>
            </div>

            {/* Optional Device Tilt Toggle + Calibrate */}
            {showTiltControls && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleTilt}
                  aria-pressed={tiltEnabled}
                  aria-label={tiltEnabled ? 'Disable motion tilt controls' : 'Enable motion tilt controls'}
                  className={`min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    tiltEnabled
                      ? tiltStatus === 'active'
                        ? 'bg-[#D97706]/80 border-amber-200/60 text-[#1A0B07]'
                        : tiltStatus === 'denied' || tiltStatus === 'unsupported'
                          ? 'bg-red-950/65 border-red-400/40 text-red-200'
                          : 'bg-amber-900/65 border-amber-300/45 text-amber-100'
                      : `${SURFACE_BTN} text-[#FAF3E8]`
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {!tiltEnabled
                      ? 'Tilt'
                      : tiltStatus === 'active'
                        ? 'Tilt On'
                        : tiltStatus === 'needs_permission'
                          ? 'Allow Tilt'
                          : tiltStatus === 'denied'
                            ? 'Denied'
                            : tiltStatus === 'unsupported'
                              ? 'No Sensor'
                              : 'Calibrating'}
                  </span>
                </button>

                {tiltEnabled && tiltStatus === 'active' && (
                  <button
                    type="button"
                    onClick={onCalibrateTilt}
                    aria-label="Calibrate neutral tilt position"
                    title="Set current phone angle as center"
                    className={`min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center gap-1 rounded-xl ${SURFACE_BTN} text-xs font-semibold text-amber-200 transition-colors cursor-pointer whitespace-nowrap`}
                  >
                    <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Zero</span>
                  </button>
                )}
              </div>
            )}

            {/* Touch Controls Quick Toggle (hybrid laptops / tablets / mobile) */}
            {canToggleTouchControls && (
              <button
                type="button"
                onClick={onToggleTouchControls}
                aria-pressed={showTouchControls}
                aria-label={showTouchControls ? 'Hide touch controls' : 'Show touch controls'}
                title={showTouchControls ? 'Hide on-screen touch controls' : 'Show on-screen touch controls'}
                className={`min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  showTouchControls
                    ? 'bg-[#2C160E]/75 border-amber-300/45 text-amber-200'
                    : `${SURFACE_BTN} text-[#E5D3BE]/85`
                }`}
              >
                <Gamepad2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            {/* Camera Switch Button (mobile + whenever touch overlay occupies bottom-left) */}
            <button
              type="button"
              onClick={cycleCamera}
              aria-label="Switch match camera angle"
              className={`${
                showTouchControls ? 'flex' : 'flex sm:hidden'
              } min-w-[44px] min-h-[44px] items-center justify-center rounded-xl ${SURFACE_BTN} text-[#FAF3E8] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400`}
            >
              <Camera className="w-4 h-4 text-amber-300" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl ${SURFACE_BTN} text-[#FAF3E8] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400`}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-amber-300" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onPause}
              aria-label="Pause game"
              className={`min-w-[44px] min-h-[44px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl ${SURFACE_BTN} text-xs font-semibold text-[#FAF3E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400`}
            >
              <Pause className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Pause</span>
            </button>
          </div>
        </div>

        {/* Slim Contextual Turn Banner & Live One-Foot Balance Sway Meter */}
        {!arrivalPlaying && (
          <div className="flex flex-col items-center gap-1.5 [@media(max-height:480px)]:gap-1">
            <div
              className={`${SURFACE_GLASS} rounded-xl px-3.5 py-1.5 text-[11px] sm:text-xs text-center max-w-lg [@media(max-height:480px)]:py-1`}
            >
              <span className={hud.foulReason ? 'text-red-300 font-semibold' : 'text-[#FAF3E8]/95'}>
                {hud.statusBanner}
              </span>
            </div>

            {hud.isBalancingOneFoot && isLocalTurn && (
              <div
                className={`${SURFACE_GLASS} rounded-xl px-3 py-1.5 w-56 sm:w-64 flex flex-col gap-1`}
              >
                <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#E5D3BE]/90 uppercase tracking-wider">
                    <Footprints className="w-3 h-3 text-amber-300" aria-hidden="true" />
                    <span>One-Foot Balance</span>
                  </span>
                  <span className={`font-mono-num font-bold ${balanceTextColor}`}>
                    {hud.balance}% · {balanceStateLabel}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-[#0F0704]/80 border border-[#FAF3E8]/14 overflow-hidden">
                  {/* Center green sweet spot (|sway| <= 0.65) */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-[21%] right-[21%] bg-emerald-400/20 border-x border-emerald-300/30"
                  />
                  {/* Center hairline */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-1/2 w-px bg-[#FAF3E8]/35"
                  />
                  {/* Live sway marker */}
                  <div
                    aria-hidden="true"
                    style={{ left: `${swayPct.toFixed(1)}%` }}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white/80 shadow ${
                      Math.abs(hud.balanceSway ?? 0) > 0.65
                        ? 'bg-red-400'
                        : Math.abs(hud.balanceSway ?? 0) > 0.4
                          ? 'bg-amber-300'
                          : 'bg-emerald-300'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM PERIMETER: TOSS POWER BAR, DESKTOP CAMERA BAR, OR MOBILE TOUCH CONTROLS */}
      <div className="flex items-end justify-between gap-2 sm:gap-4">
        {/* Bottom-Left: Virtual Joystick (touch) OR Quick Camera Bar (desktop) */}
        <div className="flex items-end shrink-0 min-w-[44px]">
          {showTouchControls && isLocalTurn && !arrivalPlaying ? (
            (isAimPhase || isHopPhase) && (
              <VirtualJoystick
                label={isAimPhase ? 'Aim' : 'Balance'}
                disabled={isHopPhase && !hud.isBalancingOneFoot}
                onAxisChange={onTouchAxisChange}
              />
            )
          ) : (
            <div
              role="group"
              aria-label="Quick match camera angle"
              className={`pointer-events-auto hidden sm:flex items-center gap-1 p-1 ${SURFACE_GLASS} rounded-xl`}
            >
              <Camera className="w-3.5 h-3.5 text-amber-300 ml-1.5 mr-0.5" aria-hidden="true" />
              {(
                [
                  { id: 'play', label: 'Dynamic' },
                  { id: 'aim_target', label: 'Aim' },
                  { id: 'top_aim', label: 'Top' },
                  { id: 'courtyard', label: 'Side' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => onChangeMatchCamera(cam.id)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    matchCamera === cam.id
                      ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                      : 'text-[#E5D3BE]/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
              <span className="text-[10px] text-[#E5D3BE]/55 px-1 font-mono-num">C</span>
            </div>
          )}
        </div>

        {/* Bottom-Center: Compact Translucent Toss Power Meter */}
        <div className="flex flex-col items-center justify-end flex-1 min-w-0 pb-1">
          {isAimPhase && isLocalTurn && !arrivalPlaying && (
            <div
              className={`${SURFACE_GLASS} rounded-xl px-3 py-1.5 flex items-center gap-2.5 w-full max-w-[230px] sm:max-w-[260px]`}
            >
              <span className="text-[10px] sm:text-[11px] font-semibold text-amber-200 whitespace-nowrap uppercase tracking-wider">
                Power
              </span>
              <div className="flex-1 h-2 bg-[#0F0704]/80 rounded-full overflow-hidden border border-[#FAF3E8]/14">
                <div
                  className="h-full transition-[width] duration-75"
                  style={{
                    width: `${Math.round(hud.aimPower * 100)}%`,
                    backgroundColor: hud.isCharging ? '#FBBF24' : '#D97706',
                  }}
                />
              </div>
              <span className="font-mono-num text-[11px] sm:text-xs text-[#FAF3E8] w-8 text-right">
                {Math.round(hud.aimPower * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Bottom-Right: Contextual Touch Action Pad */}
        <div className="flex items-end justify-end shrink-0 min-w-[44px]">
          {showTouchControls && isLocalTurn && !arrivalPlaying ? (
            <TouchActionPad
              phase={hud.phase}
              aimPower={hud.aimPower}
              isCharging={hud.isCharging}
              hopNextStepLabel={hud.hopNextStepLabel}
              onStartAimCharge={onStartAimCharge}
              onReleaseAimCharge={onReleaseAimCharge}
              onCancelAimCharge={onCancelAimCharge}
              onTriggerAction={onTriggerAction}
            />
          ) : (
            <div className="hidden sm:block w-24" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
