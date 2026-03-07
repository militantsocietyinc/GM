import { PH_CENTER, PH_DEFAULT_ZOOM } from "../config/geo";

export class MapContainer {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="map-placeholder" style="
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0a1020;
        color: #4fc3f7;
        font-size: 14px;
      ">
        <div style="text-align: center;">
          <p>deck.gl + MapLibre Map</p>
          <p style="color: #667; font-size: 12px;">
            Center: ${PH_CENTER.lat}°N, ${PH_CENTER.lon}°E | Zoom: ${PH_DEFAULT_ZOOM}
          </p>
        </div>
      </div>
    `;
  }
}
