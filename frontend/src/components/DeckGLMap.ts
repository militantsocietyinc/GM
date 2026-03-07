import { PH_CENTER, PH_DEFAULT_ZOOM } from "../config/geo";

export class DeckGLMap {
  constructor(private container: HTMLElement) {}

  async init(): Promise<void> {
    // TODO: Initialize deck.gl Deck instance with MapLibre base map
    // const deck = new Deck({
    //   container: this.container,
    //   mapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    //   initialViewState: {
    //     latitude: PH_CENTER.lat,
    //     longitude: PH_CENTER.lon,
    //     zoom: PH_DEFAULT_ZOOM,
    //     pitch: 0,
    //     bearing: 0,
    //   },
    //   controller: true,
    //   layers: [],
    // });
    void this.container;
    void PH_CENTER;
    void PH_DEFAULT_ZOOM;
  }

  updateLayers(_layers: unknown[]): void {
    // TODO: deck.setProps({ layers })
  }
}
