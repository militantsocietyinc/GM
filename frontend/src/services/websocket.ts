import type { TrackedVessel } from "@bantay-pilipinas/shared";

type VesselHandler = (vessel: TrackedVessel) => void;

export class AISWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<VesselHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;

  constructor(url?: string) {
    this.url = url || import.meta.env.VITE_WS_URL || `ws://${location.host}`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${this.url}/ws/ais`);

    this.ws.onmessage = (event) => {
      const vessel: TrackedVessel = JSON.parse(event.data);
      for (const handler of this.handlers) {
        handler(vessel);
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
    };
  }

  onVesselUpdate(handler: VesselHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.connect();
    }, this.reconnectDelay);
  }
}
