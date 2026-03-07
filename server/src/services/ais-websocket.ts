import WebSocket from "ws";
import { PH_EEZ_BOUNDS } from "@bantay-pilipinas/shared";

interface AISMessage {
  mmsi: number;
  name?: string;
  lat: number;
  lon: number;
  heading?: number;
  speed?: number;
}

type VesselHandler = (vessel: AISMessage) => void;

export class AISStreamClient {
  private ws: WebSocket | null = null;
  private handlers: Set<VesselHandler> = new Set();
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.AISSTREAM_API_KEY;
  }

  connect(): void {
    if (!this.apiKey) {
      console.log("[ais] No API key configured, skipping AIS stream");
      return;
    }

    // TODO: Connect to AISStream WebSocket
    // Filter by PH EEZ bounding box
    void PH_EEZ_BOUNDS;
    console.log("[ais] AIS WebSocket client not yet implemented");
  }

  onVessel(handler: VesselHandler): void {
    this.handlers.add(handler);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
