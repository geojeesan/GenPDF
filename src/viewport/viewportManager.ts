import { appState, DocumentTab } from '../state/appState';
import { PageRenderer } from '../engine/pageRenderer';
import { AnnotationLayer } from '../editor/annotationLayer';
import { SignatureAnnotation } from '../editor/annotationTypes';

interface PageItem {
  pageIndex: number; // 0-based
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  annotationLayer: AnnotationLayer;
  rendered: boolean;
  baseWidth: number;
  baseHeight: number;
}

export class ViewportManager {
  private container: HTMLElement;
  private pagesWrapper: HTMLElement;
  private pages: Map<number, PageItem> = new Map();
  private observer: IntersectionObserver | null = null;
  private currentScale = 1.0;
  private isHandPanning = false;
  private handPanStart = { x: 0, y: 0 };
  private handScrollStart = { left: 0, top: 0 };
  private renderDebounceTimer: any = null;
  private isPinchZooming = false;
  private pinchEndTimer: any = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.pagesWrapper = document.createElement('div');
    this.pagesWrapper.className = 'pdf-pages-wrapper';
    this.container.appendChild(this.pagesWrapper);

    this.setupTrackpadZoom();
    this.setupHandTool();
    this.setupIntersectionObserver();
  }

  private setupTrackpadZoom(): void {
    this.container.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          this.isPinchZooming = true;
          const zoomFactor = 1 - e.deltaY * 0.01;
          const newScale = Math.min(5.0, Math.max(0.2, this.currentScale * zoomFactor));

          const rect = this.container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const scrollX = this.container.scrollLeft;
          const scrollY = this.container.scrollTop;

          const ratio = newScale / this.currentScale;
          this.setScale(newScale, true);

          this.container.scrollLeft = (scrollX + mouseX) * ratio - mouseX;
          this.container.scrollTop = (scrollY + mouseY) * ratio - mouseY;

          clearTimeout(this.pinchEndTimer);
          this.pinchEndTimer = setTimeout(() => {
            this.isPinchZooming = false;
            this.rerenderVisiblePages();
          }, 200);
        }
      },
      { passive: false }
    );
  }

  private setupHandTool(): void {
    this.container.addEventListener('pointerdown', (e: PointerEvent) => {
      const tool = appState.getTool();
      if (tool === 'hand' || e.button === 1) {
        this.isHandPanning = true;
        this.handPanStart = { x: e.clientX, y: e.clientY };
        this.handScrollStart = {
          left: this.container.scrollLeft,
          top: this.container.scrollTop,
        };
        this.container.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isHandPanning) return;
      const dx = e.clientX - this.handPanStart.x;
      const dy = e.clientY - this.handPanStart.y;
      this.container.scrollLeft = this.handScrollStart.left - dx;
      this.container.scrollTop = this.handScrollStart.top - dy;
    });

    window.addEventListener('pointerup', () => {
      if (this.isHandPanning) {
        this.isHandPanning = false;
        const tool = appState.getTool();
        this.container.style.cursor = tool === 'hand' ? 'grab' : 'default';
      }
    });
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = Number(entry.target.getAttribute('data-page-index'));
          const pageItem = this.pages.get(pageIndex);
          if (!pageItem) return;

          if (entry.isIntersecting && !pageItem.rendered) {
            this.renderPageCanvas(pageItem);
          }
        });
      },
      {
        root: this.container,
        rootMargin: '400px 0px 400px 0px',
        threshold: [0.05, 0.2],
      }
    );

    // Track exact page currently in view based on vertical center of viewport
    this.container.addEventListener(
      'scroll',
      () => {
        const tab = appState.getActiveTab();
        if (tab && this.pages.size > 0) {
          const visibleIdx = this.getCurrentVisiblePageIndex();
          if (tab.currentPage !== visibleIdx + 1) {
            tab.currentPage = visibleIdx + 1;
            appState.notify();
          }
        }
      },
      { passive: true }
    );
  }

  public getCurrentVisiblePageIndex(): number {
    const containerRect = this.container.getBoundingClientRect();
    const viewportCenterY = containerRect.top + containerRect.height / 2;

    let closestPageIndex = 0;
    let minDistance = Infinity;

    this.pages.forEach((pageItem, pageIndex) => {
      const rect = pageItem.element.getBoundingClientRect();
      const pageCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(viewportCenterY - pageCenterY);
      if (distance < minDistance) {
        minDistance = distance;
        closestPageIndex = pageIndex;
      }
    });

    return closestPageIndex;
  }

  public setScale(scale: number, isPinch = false): void {
    this.currentScale = scale;
    const tab = appState.getActiveTab();
    if (tab) {
      tab.zoom = scale;
    }

    // Smooth real-time visual CSS scale
    this.pages.forEach((pageItem) => {
      const w = pageItem.baseWidth * scale;
      const h = pageItem.baseHeight * scale;

      pageItem.element.style.width = `${w}px`;
      pageItem.element.style.height = `${h}px`;
      pageItem.canvas.style.width = `${w}px`;
      pageItem.canvas.style.height = `${h}px`;
      pageItem.annotationLayer.updateDimensions(w, h);
    });

    if (!isPinch) {
      // Re-render canvases with debounce
      clearTimeout(this.renderDebounceTimer);
      this.renderDebounceTimer = setTimeout(() => {
        this.rerenderVisiblePages();
      }, 120);
    }

    appState.notify();
  }

  private rerenderVisiblePages(): void {
    this.pages.forEach((pageItem) => {
      this.renderPageCanvas(pageItem);
    });
  }

  public getScale(): number {
    return this.currentScale;
  }

  public zoomIn(): void {
    this.setScale(Math.min(5.0, this.currentScale * 1.25));
  }

  public zoomOut(): void {
    this.setScale(Math.max(0.2, this.currentScale / 1.25));
  }

  public fitWidth(): void {
    const tab = appState.getActiveTab();
    if (!tab || this.pages.size === 0) return;
    const firstPage = this.pages.values().next().value;
    if (!firstPage) return;

    const availableWidth = this.container.clientWidth - 80;
    const scale = availableWidth / firstPage.baseWidth;
    this.setScale(Math.min(3.0, Math.max(0.3, scale)));
  }

  public fitPage(): void {
    const tab = appState.getActiveTab();
    if (!tab || this.pages.size === 0) return;
    const firstPage = this.pages.values().next().value;
    if (!firstPage) return;

    const availableWidth = this.container.clientWidth - 80;
    const availableHeight = this.container.clientHeight - 80;
    const scale = Math.min(availableWidth / firstPage.baseWidth, availableHeight / firstPage.baseHeight);
    this.setScale(Math.min(3.0, Math.max(0.3, scale)));
  }

  public async loadDocument(tab: DocumentTab): Promise<void> {
    this.pages.forEach((p) => {
      if (this.observer) this.observer.unobserve(p.element);
      p.annotationLayer.destroy();
    });
    this.pages.clear();
    this.pagesWrapper.innerHTML = '';

    if (!tab.pdfDoc) return;

    this.currentScale = tab.zoom || 1.0;
    const orderedPages = tab.pageOrder.filter((idx) => !tab.deletedPages.has(idx));

    for (const pageIndex of orderedPages) {
      const pageProxy = await tab.pdfDoc.getPage(pageIndex + 1);
      const userRotation = tab.pageRotations[pageIndex] || 0;
      const unscaledViewport = pageProxy.getViewport({ scale: 1, rotation: (pageProxy.rotate + userRotation) % 360 });

      const baseWidth = unscaledViewport.width;
      const baseHeight = unscaledViewport.height;

      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page-container';
      pageContainer.setAttribute('data-page-index', pageIndex.toString());
      pageContainer.style.width = `${baseWidth * this.currentScale}px`;
      pageContainer.style.height = `${baseHeight * this.currentScale}px`;
      pageContainer.style.backgroundColor = '#ffffff';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.style.backgroundColor = '#ffffff';
      pageContainer.appendChild(canvas);

      const annotationLayer = new AnnotationLayer(pageIndex, pageContainer);
      annotationLayer.updateDimensions(baseWidth * this.currentScale, baseHeight * this.currentScale);

      this.pagesWrapper.appendChild(pageContainer);

      const pageItem: PageItem = {
        pageIndex,
        element: pageContainer,
        canvas,
        annotationLayer,
        rendered: false,
        baseWidth,
        baseHeight,
      };

      this.pages.set(pageIndex, pageItem);
      if (this.observer) this.observer.observe(pageContainer);
    }

    if (tab.scrollPosition) {
      this.container.scrollLeft = tab.scrollPosition.x;
      this.container.scrollTop = tab.scrollPosition.y;
    }
  }

  public scrollToPage(pageIndex: number): void {
    const item = this.pages.get(pageIndex);
    if (item) {
      item.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private async renderPageCanvas(item: PageItem): Promise<void> {
    const tab = appState.getActiveTab();
    if (!tab || !tab.pdfDoc) return;

    const userRotation = tab.pageRotations[item.pageIndex] || 0;
    await PageRenderer.renderPage(
      tab.pdfDoc,
      item.pageIndex + 1,
      item.canvas,
      this.currentScale,
      userRotation
    );

    item.rendered = true;
    item.annotationLayer.render();
  }

  public refreshAnnotations(): void {
    this.pages.forEach((p) => p.annotationLayer.render());
  }

  public refreshPage(pageIndex: number): void {
    const p = this.pages.get(pageIndex);
    if (p) {
      this.renderPageCanvas(p);
    }
  }

  public addSignatureToCurrentPage(imageDataUrl: string): void {
    const tab = appState.getActiveTab();
    if (!tab) return;
    const pageIndex = this.getCurrentVisiblePageIndex();
    tab.currentPage = pageIndex + 1;

    const ann: SignatureAnnotation = {
      id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'signature',
      pageIndex,
      x: 0.35,
      y: 0.45,
      width: 0.3,
      height: 0.12,
      imageDataUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const pageItem = this.pages.get(pageIndex);
    if (pageItem) {
      pageItem.annotationLayer.addAnnotation(ann);
      appState.setSelectedAnnotationId(ann.id);
      appState.setTool('select');
      this.scrollToPage(pageIndex);
    }
  }
}
