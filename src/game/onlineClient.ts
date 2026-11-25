import { CourtSize, CourtVenueId, HairStyle, OutfitId, StencilId, StoneId } from './types';

export interface OnlinePlayerCosmetics {
  stoneId: StoneId;
  outfitId: OutfitId;
  stencilId: StencilId;
  hairStyle: HairStyle;
  skinTone: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface OnlineRoomPlayer {
  slot: 0 | 1;
  name: string;
  connected: boolean;
  cosmetics: OnlinePlayerCosmetics;
  targetSquare: number;
  score: number;
  housesOwned: number[];
  streak: number;
  bestStreak: number;
  perfectTosses: number;
  fouls: number;
  roundsCleared: number;
}

export interface OnlineRoomState {
  code: string;
  isPublic: boolean;
  courtSize: CourtSize;
  venue: CourtVenueId;
  status: 'WAITING' | 'PLAYING' | 'GAME_OVER';
  activeSlot: 0 | 1;
  turnCount: number;
  windX: number;
  puddleSquares: number[];
  houses: Record<number, 0 | 1>;
  winnerSlot: 0 | 1 | null;
  winReason: string | null;
  rematchVotes: [boolean, boolean];
  players: [OnlineRoomPlayer | null, OnlineRoomPlayer | null];
}

export type OnlineServerEvent =
  | { type: 'room:joined'; yourSlot: 0 | 1; room: OnlineRoomState }
  | { type: 'room:state'; room: OnlineRoomState }
  | { type: 'room:error'; message: string }
  | { type: 'room:rematch_start'; room: OnlineRoomState }
  | { type: 'remote:aim'; slot: 0 | 1; angleOffset: number; aimPower: number; isCharging: boolean }
  | { type: 'game:toss'; slot: 0 | 1; isClaim: boolean; targetX: number; targetY: number; windX: number }
  | { type: 'remote:hop'; slot: 0 | 1 }
  | { type: 'remote:pickup'; slot: 0 | 1; score: number }
  | { type: 'remote:balance'; slot: 0 | 1; balance: number; balanceSway: number }
  | { type: 'game:claim_phase'; slot: 0 | 1; room: OnlineRoomState }
  | { type: 'game:turn_advance'; reason: string; room: OnlineRoomState }
  | { type: 'game:over'; room: OnlineRoomState }
  | { type: 'ws:status'; connected: boolean };

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'sonko_online_client_id';
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `c_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    window.sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return `c_${Math.random().toString(36).slice(2)}`;
  }
}

export class SonkoOnlineClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(ev: OnlineServerEvent) => void>();
  private clientId = getOrCreateClientId();
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private intentionallyClosed = false;
  private activeRoomCode: string | null = null;
  private activeName: string = 'Player';
  private activeCosmetics: OnlinePlayerCosmetics | null = null;
  private pendingQueue: Record<string, unknown>[] = [];
  private lastAimSentAt = 0;
  private lastBalanceSentAt = 0;

  public subscribe(fn: (ev: OnlineServerEvent) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(ev: OnlineServerEvent) {
    for (const fn of this.listeners) {
      fn(ev);
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.intentionallyClosed = false;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.emit({ type: 'ws:status', connected: true });
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => {
        this.sendRaw({ type: 'ping' });
      }, 20000);

      // Rejoin room seamlessly if reconnected mid-match
      if (this.activeRoomCode && this.activeCosmetics) {
        this.sendRaw({
          type: 'room:join',
          code: this.activeRoomCode,
          playerName: this.activeName,
          cosmetics: this.activeCosmetics,
        });
      }

      while (this.pendingQueue.length > 0) {
        const next = this.pendingQueue.shift();
        if (next) this.sendRaw(next);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as OnlineServerEvent | { type: 'pong' };
        if (data.type === 'pong') return;
        if (data.type === 'room:joined') {
          this.activeRoomCode = data.room.code;
        }
        this.emit(data);
      } catch {
        // Ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.emit({ type: 'ws:status', connected: false });
      if (this.pingTimer) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      this.ws = null;
      if (!this.intentionallyClosed) {
        if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => this.connect(), 1800);
      }
    };
  }

  private sendRaw(payload: Record<string, unknown>) {
    const withId = { ...payload, clientId: this.clientId };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(withId));
    } else {
      this.pendingQueue.push(withId);
      this.connect();
    }
  }

  public createRoom(
    playerName: string,
    courtSize: CourtSize,
    venue: CourtVenueId,
    cosmetics: OnlinePlayerCosmetics,
    isPublic = false
  ) {
    this.activeName = playerName;
    this.activeCosmetics = cosmetics;
    this.activeRoomCode = null;
    this.connect();
    this.sendRaw({
      type: isPublic ? 'room:quickmatch' : 'room:create',
      playerName,
      courtSize,
      venue,
      cosmetics,
    });
  }

  public joinRoom(code: string, playerName: string, cosmetics: OnlinePlayerCosmetics) {
    this.activeName = playerName;
    this.activeCosmetics = cosmetics;
    this.activeRoomCode = code.trim().toUpperCase();
    this.connect();
    this.sendRaw({
      type: 'room:join',
      code: this.activeRoomCode,
      playerName,
      cosmetics,
    });
  }

  public leaveRoom() {
    this.activeRoomCode = null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRaw({ type: 'room:leave' });
    }
  }

  public sendAim(angleOffset: number, aimPower: number, isCharging: boolean) {
    const now = performance.now();
    if (!isCharging && now - this.lastAimSentAt < 65) return;
    if (isCharging && now - this.lastAimSentAt < 50) return;
    this.lastAimSentAt = now;
    this.sendRaw({ type: 'player:aim', angleOffset, aimPower, isCharging });
  }

  public sendToss(angleOffset: number, aimPower: number, isClaim: boolean) {
    this.sendRaw({ type: 'player:toss', angleOffset, aimPower, isClaim });
  }

  public sendHop() {
    this.sendRaw({ type: 'player:hop' });
  }

  public sendPickup() {
    this.sendRaw({ type: 'player:pickup' });
  }

  public sendBalance(balance: number, balanceSway: number) {
    const now = performance.now();
    if (now - this.lastBalanceSentAt < 75) return;
    this.lastBalanceSentAt = now;
    this.sendRaw({ type: 'player:balance', balance, balanceSway });
  }

  public sendTossResult(kind: 'BULLSEYE' | 'CLEAN' | 'CLAIM_SUCCESS', squareId?: number) {
    this.sendRaw({ type: 'player:toss_result', kind, squareId });
  }

  public sendTurnEnd(
    outcome: 'FOUL' | 'ROUND_CLEAR' | 'CLAIM_COMPLETE',
    reason?: string
  ) {
    this.sendRaw({ type: 'player:turn_end', outcome, reason });
  }

  public requestRematch() {
    this.sendRaw({ type: 'room:rematch' });
  }

  public disconnect() {
    this.intentionallyClosed = true;
    this.activeRoomCode = null;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const sonkoOnline = new SonkoOnlineClient();
