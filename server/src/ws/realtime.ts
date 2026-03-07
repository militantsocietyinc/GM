import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

const clients = new Set<WebSocket>();

export function registerRealtimeWS(app: FastifyInstance): void {
  app.get("/ws/ais", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });
}

export function broadcastVesselUpdate(data: unknown): void {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
