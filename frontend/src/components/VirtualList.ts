export interface VirtualListOptions {
  container: HTMLElement;
  itemHeight: number;
  renderItem: (index: number) => HTMLElement;
  totalItems: number;
  overscan?: number;
}

export class VirtualList {
  private container: HTMLElement;
  private itemHeight: number;
  private renderItem: (index: number) => HTMLElement;
  private totalItems: number;
  private overscan: number;
  private viewport: HTMLElement;
  private content: HTMLElement;

  constructor(options: VirtualListOptions) {
    this.container = options.container;
    this.itemHeight = options.itemHeight;
    this.renderItem = options.renderItem;
    this.totalItems = options.totalItems;
    this.overscan = options.overscan ?? 5;

    this.viewport = document.createElement("div");
    this.viewport.className = "virtual-list-viewport";
    this.viewport.style.overflow = "auto";
    this.viewport.style.height = "100%";

    this.content = document.createElement("div");
    this.content.className = "virtual-list-content";
    this.content.style.height = `${this.totalItems * this.itemHeight}px`;
    this.content.style.position = "relative";

    this.viewport.appendChild(this.content);
    this.container.appendChild(this.viewport);

    this.viewport.addEventListener("scroll", () => this.onScroll());
    this.onScroll();
  }

  update(totalItems: number, renderItem: (index: number) => HTMLElement): void {
    this.totalItems = totalItems;
    this.renderItem = renderItem;
    this.content.style.height = `${this.totalItems * this.itemHeight}px`;
    this.onScroll();
  }

  private onScroll(): void {
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const endIndex = Math.min(this.totalItems, Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan);

    this.content.innerHTML = "";
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.renderItem(i);
      item.style.position = "absolute";
      item.style.top = `${i * this.itemHeight}px`;
      item.style.width = "100%";
      this.content.appendChild(item);
    }
  }
}
