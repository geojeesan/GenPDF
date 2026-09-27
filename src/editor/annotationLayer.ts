import { appState } from '../state/appState';
import { 
  Annotation, 
  TextAnnotation, 
  PenAnnotation, 
  HighlightAnnotation, 
  ShapeAnnotation, 
  SignatureAnnotation, 
  StampAnnotation, 
  RedactionAnnotation,
  Point 
} from './annotationTypes';

export interface ParsedTextItem {
  str: string;
  x: number; // normalized
  y: number; // normalized
  width: number; // normalized
  height: number; // normalized
  fontSize: number; // pt
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
}

export class AnnotationLayer {
  private parsedTextItems: ParsedTextItem[] = [];
  private pageIndex: number;
  private container: HTMLElement;
  private svgLayer: SVGSVGElement;
  private interactiveCanvas: HTMLCanvasElement;
  private htmlOverlay: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private currentPoints: Point[] = [];
  private startPoint: Point | null = null;
  private activeDragAnnotation: Annotation | null = null;
  private dragMode: 'move' | 'resize' | null = null;
  private resizeHandle: string = '';
  private dragStartNorm: Point = { x: 0, y: 0 };
  private initialAnnotationState: any = null;
  private editingTextAnnId: string | null = null;
  private hasDragged: boolean = false;
  private scale: number = 1.0;
  private baseWidth: number = 0;
  private baseHeight: number = 0;

  constructor(pageIndex: number, container: HTMLElement, baseWidth: number = 0, baseHeight: number = 0) {
    this.pageIndex = pageIndex;
    this.container = container;
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;

    // SVG Layer for crisp vector annotations (pen, highlighter, shapes, redaction)
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.setAttribute('class', 'annotation-svg-layer');
    this.svgLayer.style.position = 'absolute';
    this.svgLayer.style.inset = '0';
    this.svgLayer.style.width = '100%';
    this.svgLayer.style.height = '100%';
    this.svgLayer.style.pointerEvents = 'none';
    this.svgLayer.style.zIndex = '5';

    // Interactive Overlay Canvas for in-progress drawing (pen, shapes)
    this.interactiveCanvas = document.createElement('canvas');
    this.interactiveCanvas.setAttribute('class', 'annotation-interactive-canvas');
    this.interactiveCanvas.style.position = 'absolute';
    this.interactiveCanvas.style.inset = '0';
    this.interactiveCanvas.style.width = '100%';
    this.interactiveCanvas.style.height = '100%';
    this.interactiveCanvas.style.touchAction = 'none';
    this.interactiveCanvas.style.zIndex = '10';

    // HTML Overlay for interactive textboxes, signatures, and resize handles
    this.htmlOverlay = document.createElement('div');
    this.htmlOverlay.className = 'annotation-html-overlay';
    this.htmlOverlay.style.position = 'absolute';
    this.htmlOverlay.style.inset = '0';
    this.htmlOverlay.style.width = '100%';
    this.htmlOverlay.style.height = '100%';
    this.htmlOverlay.style.pointerEvents = 'none';
    this.htmlOverlay.style.zIndex = '15';

    this.container.appendChild(this.svgLayer);
    this.container.appendChild(this.interactiveCanvas);
    this.container.appendChild(this.htmlOverlay);

    this.ctx = this.interactiveCanvas.getContext('2d')!;

    this.attachEventListeners();
  }

  public setBaseDimensions(baseWidth: number, baseHeight: number): void {
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;
  }

  public getScale(): number {
    if (this.baseWidth > 0) {
      const rect = this.container.getBoundingClientRect();
      if (rect.width > 0) {
        return rect.width / this.baseWidth;
      }
    }
    if (this.scale > 0) {
      return this.scale;
    }
    const tab = appState.getActiveTab();
    return tab?.zoom || 1.0;
  }

  public setTextContent(textContent: any, unscaledViewport: any): void {
    if (unscaledViewport) {
      this.baseWidth = unscaledViewport.width;
      this.baseHeight = unscaledViewport.height;
    }
    if (!textContent || !textContent.items) return;
    const items: ParsedTextItem[] = [];
    const vpW = unscaledViewport.width;
    const vpH = unscaledViewport.height;

    for (const item of textContent.items) {
      if (!item.str || !item.str.trim() || item.width === 0) continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const w = item.width;
      const h = item.height || Math.hypot(item.transform[0], item.transform[1]) || 12;

      const c1 = unscaledViewport.convertToViewportPoint(tx, ty);
      const c2 = unscaledViewport.convertToViewportPoint(tx + w, ty);
      const c3 = unscaledViewport.convertToViewportPoint(tx + w, ty + h);
      const c4 = unscaledViewport.convertToViewportPoint(tx, ty + h);

      const xs = [c1[0], c2[0], c3[0], c4[0]];
      const ys = [c1[1], c2[1], c3[1], c4[1]];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const normX = Math.max(0, minX / vpW);
      const normY = Math.max(0, minY / vpH);
      const normW = Math.min(1 - normX, (maxX - minX) / vpW);
      const normH = Math.min(1 - normY, (maxY - minY) / vpH);

      const scaleX = Math.hypot(item.transform[0], item.transform[1]);
      const scaleY = Math.hypot(item.transform[2], item.transform[3]) || scaleX;
      const rawFontSize = scaleY > 0 ? scaleY : scaleX;
      const fontSize = Math.max(8, Math.round(rawFontSize * 10) / 10);
      const fontName = (item.fontName || '').toLowerCase();
      let fontFamily = 'sans-serif';
      if (fontName.includes('serif') || fontName.includes('times')) fontFamily = 'serif';
      else if (fontName.includes('mono') || fontName.includes('courier')) fontFamily = 'monospace';

      const isBold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy');
      const isItalic = fontName.includes('italic') || fontName.includes('oblique');

      items.push({
        str: item.str,
        x: normX,
        y: normY,
        width: normW,
        height: normH,
        fontSize,
        fontFamily,
        isBold,
        isItalic,
      });
    }

    this.parsedTextItems = items;
    this.render();
  }

  public updateDimensions(width: number, height: number, scale?: number): void {
    if (scale !== undefined && scale > 0) {
      this.scale = scale;
    } else if (this.baseWidth > 0 && width > 0) {
      this.scale = width / this.baseWidth;
    } else {
      const tab = appState.getActiveTab();
      if (tab?.zoom) {
        this.scale = tab.zoom;
      }
    }
    const dpr = window.devicePixelRatio || 1;
    this.interactiveCanvas.width = width * dpr;
    this.interactiveCanvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  private attachEventListeners(): void {
    this.interactiveCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  public destroy(): void {
    window.removeEventListener('pointermove', this.onPointerMove.bind(this));
    window.removeEventListener('pointerup', this.onPointerUp.bind(this));
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    this.svgLayer.remove();
    this.interactiveCanvas.remove();
    this.htmlOverlay.remove();
  }

  private getNormalizedCoords(e: PointerEvent): Point {
    const rect = this.interactiveCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  private onPointerDown(e: PointerEvent): void {
    const tool = appState.getTool();
    const norm = this.getNormalizedCoords(e);
    const tab = appState.getActiveTab();
    if (!tab) return;

    if (tool === 'hand') return;

    if (tool === 'select') {
      const selectedId = appState.getSelectedAnnotationId();
      const pageAnnotations = tab.annotations[this.pageIndex] || [];

      // Check resize handle
      if (selectedId) {
        const selected = pageAnnotations.find((a) => a.id === selectedId);
        if (selected) {
          const handle = this.hitTestResizeHandles(selected, norm);
          if (handle) {
            this.activeDragAnnotation = selected;
            this.dragMode = 'resize';
            this.resizeHandle = handle;
            this.dragStartNorm = norm;
            this.initialAnnotationState = JSON.parse(JSON.stringify(selected));
            this.isDrawing = true;
            return;
          }
        }
      }

      // Hit test annotations
      const hit = [...pageAnnotations].reverse().find((a) => this.hitTestAnnotation(a, norm));
      if (hit) {
        if (hit.id === selectedId && hit.type === 'text') {
          this.editingTextAnnId = hit.id;
        }
        appState.setSelectedAnnotationId(hit.id);
        this.activeDragAnnotation = hit;
        this.dragMode = 'move';
        this.dragStartNorm = norm;
        this.initialAnnotationState = JSON.parse(JSON.stringify(hit));
        this.hasDragged = false;
        this.isDrawing = true;
      } else {
        appState.setSelectedAnnotationId(null);
        this.editingTextAnnId = null;
      }
      this.render();
      return;
    }

    if (tool === 'eraser') {
      const pageAnnotations = tab.annotations[this.pageIndex] || [];
      const hit = [...pageAnnotations].reverse().find((a) => this.hitTestAnnotation(a, norm));
      if (hit) {
        this.deleteAnnotation(hit.id);
      }
      return;
    }

    if (tool === 'edit-text') {
      const pageAnnotations = tab.annotations[this.pageIndex] || [];
      const textAnnHit = [...pageAnnotations].reverse().find(
        (a) => a.type === 'text' && this.hitTestAnnotation(a, norm)
      ) as TextAnnotation | undefined;

      if (textAnnHit) {
        this.editingTextAnnId = textAnnHit.id;
        appState.setSelectedAnnotationId(textAnnHit.id);
        this.render();
        return;
      }

      const hit = this.parsedTextItems.find((item) =>
        norm.x >= item.x - 0.005 &&
        norm.x <= item.x + item.width + 0.005 &&
        norm.y >= item.y - 0.005 &&
        norm.y <= item.y + item.height + 0.005
      );
      if (hit) {
        this.activateExistingTextEdit(hit);
      } else if (this.editingTextAnnId) {
        this.editingTextAnnId = null;
        appState.setSelectedAnnotationId(null);
        this.render();
      }
      return;
    }

    if (tool === 'text') {
      const pageAnnotations = tab.annotations[this.pageIndex] || [];
      const textAnnHit = [...pageAnnotations].reverse().find(
        (a) => a.type === 'text' && this.hitTestAnnotation(a, norm)
      ) as TextAnnotation | undefined;

      if (textAnnHit) {
        this.editingTextAnnId = textAnnHit.id;
        appState.setSelectedAnnotationId(textAnnHit.id);
        this.render();
        return;
      }

      this.createTextAnnotationAt(norm);
      return;
    }

    if (tool === 'stamp') {
      this.createStampAnnotationAt(norm);
      return;
    }

    // For pen, highlight, shape, redaction
    this.isDrawing = true;
    this.startPoint = norm;
    this.currentPoints = [norm];
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    const norm = this.getNormalizedCoords(e);
    const tool = appState.getTool();

    if (tool === 'select' && this.activeDragAnnotation && this.initialAnnotationState) {
      const dx = norm.x - this.dragStartNorm.x;
      const dy = norm.y - this.dragStartNorm.y;
      if (Math.hypot(dx, dy) > 0.003) {
        this.hasDragged = true;
      }

      if (this.dragMode === 'move') {
        const newX = Math.max(0, Math.min(1 - this.activeDragAnnotation.width, this.initialAnnotationState.x + dx));
        const newY = Math.max(0, Math.min(1 - this.activeDragAnnotation.height, this.initialAnnotationState.y + dy));
        const actualDx = newX - this.initialAnnotationState.x;
        const actualDy = newY - this.initialAnnotationState.y;
        this.activeDragAnnotation.x = newX;
        this.activeDragAnnotation.y = newY;

        const shape = this.activeDragAnnotation as ShapeAnnotation;
        const initShape = this.initialAnnotationState as ShapeAnnotation;
        if (shape.startPoint && initShape.startPoint && shape.endPoint && initShape.endPoint) {
          shape.startPoint = { x: initShape.startPoint.x + actualDx, y: initShape.startPoint.y + actualDy };
          shape.endPoint = { x: initShape.endPoint.x + actualDx, y: initShape.endPoint.y + actualDy };
        }
      } else if (this.dragMode === 'resize') {
        this.applyResize(this.activeDragAnnotation, this.initialAnnotationState, this.resizeHandle, dx, dy);
      }
      this.render();
      return;
    }

    if (tool === 'pen' || tool === 'highlight') {
      this.currentPoints.push(norm);
      this.renderDrawingPreview();
      return;
    }

    if (['rectangle', 'circle', 'line', 'arrow', 'redaction'].includes(tool)) {
      this.renderShapePreview(norm);
      return;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const tool = appState.getTool();
    const tab = appState.getActiveTab();
    if (!tab) return;

    if (tool === 'select') {
      if (this.activeDragAnnotation && this.initialAnnotationState) {
        const movedAnn = this.activeDragAnnotation;
        const oldState = this.initialAnnotationState;
        const newState = { ...movedAnn };

        if (oldState.x !== newState.x || oldState.y !== newState.y || oldState.width !== newState.width || oldState.height !== newState.height) {
          tab.isDirty = true;
          tab.history.push({
            description: `Modify ${movedAnn.type}`,
            undo: () => {
              Object.assign(movedAnn, oldState);
              this.render();
            },
            redo: () => {
              Object.assign(movedAnn, newState);
              this.render();
            },
          });
        }
      }
      this.activeDragAnnotation = null;
      this.dragMode = null;
      return;
    }

    const norm = this.getNormalizedCoords(e);

    if (tool === 'pen' || tool === 'highlight') {
      if (this.currentPoints.length > 1) {
        this.finishPenAnnotation(tool);
      }
    } else if (['rectangle', 'circle', 'line', 'arrow', 'redaction'].includes(tool)) {
      if (this.startPoint) {
        this.finishShapeAnnotation(tool as any, norm);
      }
    }

    // Clear preview canvas
    this.ctx.clearRect(0, 0, this.interactiveCanvas.width, this.interactiveCanvas.height);
    this.currentPoints = [];
    this.startPoint = null;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable')) {
        return;
      }

      const selectedId = appState.getSelectedAnnotationId();
      if (selectedId) {
        this.deleteAnnotation(selectedId);
      }
    } else if (e.key === 'Enter') {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      const selectedId = appState.getSelectedAnnotationId();
      if (selectedId) {
        const tab = appState.getActiveTab();
        const ann = (tab?.annotations[this.pageIndex] || []).find((a) => a.id === selectedId);
        if (ann && ann.type === 'text') {
          e.preventDefault();
          this.editingTextAnnId = ann.id;
          this.render();
        }
      }
    }
  }

  public deleteAnnotation(id: string): void {
    const tab = appState.getActiveTab();
    if (!tab) return;
    const annotations = tab.annotations[this.pageIndex] || [];
    const index = annotations.findIndex((a) => a.id === id);
    if (index === -1) return;

    const [deleted] = annotations.splice(index, 1);
    appState.setSelectedAnnotationId(null);
    tab.isDirty = true;

    tab.history.push({
      description: `Delete ${deleted.type}`,
      undo: () => {
        annotations.splice(index, 0, deleted);
        this.render();
      },
      redo: () => {
        const idx = annotations.findIndex((a) => a.id === id);
        if (idx !== -1) annotations.splice(idx, 1);
        this.render();
      },
    });

    this.render();
    appState.notify();
  }

  private finishPenAnnotation(type: 'pen' | 'highlight'): void {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of this.currentPoints) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const settings = type === 'pen' ? appState.toolSettings.pen : appState.toolSettings.highlight;

    const ann: PenAnnotation | HighlightAnnotation = {
      id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type,
      pageIndex: this.pageIndex,
      x: minX,
      y: minY,
      width: Math.max(0.01, maxX - minX),
      height: Math.max(0.01, maxY - minY),
      points: [...this.currentPoints],
      color: settings.color,
      strokeWidth: settings.width,
      opacity: settings.opacity,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.addAnnotation(ann);
  }

  private finishShapeAnnotation(type: 'rectangle' | 'circle' | 'line' | 'arrow' | 'redaction', endPoint: Point): void {
    if (!this.startPoint) return;
    const minX = Math.min(this.startPoint.x, endPoint.x);
    const minY = Math.min(this.startPoint.y, endPoint.y);
    const width = Math.max(0.01, Math.abs(endPoint.x - this.startPoint.x));
    const height = Math.max(0.01, Math.abs(endPoint.y - this.startPoint.y));

    if (type === 'redaction') {
      const ann: RedactionAnnotation = {
        id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: 'redaction',
        pageIndex: this.pageIndex,
        x: minX,
        y: minY,
        width,
        height,
        fillColor: appState.toolSettings.redaction.fillColor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.addAnnotation(ann);
      return;
    }

    const shapeSettings = appState.toolSettings.shape;
    const ann: ShapeAnnotation = {
      id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type,
      pageIndex: this.pageIndex,
      x: minX,
      y: minY,
      width,
      height,
      startPoint: { x: this.startPoint.x, y: this.startPoint.y },
      endPoint: { x: endPoint.x, y: endPoint.y },
      strokeColor: shapeSettings.strokeColor,
      fillColor: shapeSettings.fillColor,
      strokeWidth: shapeSettings.strokeWidth,
      opacity: shapeSettings.opacity,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.addAnnotation(ann);
  }

  public activateExistingTextEdit(item: ParsedTextItem): void {
    const tab = appState.getActiveTab();
    if (!tab) return;
    const pageAnns = tab.annotations[this.pageIndex] || [];

    // Find if an edit annotation already covers this existing text item
    const existing = pageAnns.find(
      (a) =>
        a.type === 'text' &&
        (a as TextAnnotation).isExistingTextEdit &&
        ((a as TextAnnotation).originalBounds
          ? Math.abs((a as TextAnnotation).originalBounds!.x - item.x) < 0.01 &&
            Math.abs((a as TextAnnotation).originalBounds!.y - item.y) < 0.01
          : Math.abs(a.x - item.x) < 0.02 && Math.abs(a.y - item.y) < 0.02)
    ) as TextAnnotation | undefined;

    if (existing) {
      this.editingTextAnnId = existing.id;
      appState.setSelectedAnnotationId(existing.id);
      this.render();
      return;
    }

    // Extra width buffer so browser fonts with wider metrics don't wrap onto 2 lines
    const bufferNorm = Math.max(item.width * 0.20, 0.035);
    const initialWidth = Math.min(0.98 - item.x, Math.max(item.width + bufferNorm, 0.10));
    const initialHeight = Math.min(0.98 - item.y, Math.max(item.height * 1.15, 0.028));

    const ann: TextAnnotation = {
      id: 'edit_txt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'text',
      pageIndex: this.pageIndex,
      x: item.x,
      y: item.y,
      width: initialWidth,
      height: initialHeight,
      text: item.str,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      color: '#000000',
      isBold: item.isBold,
      isItalic: item.isItalic,
      textAlign: 'left',
      isExistingTextEdit: true,
      originalText: item.str,
      originalBounds: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.addAnnotation(ann);
    this.editingTextAnnId = ann.id;
    appState.setSelectedAnnotationId(ann.id);
    this.render();
  }

  private updateSelectionClasses(selectedId: string | null): void {
    this.htmlOverlay.querySelectorAll('.pdf-text-box-wrapper, .pdf-signature-wrapper').forEach((el) => {
      const annId = el.getAttribute('data-ann-id');
      el.classList.toggle('selected', annId === selectedId);
    });
  }

  private createTextAnnotationAt(norm: Point): void {
    const textSettings = appState.toolSettings.text;
    const ann: TextAnnotation = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'text',
      pageIndex: this.pageIndex,
      x: Math.max(0.02, Math.min(0.7, norm.x)),
      y: Math.max(0.02, Math.min(0.9, norm.y)),
      width: 0.32,
      height: 0.08,
      text: 'Type text here...',
      fontSize: textSettings.fontSize,
      fontFamily: textSettings.fontFamily,
      color: textSettings.color,
      isBold: textSettings.isBold,
      isItalic: textSettings.isItalic,
      textAlign: textSettings.textAlign,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.addAnnotation(ann);
    appState.setSelectedAnnotationId(ann.id);
    this.editingTextAnnId = ann.id;
    appState.setTool('select');
  }

  private createStampAnnotationAt(norm: Point): void {
    const ann: StampAnnotation = {
      id: 'stamp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'stamp',
      pageIndex: this.pageIndex,
      x: norm.x,
      y: norm.y,
      width: 0.24,
      height: 0.09,
      label: 'APPROVED',
      color: '#107c41',
      dateStr: new Date().toLocaleDateString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.addAnnotation(ann);
    appState.setSelectedAnnotationId(ann.id);
    appState.setTool('select');
  }

  public addAnnotation(ann: Annotation): void {
    const tab = appState.getActiveTab();
    if (!tab) return;
    if (!tab.annotations[this.pageIndex]) {
      tab.annotations[this.pageIndex] = [];
    }

    tab.annotations[this.pageIndex].push(ann);
    tab.isDirty = true;

    tab.history.push({
      description: `Add ${ann.type}`,
      undo: () => {
        const idx = tab.annotations[this.pageIndex].findIndex((a) => a.id === ann.id);
        if (idx !== -1) tab.annotations[this.pageIndex].splice(idx, 1);
        this.render();
      },
      redo: () => {
        tab.annotations[this.pageIndex].push(ann);
        this.render();
      },
    });

    this.render();
    appState.notify();
  }

  private hitTestAnnotation(ann: Annotation, pt: Point): boolean {
    const pad = 0.015;
    return (
      pt.x >= ann.x - pad &&
      pt.x <= ann.x + ann.width + pad &&
      pt.y >= ann.y - pad &&
      pt.y <= ann.y + ann.height + pad
    );
  }

  private hitTestResizeHandles(ann: Annotation, pt: Point): string | null {
    const pad = 0.025;
    const handles = [
      { name: 'nw', x: ann.x, y: ann.y },
      { name: 'n', x: ann.x + ann.width / 2, y: ann.y },
      { name: 'ne', x: ann.x + ann.width, y: ann.y },
      { name: 'e', x: ann.x + ann.width, y: ann.y + ann.height / 2 },
      { name: 'se', x: ann.x + ann.width, y: ann.y + ann.height },
      { name: 's', x: ann.x + ann.width / 2, y: ann.y + ann.height },
      { name: 'sw', x: ann.x, y: ann.y + ann.height },
      { name: 'w', x: ann.x, y: ann.y + ann.height / 2 },
    ];

    for (const h of handles) {
      if (Math.abs(pt.x - h.x) < pad && Math.abs(pt.y - h.y) < pad) {
        return h.name;
      }
    }
    return null;
  }

  private applyResize(ann: Annotation, orig: any, handle: string, dx: number, dy: number): void {
    let { x, y, width, height } = orig;

    if (handle.includes('e')) width = Math.max(0.04, width + dx);
    if (handle.includes('s')) height = Math.max(0.03, height + dy);
    if (handle.includes('w')) {
      const newWidth = Math.max(0.04, width - dx);
      x = x + (width - newWidth);
      width = newWidth;
    }
    if (handle.includes('n')) {
      const newHeight = Math.max(0.03, height - dy);
      y = y + (height - newHeight);
      height = newHeight;
    }

    ann.x = x;
    ann.y = y;
    ann.width = width;
    ann.height = height;

    const shape = ann as ShapeAnnotation;
    if (shape.startPoint && orig.startPoint && shape.endPoint && orig.endPoint && orig.width > 0 && orig.height > 0) {
      const scaleX = width / orig.width;
      const scaleY = height / orig.height;
      shape.startPoint = {
        x: x + (orig.startPoint.x - orig.x) * scaleX,
        y: y + (orig.startPoint.y - orig.y) * scaleY,
      };
      shape.endPoint = {
        x: x + (orig.endPoint.x - orig.x) * scaleX,
        y: y + (orig.endPoint.y - orig.y) * scaleY,
      };
    }
  }

  private renderDrawingPreview(): void {
    const rect = this.interactiveCanvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    if (this.currentPoints.length < 2) return;

    const tool = appState.getTool();
    const settings = tool === 'pen' ? appState.toolSettings.pen : appState.toolSettings.highlight;

    this.ctx.save();
    this.ctx.strokeStyle = settings.color;
    this.ctx.lineWidth = settings.width * this.getScale();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = settings.opacity;

    this.ctx.beginPath();
    this.ctx.moveTo(this.currentPoints[0].x * rect.width, this.currentPoints[0].y * rect.height);

    for (let i = 1; i < this.currentPoints.length; i++) {
      const p = this.currentPoints[i];
      this.ctx.lineTo(p.x * rect.width, p.y * rect.height);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderShapePreview(current: Point): void {
    if (!this.startPoint) return;
    const rect = this.interactiveCanvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    const x = Math.min(this.startPoint.x, current.x) * rect.width;
    const y = Math.min(this.startPoint.y, current.y) * rect.height;
    const w = Math.abs(current.x - this.startPoint.x) * rect.width;
    const h = Math.abs(current.y - this.startPoint.y) * rect.height;

    const tool = appState.getTool();
    this.ctx.save();

    if (tool === 'redaction') {
      this.ctx.fillStyle = appState.toolSettings.redaction.fillColor;
      this.ctx.fillRect(x, y, w, h);
    } else {
      const settings = appState.toolSettings.shape;
      this.ctx.strokeStyle = settings.strokeColor;
      this.ctx.lineWidth = settings.strokeWidth * this.getScale();
      this.ctx.globalAlpha = settings.opacity;

      if (tool === 'rectangle') {
        this.ctx.strokeRect(x, y, w, h);
      } else if (tool === 'circle') {
        this.ctx.beginPath();
        this.ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (tool === 'line' || tool === 'arrow') {
        const sx = this.startPoint.x * rect.width;
        const sy = this.startPoint.y * rect.height;
        const ex = current.x * rect.width;
        const ey = current.y * rect.height;
        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.lineTo(ex, ey);
        this.ctx.stroke();

        if (tool === 'arrow') {
          const angle = Math.atan2(ey - sy, ex - sx);
          const headLength = Math.max(10, settings.strokeWidth * this.getScale() * 3.5);
          this.ctx.fillStyle = settings.strokeColor;
          this.ctx.beginPath();
          this.ctx.moveTo(ex, ey);
          this.ctx.lineTo(
            ex - headLength * Math.cos(angle - Math.PI / 7),
            ey - headLength * Math.sin(angle - Math.PI / 7)
          );
          this.ctx.lineTo(
            ex - headLength * Math.cos(angle + Math.PI / 7),
            ey - headLength * Math.sin(angle + Math.PI / 7)
          );
          this.ctx.closePath();
          this.ctx.fill();
        }
      }
    }
    this.ctx.restore();
  }

  /**
   * Renders both the SVG vector layer and the interactive HTML overlay
   */
  public render(): void {
    const tab = appState.getActiveTab();
    if (!tab) {
      this.svgLayer.innerHTML = '';
      this.htmlOverlay.innerHTML = '';
      return;
    }

    const annotations: Annotation[] = tab.annotations[this.pageIndex] || [];
    const selectedId = appState.getSelectedAnnotationId();
    const rect = this.container.getBoundingClientRect();
    const scale = this.getScale();
    const W = rect.width || (this.baseWidth ? this.baseWidth * scale : 600);
    const H = rect.height || (this.baseHeight ? this.baseHeight * scale : 800);

    let svgHtml = '';
    let arrowMarkersHtml = '';

    // Preserve active editing text wrapper if currently in DOM to prevent losing focus/cursor during zoom
    const activeEditingWrapper = this.editingTextAnnId
      ? (this.htmlOverlay.querySelector(`.pdf-text-box-wrapper[data-ann-id="${this.editingTextAnnId}"]`) as HTMLElement | null)
      : null;

    // Remove all children except the active editing wrapper
    const childrenToRemove = Array.from(this.htmlOverlay.children).filter((el) => el !== activeEditingWrapper);
    childrenToRemove.forEach((el) => el.remove());

    for (const ann of annotations) {
      const isSelected = ann.id === selectedId;
      const x = ann.x * W;
      const y = ann.y * H;
      const w = ann.width * W;
      const h = ann.height * H;

      if (ann.type === 'text') {
        const t = ann as TextAnnotation;
        const isEditing = this.editingTextAnnId === ann.id;
        const visualFontSize = Math.max(4, t.fontSize * scale);
        const padX = t.isExistingTextEdit ? 2 : Math.max(2, Math.round(4 * scale));
        const padY = t.isExistingTextEdit ? 1 : Math.max(1, Math.round(2 * scale));
        const lineHeight = 1.25;

        // Measure text to guarantee the container is wide and tall enough to prevent wrapping
        this.ctx.save();
        this.ctx.font = `${t.isBold ? 'bold ' : ''}${t.isItalic ? 'italic ' : ''}${visualFontSize}px ${t.fontFamily || 'sans-serif'}`;
        const lines = (t.text || '').split('\n');
        let maxLineWidth = 0;
        for (const line of lines) {
          const lw = this.ctx.measureText(line).width;
          if (lw > maxLineWidth) maxLineWidth = lw;
        }
        this.ctx.restore();

        // Required pixel width for the text + padding + border (3px) + safety buffer (18px)
        const requiredPxWidth = maxLineWidth + padX * 2 + 18;
        const minCoverW = t.isExistingTextEdit && t.originalBounds ? t.originalBounds.width * W : 0;
        const effectiveW = Math.min(W - x, Math.max(w, requiredPxWidth, minCoverW));

        const requiredPxHeight = Math.max(lines.length * visualFontSize * lineHeight + padY * 2 + 4, visualFontSize * lineHeight);
        const minCoverH = t.isExistingTextEdit && t.originalBounds ? t.originalBounds.height * H : 0;
        const effectiveH = Math.min(H - y, Math.max(h, requiredPxHeight, minCoverH));

        if (effectiveW > w) {
          t.width = effectiveW / W;
        }
        if (effectiveH > h) {
          t.height = effectiveH / H;
        }

        if (isEditing) {
          let textWrapper = activeEditingWrapper;
          let textarea: HTMLTextAreaElement;

          if (textWrapper && textWrapper.querySelector('textarea')) {
            textarea = textWrapper.querySelector('textarea')!;
            textWrapper.className = `pdf-text-box-wrapper editing ${t.isExistingTextEdit ? 'existing-text-edit' : ''} ${isSelected ? 'selected' : ''}`;
            textWrapper.style.position = 'absolute';
            textWrapper.style.left = `${x}px`;
            textWrapper.style.top = `${y}px`;
            textWrapper.style.width = `${effectiveW}px`;
            textWrapper.style.minHeight = `${effectiveH}px`;
            textWrapper.style.pointerEvents = 'auto';

            textarea.style.fontSize = `${visualFontSize}px`;
            textarea.style.lineHeight = `${lineHeight}`;
            textarea.style.fontFamily = t.fontFamily;
            textarea.style.color = t.color;
            textarea.style.fontWeight = t.isBold ? 'bold' : 'normal';
            textarea.style.fontStyle = t.isItalic ? 'italic' : 'normal';
            textarea.style.textAlign = t.textAlign;
            textarea.style.padding = `${padY}px ${padX}px`;
            textarea.style.width = '100%';
            textarea.style.minHeight = `${effectiveH}px`;
            if (t.isExistingTextEdit) {
              textarea.style.whiteSpace = 'pre';
              textarea.style.wordBreak = 'normal';
              textarea.style.overflowWrap = 'normal';
            }
          } else {
            textWrapper = document.createElement('div');
            textWrapper.className = `pdf-text-box-wrapper editing ${t.isExistingTextEdit ? 'existing-text-edit' : ''} ${isSelected ? 'selected' : ''}`;
            textWrapper.setAttribute('data-ann-id', ann.id);
            textWrapper.style.position = 'absolute';
            textWrapper.style.left = `${x}px`;
            textWrapper.style.top = `${y}px`;
            textWrapper.style.width = `${effectiveW}px`;
            textWrapper.style.minHeight = `${effectiveH}px`;
            textWrapper.style.pointerEvents = 'auto';
            if (t.isExistingTextEdit) {
              textWrapper.style.background = '#ffffff';
              textWrapper.style.borderRadius = '2px';
            }

            textarea = document.createElement('textarea');
            textarea.className = 'pdf-text-editor-input';
            textarea.value = t.text;
            textarea.style.fontSize = `${visualFontSize}px`;
            textarea.style.lineHeight = `${lineHeight}`;
            textarea.style.fontFamily = t.fontFamily;
            textarea.style.color = t.color;
            textarea.style.fontWeight = t.isBold ? 'bold' : 'normal';
            textarea.style.fontStyle = t.isItalic ? 'italic' : 'normal';
            textarea.style.textAlign = t.textAlign;
            textarea.style.padding = `${padY}px ${padX}px`;
            textarea.style.width = '100%';
            textarea.style.minHeight = `${effectiveH}px`;
            if (t.isExistingTextEdit) {
              textarea.style.whiteSpace = 'pre';
              textarea.style.wordBreak = 'normal';
              textarea.style.overflowWrap = 'normal';
            }

            textarea.addEventListener('input', () => {
              t.text = textarea.value;
              tab.isDirty = true;

              this.ctx.save();
              this.ctx.font = `${t.isBold ? 'bold ' : ''}${t.isItalic ? 'italic ' : ''}${visualFontSize}px ${t.fontFamily || 'sans-serif'}`;
              const inputLines = (t.text || '').split('\n');
              let maxInputLineW = 0;
              for (const l of inputLines) {
                const lw = this.ctx.measureText(l).width;
                if (lw > maxInputLineW) maxInputLineW = lw;
              }
              this.ctx.restore();

              const neededW = maxInputLineW + padX * 2 + 18;
              const currentW = textWrapper.offsetWidth;
              if (neededW > currentW) {
                const newW = Math.min(W - x, Math.max(neededW, minCoverW));
                textWrapper.style.width = `${newW}px`;
                t.width = newW / W;
              }
              const neededH = Math.max(effectiveH, inputLines.length * visualFontSize * lineHeight + padY * 2 + 4);
              if (neededH > textWrapper.offsetHeight) {
                textWrapper.style.minHeight = `${neededH}px`;
                t.height = neededH / H;
              }
            });

            textarea.addEventListener('keydown', (e: KeyboardEvent) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                textarea.blur();
              }
            });

            textarea.addEventListener('blur', () => {
              if (textWrapper && W > 0 && H > 0) {
                const actualW = textWrapper.offsetWidth / W;
                const actualH = textWrapper.offsetHeight / H;
                if (actualW > t.width) {
                  t.width = actualW;
                }
                if (actualH > t.height) {
                  t.height = actualH;
                }
              }
              setTimeout(() => {
                if (this.editingTextAnnId === ann.id) {
                  this.editingTextAnnId = null;
                  this.render();
                  appState.notify();
                }
              }, 120);
            });

            textWrapper.appendChild(textarea);
            this.htmlOverlay.appendChild(textWrapper);

            setTimeout(() => {
              textarea.focus();
              if (textarea.value === 'Type text here...') {
                textarea.select();
              } else {
                const len = textarea.value.length;
                textarea.setSelectionRange(len, len);
              }
            }, 10);
          }
        } else {
          const textWrapper = document.createElement('div');
          textWrapper.className = `pdf-text-box-wrapper ${t.isExistingTextEdit ? 'existing-text-edit' : ''} ${isSelected ? 'selected' : ''}`;
          textWrapper.setAttribute('data-ann-id', ann.id);
          textWrapper.style.position = 'absolute';
          textWrapper.style.left = `${x}px`;
          textWrapper.style.top = `${y}px`;
          textWrapper.style.width = `${effectiveW}px`;
          textWrapper.style.minHeight = `${effectiveH}px`;
          textWrapper.style.pointerEvents = 'auto';
          if (t.isExistingTextEdit) {
            textWrapper.style.background = '#ffffff';
            textWrapper.style.borderRadius = '2px';
          }

          const textDiv = document.createElement('div');
          textDiv.className = 'pdf-rendered-text-content';
          textDiv.textContent = t.text;
          textDiv.style.fontSize = `${visualFontSize}px`;
          textDiv.style.lineHeight = `${lineHeight}`;
          textDiv.style.fontFamily = t.fontFamily;
          textDiv.style.color = t.color;
          textDiv.style.fontWeight = t.isBold ? 'bold' : 'normal';
          textDiv.style.fontStyle = t.isItalic ? 'italic' : 'normal';
          textDiv.style.textAlign = t.textAlign;
          textDiv.style.padding = `${padY}px ${padX}px`;
          textDiv.style.width = '100%';
          textDiv.style.minHeight = '100%';
          if (t.isExistingTextEdit) {
            textDiv.style.whiteSpace = 'pre';
            textDiv.style.wordBreak = 'normal';
            textDiv.style.overflowWrap = 'normal';
          }

          textWrapper.appendChild(textDiv);

          // Pointerdown: handles selection, drag start, or direct activation without destroying DOM
          textWrapper.addEventListener('pointerdown', (e: PointerEvent) => {
            if (this.editingTextAnnId === ann.id) return;
            const tool = appState.getTool();

            // In edit-text or text tool, clicking enters edit mode directly on pointerdown
            if (tool === 'edit-text' || tool === 'text') {
              e.stopPropagation();
              this.editingTextAnnId = ann.id;
              appState.setSelectedAnnotationId(ann.id);
              this.render();
              return;
            }

            e.stopPropagation();
            appState.setSelectedAnnotationId(ann.id);
            this.updateSelectionClasses(ann.id);

            this.activeDragAnnotation = ann;
            this.dragMode = 'move';
            this.dragStartNorm = this.getNormalizedCoords(e);
            this.initialAnnotationState = { ...ann };
            this.hasDragged = false;
            this.isDrawing = true;
          });

          // Single click: if already selected in 'select' tool, or in edit-text/text tool, activate edit mode
          textWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.hasDragged) return;
            const tool = appState.getTool();
            if (tool === 'edit-text' || tool === 'text') {
              this.editingTextAnnId = ann.id;
              appState.setSelectedAnnotationId(ann.id);
              this.render();
            } else if (tool === 'select') {
              if (appState.getSelectedAnnotationId() === ann.id) {
                this.editingTextAnnId = ann.id;
                this.render();
              } else {
                appState.setSelectedAnnotationId(ann.id);
                this.updateSelectionClasses(ann.id);
              }
            }
          });

          // Double click: always enter edit mode
          textWrapper.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editingTextAnnId = ann.id;
            appState.setSelectedAnnotationId(ann.id);
            this.render();
          });

          this.htmlOverlay.appendChild(textWrapper);
        }
      } else if (ann.type === 'signature') {
        const sig = ann as SignatureAnnotation;
        const sigWrapper = document.createElement('div');
        sigWrapper.className = `pdf-signature-wrapper ${isSelected ? 'selected' : ''}`;
        sigWrapper.setAttribute('data-ann-id', ann.id);
        sigWrapper.style.position = 'absolute';
        sigWrapper.style.left = `${x}px`;
        sigWrapper.style.top = `${y}px`;
        sigWrapper.style.width = `${w}px`;
        sigWrapper.style.height = `${h}px`;
        sigWrapper.style.pointerEvents = 'auto';

        const img = document.createElement('img');
        img.src = sig.imageDataUrl;
        img.className = 'pdf-signature-img';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.userSelect = 'none';

        sigWrapper.appendChild(img);

        // Pointerdown to drag signature without destroying DOM
        sigWrapper.addEventListener('pointerdown', (e: PointerEvent) => {
          e.stopPropagation();
          appState.setSelectedAnnotationId(ann.id);
          this.updateSelectionClasses(ann.id);
          this.activeDragAnnotation = ann;
          this.dragMode = 'move';
          this.dragStartNorm = this.getNormalizedCoords(e);
          this.initialAnnotationState = { ...ann };
          this.hasDragged = false;
          this.isDrawing = true;
        });

        sigWrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          appState.setSelectedAnnotationId(ann.id);
          this.updateSelectionClasses(ann.id);
        });

        this.htmlOverlay.appendChild(sigWrapper);
      } else if (ann.type === 'pen' || ann.type === 'highlight') {
        const p = ann as PenAnnotation | HighlightAnnotation;
        if (p.points && p.points.length > 1) {
          let pathD = `M ${p.points[0].x * W} ${p.points[0].y * H}`;
          for (let i = 1; i < p.points.length; i++) {
            pathD += ` L ${p.points[i].x * W} ${p.points[i].y * H}`;
          }
          const blend = ann.type === 'highlight' ? 'mix-blend-mode: multiply;' : '';
          svgHtml += `
            <path 
              d="${pathD}" 
              stroke="${p.color}" 
              stroke-width="${p.strokeWidth * scale}" 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              fill="none" 
              opacity="${p.opacity}"
              style="${blend}"
              data-id="${ann.id}"
            />
          `;
        }
      } else if (ann.type === 'rectangle') {
        const s = ann as ShapeAnnotation;
        svgHtml += `
          <rect 
            x="${x}" 
            y="${y}" 
            width="${w}" 
            height="${h}" 
            stroke="${s.strokeColor}" 
            stroke-width="${s.strokeWidth * scale}" 
            fill="${s.fillColor || 'transparent'}" 
            opacity="${s.opacity}" 
            data-id="${ann.id}"
          />
        `;
      } else if (ann.type === 'circle') {
        const s = ann as ShapeAnnotation;
        svgHtml += `
          <ellipse 
            cx="${x + w / 2}" 
            cy="${y + h / 2}" 
            rx="${w / 2}" 
            ry="${h / 2}" 
            stroke="${s.strokeColor}" 
            stroke-width="${s.strokeWidth * scale}" 
            fill="${s.fillColor || 'transparent'}" 
            opacity="${s.opacity}" 
            data-id="${ann.id}"
          />
        `;
      } else if (ann.type === 'line' || ann.type === 'arrow') {
        const s = ann as ShapeAnnotation;
        let x1: number, y1: number, x2: number, y2: number;
        if (s.startPoint && s.endPoint) {
          x1 = s.startPoint.x * W;
          y1 = s.startPoint.y * H;
          x2 = s.endPoint.x * W;
          y2 = s.endPoint.y * H;
        } else {
          x1 = x;
          y1 = y;
          x2 = x + w;
          y2 = y + h;
        }

        const markerId = `arrowhead_${ann.id}`;
        const markerAttr = ann.type === 'arrow' ? `marker-end="url(#${markerId})"` : '';

        if (ann.type === 'arrow') {
          const markerWidth = 8 * scale;
          const markerHeight = 6 * scale;
          arrowMarkersHtml += `
            <marker id="${markerId}" markerWidth="${markerWidth}" markerHeight="${markerHeight}" refX="${7 * scale}" refY="${3 * scale}" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L ${markerWidth} ${markerHeight / 2} L 0 ${markerHeight} z" fill="${s.strokeColor}" />
            </marker>
          `;
        }

        svgHtml += `
          <line 
            x1="${x1}" 
            y1="${y1}" 
            x2="${x2}" 
            y2="${y2}" 
            stroke="${s.strokeColor}" 
            stroke-width="${s.strokeWidth * scale}" 
            opacity="${s.opacity}" 
            ${markerAttr}
            data-id="${ann.id}"
          />
        `;
      } else if (ann.type === 'stamp') {
        const st = ann as StampAnnotation;
        svgHtml += `
          <g class="stamp-ann" data-id="${ann.id}">
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${6 * scale}" fill="#ffffff" fill-opacity="0.95" stroke="${st.color}" stroke-width="${2.5 * scale}" />
            <rect x="${x + 3 * scale}" y="${y + 3 * scale}" width="${w - 6 * scale}" height="${h - 6 * scale}" rx="${4 * scale}" fill="none" stroke="${st.color}" stroke-width="${1 * scale}" />
            <text x="${x + w / 2}" y="${y + h / 2 + (st.dateStr ? -2 * scale : 6 * scale)}" font-family="Segoe UI, Inter, sans-serif" font-weight="900" font-size="${Math.min(h * 0.42, 16 * scale)}" fill="${st.color}" text-anchor="middle" dominant-baseline="middle">${st.label}</text>
            ${st.dateStr ? `<text x="${x + w / 2}" y="${y + h - 8 * scale}" font-family="Segoe UI, Inter, sans-serif" font-weight="bold" font-size="${9 * scale}" fill="${st.color}" text-anchor="middle">${st.dateStr}</text>` : ''}
          </g>
        `;
      } else if (ann.type === 'redaction') {
        const red = ann as RedactionAnnotation;
        svgHtml += `
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${red.fillColor}" data-id="${ann.id}" />
        `;
      }

      // Draw bounding box on SVG if selected
      if (isSelected) {
        svgHtml += this.renderSelectionBox(x, y, w, h);
      }
    }

    if (activeEditingWrapper && !annotations.some((a) => a.id === this.editingTextAnnId)) {
      activeEditingWrapper.remove();
    }

    if (appState.getTool() === 'edit-text' && this.parsedTextItems.length > 0) {
      const activeTab = appState.getActiveTab();
      const pageAnns = (activeTab?.annotations[this.pageIndex] || []) as TextAnnotation[];
      const activeEdits = pageAnns.filter((a) => a.type === 'text' && a.isExistingTextEdit);

      const overlay = document.createElement('div');
      overlay.className = 'pdf-existing-text-overlay';

      for (const item of this.parsedTextItems) {
        // Skip rendering hover item if already replaced by an active edit annotation
        const isReplaced = activeEdits.some(
          (a) =>
            a.originalBounds
              ? Math.abs(a.originalBounds.x - item.x) < 0.01 && Math.abs(a.originalBounds.y - item.y) < 0.01
              : Math.abs(a.x - item.x) < 0.02 && Math.abs(a.y - item.y) < 0.02
        );
        if (isReplaced) continue;

        const el = document.createElement('div');
        el.className = 'pdf-existing-text-item';
        el.style.left = `${item.x * W}px`;
        el.style.top = `${item.y * H}px`;
        el.style.width = `${item.width * W}px`;
        el.style.height = `${item.height * H}px`;
        el.title = `Click to edit: "${item.str}"`;

        el.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.activateExistingTextEdit(item);
        });

        overlay.appendChild(el);
      }
      this.htmlOverlay.appendChild(overlay);
    }

    const defs = `<defs>${arrowMarkersHtml}</defs>`;
    this.svgLayer.innerHTML = defs + svgHtml;
  }

  private renderSelectionBox(x: number, y: number, w: number, h: number): string {
    const handleSize = 8;
    const handles = [
      { name: 'nw', cx: x, cy: y },
      { name: 'n', cx: x + w / 2, cy: y },
      { name: 'ne', cx: x + w, cy: y },
      { name: 'e', cx: x + w, cy: y + h / 2 },
      { name: 'se', cx: x + w, cy: y + h },
      { name: 's', cx: x + w / 2, cy: y + h },
      { name: 'sw', cx: x, cy: y + h },
      { name: 'w', cx: x, cy: y + h / 2 },
    ];

    let handleSvg = '';
    for (const h of handles) {
      handleSvg += `
        <rect 
          x="${h.cx - handleSize / 2}" 
          y="${h.cy - handleSize / 2}" 
          width="${handleSize}" 
          height="${handleSize}" 
          fill="#ffffff" 
          stroke="#0078d4" 
          stroke-width="1.5" 
          class="resize-handle handle-${h.name}"
        />
      `;
    }

    return `
      <g class="selection-box">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0078d4" stroke-width="1.5" stroke-dasharray="4 2" />
        ${handleSvg}
      </g>
    `;
  }
}
