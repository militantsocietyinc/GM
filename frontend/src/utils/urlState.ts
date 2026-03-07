export interface AppState {
  lat?: number;
  lon?: number;
  zoom?: number;
  panel?: string;
  category?: string;
}

export function encodeState(state: AppState): string {
  const params = new URLSearchParams();
  if (state.lat != null) params.set("lat", state.lat.toFixed(4));
  if (state.lon != null) params.set("lon", state.lon.toFixed(4));
  if (state.zoom != null) params.set("z", state.zoom.toString());
  if (state.panel) params.set("p", state.panel);
  if (state.category) params.set("c", state.category);
  return params.toString();
}

export function decodeState(): AppState {
  const params = new URLSearchParams(window.location.search);
  return {
    lat: params.has("lat") ? parseFloat(params.get("lat")!) : undefined,
    lon: params.has("lon") ? parseFloat(params.get("lon")!) : undefined,
    zoom: params.has("z") ? parseInt(params.get("z")!, 10) : undefined,
    panel: params.get("p") || undefined,
    category: params.get("c") || undefined,
  };
}

export function pushState(state: AppState): void {
  const qs = encodeState(state);
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}
