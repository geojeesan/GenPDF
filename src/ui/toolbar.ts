import { appState } from '../state/appState';
import { ToolType } from '../editor/annotationTypes';
import { ViewportManager } from '../viewport/viewportManager';
import { PDFExporter } from '../engine/pdfExporter';
import { SignatureDialog } from './signatureDialog';

interface OverflowItemDef {
  id: string;
  name: string;
  iconSvg: string;
  shortcut?: string;
  tool?: ToolType;
  action?: () => void;
  getBtn: () => HTMLElement | null;
  groupClass?: string;
}

export class Toolbar {
  private container: HTMLElement;
  private viewportManager: ViewportManager;
  private signatureDialog: SignatureDialog;
  private resizeObserver: ResizeObserver | null = null;
  private checkOverflowRAF: number | null = null;
  private overflowItems: OverflowItemDef[] = [];
  private activeOverflowedIds: Set<string> = new Set();

  constructor(
    container: HTMLElement,
    viewportManager: ViewportManager,
    signatureDialog: SignatureDialog
  ) {
    this.container = container;
    this.viewportManager = viewportManager;
    this.signatureDialog = signatureDialog;

    this.render();

    appState.subscribe(() => {
      this.updateState();
    });

    this.setupResizeObserver();
  }

  private render(): void {
    const currentPenWidth = appState.toolSettings.pen.width || 3;
    const currentPenColor = appState.toolSettings.pen.color || '#ff0000';

    this.container.innerHTML = `
      <div class="toolbar-left">
        <!-- Sidebar Toggle -->
        <button class="tool-btn sidebar-toggle-btn" title="Toggle Sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>

        <div class="tool-separator sep-left-1"></div>

        <!-- Open File -->
        <button class="tool-btn open-file-btn" title="Open PDF File">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <!-- Save / Export PDF -->
        <button class="tool-btn save-file-btn" title="Save & Export PDF (Ctrl+S)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>

        <div class="tool-separator sep-left-undo"></div>

        <!-- Undo / Redo -->
        <div class="tool-group group-undo-redo">
          <button class="tool-btn undo-btn" title="Undo (Ctrl+Z)" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v6h6"></path>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
            </svg>
          </button>
          <button class="tool-btn redo-btn" title="Redo (Ctrl+Y)" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 7v6h-6"></path>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Center Annotation Tools -->
      <div class="toolbar-center">
        <!-- Core Navigation / Select Tools -->
        <div class="tool-group group-core">
          <!-- Select -->
          <button class="tool-btn tool-select ${appState.getTool() === 'select' ? 'active' : ''}" data-tool="select" title="Select & Edit Annotations (V)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m3 3 7 18 3-7 7-3L3 3z"></path>
              <path d="m13 13 6 6"></path>
            </svg>
          </button>

          <!-- Hand Pan -->
          <button class="tool-btn tool-hand ${appState.getTool() === 'hand' ? 'active' : ''}" data-tool="hand" title="Hand Tool / Pan (H)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path>
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
            </svg>
          </button>
        </div>

        <div class="tool-separator sep-draw"></div>

        <!-- Drawing & Markup Tools -->
        <div class="tool-group group-draw">
          <!-- Edit Existing PDF Text Tool -->
          <button class="tool-btn tool-edit-text ${appState.getTool() === 'edit-text' ? 'active' : ''}" data-tool="edit-text" title="Edit PDF Text (E)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>

          <!-- Text Tool -->
          <button class="tool-btn tool-text ${appState.getTool() === 'text' ? 'active' : ''}" data-tool="text" title="Add Text Box (T)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
          </button>

          <!-- Pen Tool -->
          <button class="tool-btn tool-pen ${appState.getTool() === 'pen' ? 'active' : ''}" data-tool="pen" title="Freehand Pen / Ink (P)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </button>

          <!-- Highlighter Tool -->
          <button class="tool-btn tool-highlight ${appState.getTool() === 'highlight' ? 'active' : ''}" data-tool="highlight" title="Highlighter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 11-6 6v3h3l6-6"></path>
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
            </svg>
          </button>
        </div>

        <div class="tool-separator sep-shapes"></div>

        <!-- Shapes Group -->
        <div class="tool-group group-shapes">
          <!-- Shape Tool (Rectangle) -->
          <button class="tool-btn tool-rectangle ${appState.getTool() === 'rectangle' ? 'active' : ''}" data-tool="rectangle" title="Rectangle Shape">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            </svg>
          </button>

          <!-- Shape Tool (Circle) -->
          <button class="tool-btn tool-circle ${appState.getTool() === 'circle' ? 'active' : ''}" data-tool="circle" title="Ellipse / Circle Shape">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </button>

          <!-- Shape Tool (Arrow) -->
          <button class="tool-btn tool-arrow ${appState.getTool() === 'arrow' ? 'active' : ''}" data-tool="arrow" title="Arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="19" x2="19" y2="5"></line>
              <polyline points="10 5 19 5 19 14"></polyline>
            </svg>
          </button>
        </div>

        <div class="tool-separator sep-special"></div>

        <!-- Advanced Tools Group -->
        <div class="tool-group group-special">
          <!-- Digital Signature -->
          <button class="tool-btn tool-signature" title="Insert Digital Signature">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 21h18"></path>
              <path d="M19 7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path>
              <path d="M10 12v3"></path>
              <path d="M14 12v3"></path>
            </svg>
          </button>

          <!-- Rubber Stamp -->
          <button class="tool-btn tool-stamp ${appState.getTool() === 'stamp' ? 'active' : ''}" data-tool="stamp" title="Rubber Stamp (Approved / Confidential / Draft)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="12" cy="5" r="2"></circle>
              <path d="M12 7v4"></path>
              <line x1="8" y1="16" x2="16" y2="16"></line>
            </svg>
          </button>

          <!-- Redaction -->
          <button class="tool-btn tool-redaction ${appState.getTool() === 'redaction' ? 'active' : ''}" data-tool="redaction" title="Redaction (Blackout / Whiteout)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" fill="currentColor"></rect>
            </svg>
          </button>

          <!-- Eraser -->
          <button class="tool-btn tool-eraser ${appState.getTool() === 'eraser' ? 'active' : ''}" data-tool="eraser" title="Eraser (Click annotation to remove)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
              <path d="M22 21H7"></path>
              <path d="m5 11 9 9"></path>
            </svg>
          </button>
        </div>

        <div class="tool-separator sep-properties"></div>

        <!-- Tool Property Options Bar (Color picker & Modern Thickness Dropdown) -->
        <div class="tool-options-bar">
          <input type="color" class="tool-color-picker" value="${currentPenColor}" title="Stroke Color" />

          <!-- Custom Modern Thickness / Font Size Selector Dropdown -->
          <div class="thickness-dropdown" id="thickness-dropdown">
            <button type="button" class="thickness-trigger-btn" title="Property Value" aria-haspopup="true" aria-expanded="false">
              <span class="thickness-preview-indicator">
                <span class="thickness-preview-line" style="height: ${Math.min(currentPenWidth, 8)}px; background-color: ${currentPenColor};"></span>
              </span>
              <span class="thickness-label">${currentPenWidth} pt</span>
              <svg class="dropdown-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="thickness-menu" role="menu">
              <div class="thickness-menu-header">Stroke Thickness</div>
              <button type="button" class="thickness-option ${currentPenWidth === 1 ? 'active' : ''}" data-value="1" role="menuitem">
                <div class="thickness-line-preview" style="height: 1px; background-color: ${currentPenColor};"></div>
                <span class="thickness-option-text">1 pt (Fine)</span>
                <span class="thickness-check">✓</span>
              </button>
              <button type="button" class="thickness-option ${currentPenWidth === 2 ? 'active' : ''}" data-value="2" role="menuitem">
                <div class="thickness-line-preview" style="height: 2px; background-color: ${currentPenColor};"></div>
                <span class="thickness-option-text">2 pt (Light)</span>
                <span class="thickness-check">✓</span>
              </button>
              <button type="button" class="thickness-option ${currentPenWidth === 3 ? 'active' : ''}" data-value="3" role="menuitem">
                <div class="thickness-line-preview" style="height: 3px; background-color: ${currentPenColor};"></div>
                <span class="thickness-option-text">3 pt (Medium)</span>
                <span class="thickness-check">✓</span>
              </button>
              <button type="button" class="thickness-option ${currentPenWidth === 5 ? 'active' : ''}" data-value="5" role="menuitem">
                <div class="thickness-line-preview" style="height: 5px; background-color: ${currentPenColor};"></div>
                <span class="thickness-option-text">5 pt (Bold)</span>
                <span class="thickness-check">✓</span>
              </button>
              <button type="button" class="thickness-option ${currentPenWidth === 8 ? 'active' : ''}" data-value="8" role="menuitem">
                <div class="thickness-line-preview" style="height: 8px; background-color: ${currentPenColor};"></div>
                <span class="thickness-option-text">8 pt (Heavy)</span>
                <span class="thickness-check">✓</span>
              </button>
              <button type="button" class="thickness-option ${currentPenWidth === 16 ? 'active' : ''}" data-value="16" role="menuitem">
                <div class="thickness-line-preview" style="height: 12px; border-radius: 6px; background-color: ${currentPenColor};"></div>
                <span class="thickness-option-text">16 pt (Marker)</span>
                <span class="thickness-check">✓</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Controls: Zoom Controls & Firefox Overflow Button -->
      <div class="toolbar-right">
        <div class="zoom-controls">
          <button class="tool-btn zoom-out-btn" title="Zoom Out (Trackpad Pinch In)">−</button>
          <span class="zoom-level-text" title="Current Zoom Scale">100%</span>
          <button class="tool-btn zoom-in-btn" title="Zoom In (Trackpad Pinch Out)">+</button>
          <button class="tool-btn fit-width-btn" title="Fit to Width">⬌</button>
          <button class="tool-btn fit-page-btn" title="Fit to Page">⬚</button>
        </div>

        <!-- Firefox-Style Overflow Chevron Button (>>) -->
        <button class="tool-btn toolbar-overflow-btn" title="More Tools" aria-label="More Tools" aria-haspopup="true" aria-expanded="false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="13 17 18 12 13 7"></polyline>
            <polyline points="6 17 11 12 6 7"></polyline>
          </svg>
        </button>

        <!-- Overflow Dropdown Menu -->
        <div class="toolbar-overflow-dropdown" role="menu">
          <div class="overflow-menu-header">
            <span>More Tools</span>
          </div>
          <div class="overflow-menu-items"></div>
        </div>
      </div>
    `;

    this.initOverflowItemDefs();
    this.attachEvents();
    this.updateState();
  }

  private initOverflowItemDefs(): void {
    // Defines items that can overflow, in priority order (first items overflow first)
    this.overflowItems = [
      {
        id: 'stamp',
        name: 'Rubber Stamp',
        tool: 'stamp',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="16" y2="16"></line></svg>`,
        getBtn: () => this.container.querySelector('.tool-stamp'),
        groupClass: 'group-special',
      },
      {
        id: 'redaction',
        name: 'Redaction',
        tool: 'redaction',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" fill="currentColor"></rect></svg>`,
        getBtn: () => this.container.querySelector('.tool-redaction'),
        groupClass: 'group-special',
      },
      {
        id: 'signature',
        name: 'Digital Signature',
        action: () => {
          this.signatureDialog.show((dataUrl) => {
            this.viewportManager.addSignatureToCurrentPage(dataUrl);
          });
        },
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M19 7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M10 12v3"></path><path d="M14 12v3"></path></svg>`,
        getBtn: () => this.container.querySelector('.tool-signature'),
        groupClass: 'group-special',
      },
      {
        id: 'eraser',
        name: 'Eraser',
        tool: 'eraser',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>`,
        getBtn: () => this.container.querySelector('.tool-eraser'),
        groupClass: 'group-special',
      },
      {
        id: 'arrow',
        name: 'Arrow Shape',
        tool: 'arrow',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"></line><polyline points="10 5 19 5 19 14"></polyline></svg>`,
        getBtn: () => this.container.querySelector('.tool-arrow'),
        groupClass: 'group-shapes',
      },
      {
        id: 'circle',
        name: 'Ellipse / Circle',
        tool: 'circle',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`,
        getBtn: () => this.container.querySelector('.tool-circle'),
        groupClass: 'group-shapes',
      },
      {
        id: 'rectangle',
        name: 'Rectangle Shape',
        tool: 'rectangle',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>`,
        getBtn: () => this.container.querySelector('.tool-rectangle'),
        groupClass: 'group-shapes',
      },
      {
        id: 'edit-text',
        name: 'Edit PDF Text',
        tool: 'edit-text',
        shortcut: 'E',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        getBtn: () => this.container.querySelector('.tool-edit-text'),
        groupClass: 'group-draw',
      },
      {
        id: 'highlight',
        name: 'Highlighter',
        tool: 'highlight',
        shortcut: 'Ctrl+H',
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>`,
        getBtn: () => this.container.querySelector('.tool-highlight'),
      },
      {
        id: 'redo',
        name: 'Redo',
        shortcut: 'Ctrl+Y',
        action: () => {
          const tab = appState.getActiveTab();
          if (tab && tab.history.canRedo()) {
            tab.history.redo();
            this.viewportManager.refreshAnnotations();
          }
        },
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>`,
        getBtn: () => this.container.querySelector('.redo-btn'),
        groupClass: 'group-undo-redo',
      },
      {
        id: 'undo',
        name: 'Undo',
        shortcut: 'Ctrl+Z',
        action: () => {
          const tab = appState.getActiveTab();
          if (tab && tab.history.canUndo()) {
            tab.history.undo();
            this.viewportManager.refreshAnnotations();
          }
        },
        iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>`,
        getBtn: () => this.container.querySelector('.undo-btn'),
        groupClass: 'group-undo-redo',
      },
    ];
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.checkOverflowRAF) cancelAnimationFrame(this.checkOverflowRAF);
      this.checkOverflowRAF = requestAnimationFrame(() => {
        this.computeOverflow();
      });
    });
    this.resizeObserver.observe(this.container);
  }

  private computeOverflow(): void {
    const leftEl = this.container.querySelector('.toolbar-left') as HTMLElement;
    const centerEl = this.container.querySelector('.toolbar-center') as HTMLElement;
    const rightEl = this.container.querySelector('.toolbar-right') as HTMLElement;
    const zoomControls = this.container.querySelector('.zoom-controls') as HTMLElement;
    const overflowBtn = this.container.querySelector('.toolbar-overflow-btn') as HTMLElement;
    const overflowDropdown = this.container.querySelector('.toolbar-overflow-dropdown') as HTMLElement;
    const overflowItemsContainer = this.container.querySelector('.overflow-menu-items') as HTMLElement;

    if (!leftEl || !centerEl || !rightEl || !zoomControls || !overflowBtn || !overflowDropdown || !overflowItemsContainer) {
      return;
    }

    const containerWidth = this.container.clientWidth;
    if (containerWidth <= 0) return;

    // Reset all items to visible to accurately measure natural content width
    this.overflowItems.forEach((item) => {
      const btn = item.getBtn();
      if (btn) btn.classList.remove('toolbar-item-hidden');
    });

    this.container.querySelectorAll('.tool-separator').forEach((sep) => {
      (sep as HTMLElement).style.display = '';
    });

    overflowBtn.classList.remove('has-overflow');
    this.activeOverflowedIds.clear();

    const leftW = leftEl.offsetWidth;
    const zoomW = zoomControls.offsetWidth;

    // Measure exact natural width of center items (all items currently visible)
    let centerNaturalW = centerEl.scrollWidth || 0;
    if (centerNaturalW === 0) {
      Array.from(centerEl.children).forEach((ch) => {
        const el = ch as HTMLElement;
        if (el.style.display !== 'none') {
          centerNaturalW += el.offsetWidth + 6;
        }
      });
    }

    // Safety buffer (24px container padding + 31px breathing room so right controls never crowd the thickness selector)
    const safetyBuffer = 55;
    const totalNeeded = leftW + centerNaturalW + zoomW + safetyBuffer;

    // If container is wide enough (>= totalNeeded), keep all tools in toolbar and hide overflow button
    if (containerWidth >= totalNeeded) {
      overflowBtn.classList.remove('has-overflow');
      overflowDropdown.classList.remove('open');
      overflowBtn.setAttribute('aria-expanded', 'false');
      this.renderOverflowMenuContent();
      this.updateActiveOverflowIndicator();
      return;
    }

    // Window width is low: show overflow button and collapse items until it fits
    overflowBtn.classList.add('has-overflow');
    const overflowBtnW = 34;
    const availableForCenter = Math.max(60, containerWidth - leftW - zoomW - overflowBtnW - safetyBuffer);

    let currentCenterW = centerNaturalW;

    for (const item of this.overflowItems) {
      const btn = item.getBtn();
      if (!btn) continue;

      const btnW = btn.offsetWidth || 34;
      btn.classList.add('toolbar-item-hidden');
      this.activeOverflowedIds.add(item.id);
      currentCenterW -= btnW;

      // Check if group is completely hidden, then hide its separator
      if (item.groupClass) {
        const groupEl = this.container.querySelector(`.${item.groupClass}`);
        if (groupEl) {
          const visibleChildren = groupEl.querySelectorAll('.tool-btn:not(.toolbar-item-hidden)');
          if (visibleChildren.length === 0) {
            let sepEl: HTMLElement | null = null;
            if (item.groupClass === 'group-special') sepEl = this.container.querySelector('.sep-special');
            else if (item.groupClass === 'group-shapes') sepEl = this.container.querySelector('.sep-shapes');
            else if (item.groupClass === 'group-undo-redo') sepEl = this.container.querySelector('.sep-left-undo');
            if (sepEl && sepEl.style.display !== 'none') {
              sepEl.style.display = 'none';
              currentCenterW -= 13;
            }
          }
        }
      }

      if (currentCenterW <= availableForCenter) {
        break;
      }
    }

    if (this.activeOverflowedIds.size === 0) {
      overflowBtn.classList.remove('has-overflow');
      overflowDropdown.classList.remove('open');
      overflowBtn.setAttribute('aria-expanded', 'false');
    } else {
      overflowBtn.classList.add('has-overflow');
    }

    this.renderOverflowMenuContent();
    this.updateActiveOverflowIndicator();
  }

  private renderOverflowMenuContent(): void {
    const overflowItemsContainer = this.container.querySelector('.overflow-menu-items') as HTMLElement;
    if (!overflowItemsContainer) return;

    overflowItemsContainer.innerHTML = '';
    const currentTool = appState.getTool();
    const tab = appState.getActiveTab();

    this.overflowItems.forEach((item) => {
      if (!this.activeOverflowedIds.has(item.id)) return;

      const isCurrentTool = item.tool && item.tool === currentTool;
      const isUndoDisabled = item.id === 'undo' && (!tab || !tab.history.canUndo());
      const isRedoDisabled = item.id === 'redo' && (!tab || !tab.history.canRedo());
      const isDisabled = isUndoDisabled || isRedoDisabled;

      const itemEl = document.createElement('button');
      itemEl.type = 'button';
      itemEl.className = `overflow-menu-item ${isCurrentTool ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
      itemEl.setAttribute('role', 'menuitem');
      if (isDisabled) itemEl.setAttribute('disabled', 'true');

      itemEl.innerHTML = `
        <span class="overflow-item-icon">${item.iconSvg}</span>
        <span class="overflow-item-label">${item.name}</span>
        ${item.shortcut ? `<span class="overflow-item-shortcut">${item.shortcut}</span>` : ''}
        ${isCurrentTool ? '<span class="overflow-item-check">✓</span>' : ''}
      `;

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isDisabled) return;

        if (item.tool) {
          appState.setTool(item.tool);
        } else if (item.action) {
          item.action();
        }

        // Close overflow dropdown
        const overflowDropdown = this.container.querySelector('.toolbar-overflow-dropdown');
        const overflowBtn = this.container.querySelector('.toolbar-overflow-btn');
        if (overflowDropdown) overflowDropdown.classList.remove('open');
        if (overflowBtn) overflowBtn.setAttribute('aria-expanded', 'false');
      });

      overflowItemsContainer.appendChild(itemEl);
    });
  }

  private updateActiveOverflowIndicator(): void {
    const overflowBtn = this.container.querySelector('.toolbar-overflow-btn');
    if (!overflowBtn) return;

    const currentTool = appState.getTool();
    let hasActiveInOverflow = false;

    this.overflowItems.forEach((item) => {
      if (this.activeOverflowedIds.has(item.id) && item.tool === currentTool) {
        hasActiveInOverflow = true;
      }
    });

    overflowBtn.classList.toggle('active', hasActiveInOverflow);
  }

  private attachEvents(): void {
    // Sidebar toggle
    this.container.querySelector('.sidebar-toggle-btn')!.addEventListener('click', () => {
      appState.toggleSidebar();
    });

    // Open file
    this.container.querySelector('.open-file-btn')!.addEventListener('click', () => {
      (window as any).tabManager?.promptOpenFile();
    });

    // Save / Export
    this.container.querySelector('.save-file-btn')!.addEventListener('click', async () => {
      const tab = appState.getActiveTab();
      if (!tab) return;
      try {
        const btn = this.container.querySelector('.save-file-btn') as HTMLButtonElement;
        btn.classList.add('loading');
        const pdfBytes = await PDFExporter.exportPDF(tab);

        const winObj = window as any;
        if (winObj.electronAPI?.saveFileDialog) {
          const defaultName = tab.title.endsWith('.pdf') ? tab.title : `${tab.title}.pdf`;
          const savePath = await winObj.electronAPI.saveFileDialog(defaultName);
          if (savePath) {
            await winObj.electronAPI.writeFile(savePath, pdfBytes);
            tab.isDirty = false;
            appState.notify();
            alert(`Document successfully saved to ${savePath}`);
          }
        } else {
          const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = tab.title.endsWith('.pdf') ? tab.title : `${tab.title}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          tab.isDirty = false;
          appState.notify();
        }
        btn.classList.remove('loading');
      } catch (err: any) {
        alert(`Failed to export PDF: ${err.message}`);
      }
    });

    // Undo / Redo
    const undoBtn = this.container.querySelector('.undo-btn') as HTMLButtonElement;
    const redoBtn = this.container.querySelector('.redo-btn') as HTMLButtonElement;

    undoBtn.addEventListener('click', () => {
      const tab = appState.getActiveTab();
      if (tab) {
        tab.history.undo();
        this.viewportManager.refreshAnnotations();
        appState.notify();
      }
    });

    redoBtn.addEventListener('click', () => {
      const tab = appState.getActiveTab();
      if (tab) {
        tab.history.redo();
        this.viewportManager.refreshAnnotations();
        appState.notify();
      }
    });

    // Tool buttons
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as ToolType;
        appState.setTool(tool);
      });
    });

    // Signature Tool
    const sigBtn = this.container.querySelector('.tool-signature');
    if (sigBtn) {
      sigBtn.addEventListener('click', () => {
        this.signatureDialog.show((dataUrl) => {
          this.viewportManager.addSignatureToCurrentPage(dataUrl);
        });
      });
    }

    // Color picker
    const colorPicker = this.container.querySelector('.tool-color-picker') as HTMLInputElement;
    colorPicker.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      appState.toolSettings.pen.color = val;
      appState.toolSettings.shape.strokeColor = val;
      appState.toolSettings.text.color = val;

      const selectedId = appState.getSelectedAnnotationId();
      const tab = appState.getActiveTab();
      if (selectedId && tab) {
        for (const anns of Object.values(tab.annotations)) {
          const ann = (anns as any[]).find((a) => a.id === selectedId);
          if (ann) {
            if (ann.type === 'text') {
              ann.color = val;
              tab.isDirty = true;
              this.viewportManager.refreshAnnotations();
            } else if (ann.type === 'pen') {
              ann.color = val;
              tab.isDirty = true;
              this.viewportManager.refreshAnnotations();
            } else if (['rectangle', 'circle', 'line', 'arrow'].includes(ann.type)) {
              ann.strokeColor = val;
              tab.isDirty = true;
              this.viewportManager.refreshAnnotations();
            }
          }
        }
      }

      this.updateThicknessColors(val);
    });

    // Modern Thickness / Font Size Selector Dropdown
    const thicknessTriggerBtn = this.container.querySelector('.thickness-trigger-btn') as HTMLButtonElement;
    const thicknessMenu = this.container.querySelector('.thickness-menu') as HTMLElement;

    thicknessTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = thicknessMenu.classList.toggle('open');
      thicknessTriggerBtn.classList.toggle('open', isOpen);
      thicknessTriggerBtn.setAttribute('aria-expanded', String(isOpen));

      // Close overflow dropdown if open
      const overflowDropdown = this.container.querySelector('.toolbar-overflow-dropdown');
      if (overflowDropdown) overflowDropdown.classList.remove('open');
    });

    thicknessMenu.addEventListener('click', (e) => {
      const opt = (e.target as HTMLElement).closest('.thickness-option');
      if (!opt) return;
      e.stopPropagation();
      const val = Number(opt.getAttribute('data-value'));
      if (isNaN(val)) return;

      const tab = appState.getActiveTab();
      const tool = appState.getTool();
      const selectedId = appState.getSelectedAnnotationId();
      let selectedAnn: any = null;
      if (tab && selectedId) {
        for (const anns of Object.values(tab.annotations)) {
          const found = (anns as any[]).find((a) => a.id === selectedId);
          if (found) {
            selectedAnn = found;
            break;
          }
        }
      }

      const isTextMode = tool === 'text' || tool === 'edit-text' || (selectedAnn?.type === 'text');
      if (isTextMode) {
        appState.toolSettings.text.fontSize = val;
        if (selectedAnn && selectedAnn.type === 'text') {
          selectedAnn.fontSize = val;
          tab!.isDirty = true;
          this.viewportManager.refreshAnnotations();
        }
      } else {
        appState.toolSettings.pen.width = val;
        appState.toolSettings.shape.strokeWidth = val;
        if (selectedAnn && 'strokeWidth' in selectedAnn) {
          selectedAnn.strokeWidth = val;
          tab!.isDirty = true;
          this.viewportManager.refreshAnnotations();
        }
      }

      this.updateState();
      thicknessMenu.classList.remove('open');
      thicknessTriggerBtn.classList.remove('open');
      thicknessTriggerBtn.setAttribute('aria-expanded', 'false');
    });

    // Firefox-style Overflow button
    const overflowBtn = this.container.querySelector('.toolbar-overflow-btn') as HTMLButtonElement;
    const overflowDropdown = this.container.querySelector('.toolbar-overflow-dropdown') as HTMLElement;

    overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = overflowDropdown.classList.toggle('open');
      overflowBtn.setAttribute('aria-expanded', String(isOpen));

      if (isOpen) {
        this.renderOverflowMenuContent();
        // Close thickness menu if open
        thicknessMenu.classList.remove('open');
        thicknessTriggerBtn.classList.remove('open');
        thicknessTriggerBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Global click listener to close dropdown menus
    window.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.thickness-dropdown')) {
        thicknessMenu.classList.remove('open');
        thicknessTriggerBtn.classList.remove('open');
        thicknessTriggerBtn.setAttribute('aria-expanded', 'false');
      }
      if (!target.closest('.toolbar-overflow-dropdown') && !target.closest('.toolbar-overflow-btn')) {
        overflowDropdown.classList.remove('open');
        overflowBtn.setAttribute('aria-expanded', 'false');
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        thicknessMenu.classList.remove('open');
        thicknessTriggerBtn.classList.remove('open');
        thicknessTriggerBtn.setAttribute('aria-expanded', 'false');
        overflowDropdown.classList.remove('open');
        overflowBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Zoom buttons
    this.container.querySelector('.zoom-in-btn')!.addEventListener('click', () => {
      this.viewportManager.zoomIn();
      this.updateState();
    });

    this.container.querySelector('.zoom-out-btn')!.addEventListener('click', () => {
      this.viewportManager.zoomOut();
      this.updateState();
    });

    this.container.querySelector('.fit-width-btn')!.addEventListener('click', () => {
      this.viewportManager.fitWidth(true);
      this.updateState();
    });

    this.container.querySelector('.fit-page-btn')!.addEventListener('click', () => {
      this.viewportManager.fitPage(true);
      this.updateState();
    });
  }

  private renderPropertyMenu(isTextMode: boolean, currentVal: number, currentColor: string): void {
    const triggerBtn = this.container.querySelector('.thickness-trigger-btn') as HTMLElement;
    const label = this.container.querySelector('.thickness-label');
    const previewContainer = this.container.querySelector('.thickness-preview-indicator');
    const menu = this.container.querySelector('.thickness-menu') as HTMLElement;
    if (!triggerBtn || !label || !menu) return;

    if (isTextMode) {
      triggerBtn.title = 'Font Size';
      label.textContent = `${currentVal} pt`;
      if (previewContainer) {
        previewContainer.innerHTML = `<span style="font-weight: 800; font-size: 13px; color: ${currentColor}; display: inline-block; width: 14px; text-align: center;">A</span>`;
      }

      const fontSizes = [
        { val: 10, label: '10 pt (Small)' },
        { val: 12, label: '12 pt (Body)' },
        { val: 14, label: '14 pt (Normal)' },
        { val: 16, label: '16 pt (Medium)' },
        { val: 20, label: '20 pt (Large)' },
        { val: 24, label: '24 pt (Title)' },
        { val: 32, label: '32 pt (Headline)' },
      ];

      menu.innerHTML = `
        <div class="thickness-menu-header">Font Size</div>
        ${fontSizes
          .map(
            (opt) => `
          <button type="button" class="thickness-option ${currentVal === opt.val ? 'active' : ''}" data-value="${opt.val}" role="menuitem">
            <span style="font-size: 12px; font-weight: bold; width: 20px; text-align: center; color: ${currentColor};">${opt.val}</span>
            <span class="thickness-option-text">${opt.label}</span>
            <span class="thickness-check">✓</span>
          </button>
        `
          )
          .join('')}
      `;
    } else {
      triggerBtn.title = 'Stroke Thickness';
      label.textContent = `${currentVal} pt`;
      if (previewContainer) {
        previewContainer.innerHTML = `<span class="thickness-preview-line" style="height: ${Math.min(currentVal, 8)}px; background-color: ${currentColor}; width: 20px; border-radius: 2px; display: inline-block;"></span>`;
      }

      const strokeSizes = [
        { val: 1, label: '1 pt (Fine)', h: 1 },
        { val: 2, label: '2 pt (Light)', h: 2 },
        { val: 3, label: '3 pt (Medium)', h: 3 },
        { val: 5, label: '5 pt (Bold)', h: 5 },
        { val: 8, label: '8 pt (Heavy)', h: 8 },
        { val: 16, label: '16 pt (Marker)', h: 12 },
      ];

      menu.innerHTML = `
        <div class="thickness-menu-header">Stroke Thickness</div>
        ${strokeSizes
          .map(
            (opt) => `
          <button type="button" class="thickness-option ${currentVal === opt.val ? 'active' : ''}" data-value="${opt.val}" role="menuitem">
            <div class="thickness-line-preview" style="height: ${opt.h}px; ${opt.val === 16 ? 'border-radius: 6px;' : ''} background-color: ${currentColor}; width: 24px;"></div>
            <span class="thickness-option-text">${opt.label}</span>
            <span class="thickness-check">✓</span>
          </button>
        `
          )
          .join('')}
      `;
    }
  }

  private updateThicknessColors(color: string): void {
    const triggerPreview = this.container.querySelector('.thickness-trigger-btn .thickness-preview-line') as HTMLElement;
    if (triggerPreview) triggerPreview.style.backgroundColor = color;

    this.container.querySelectorAll<HTMLElement>('.thickness-line-preview').forEach((line) => {
      line.style.backgroundColor = color;
    });
  }

  public updateState(): void {
    const tab = appState.getActiveTab();
    const tool = appState.getTool();

    // Update active tool button in toolbar
    this.container.querySelectorAll('[data-tool]').forEach((btn) => {
      if (btn.getAttribute('data-tool') === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update zoom text
    const zoomText = this.container.querySelector('.zoom-level-text');
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.viewportManager.getScale() * 100)}%`;
    }

    // Update Fit to Width & Fit to Page active state
    const autoFitMode = this.viewportManager.getAutoFitMode();
    const fitWidthBtn = this.container.querySelector('.fit-width-btn');
    if (fitWidthBtn) {
      fitWidthBtn.classList.toggle('active', autoFitMode === 'width');
    }
    const fitPageBtn = this.container.querySelector('.fit-page-btn');
    if (fitPageBtn) {
      fitPageBtn.classList.toggle('active', autoFitMode === 'page');
    }

    // Update Undo / Redo buttons
    const undoBtn = this.container.querySelector('.undo-btn') as HTMLButtonElement;
    const redoBtn = this.container.querySelector('.redo-btn') as HTMLButtonElement;
    if (undoBtn && redoBtn && tab) {
      undoBtn.disabled = !tab.history.canUndo();
      redoBtn.disabled = !tab.history.canRedo();
    }

    // Find selected annotation if any
    const selectedId = appState.getSelectedAnnotationId();
    let selectedAnn: any = null;
    if (tab && selectedId) {
      for (const anns of Object.values(tab.annotations)) {
        const found = (anns as any[]).find((a) => a.id === selectedId);
        if (found) {
          selectedAnn = found;
          break;
        }
      }
    }

    const isTextMode = tool === 'text' || tool === 'edit-text' || (selectedAnn?.type === 'text');
    const currentColor = isTextMode
      ? (selectedAnn && selectedAnn.type === 'text' ? selectedAnn.color : appState.toolSettings.text.color)
      : (selectedAnn && 'color' in selectedAnn ? selectedAnn.color : (selectedAnn && 'strokeColor' in selectedAnn ? selectedAnn.strokeColor : appState.toolSettings.pen.color));

    const currentVal = isTextMode
      ? (selectedAnn && selectedAnn.type === 'text' ? selectedAnn.fontSize : appState.toolSettings.text.fontSize)
      : (selectedAnn && 'strokeWidth' in selectedAnn ? selectedAnn.strokeWidth : (appState.toolSettings.pen.width || 3));

    // Keep color picker in sync
    const colorPicker = this.container.querySelector('.tool-color-picker') as HTMLInputElement;
    if (colorPicker && currentColor) {
      if (/^#[0-9A-Fa-f]{6}$/.test(currentColor) && colorPicker.value.toLowerCase() !== currentColor.toLowerCase()) {
        colorPicker.value = currentColor;
      }
    }

    // Render property menu content (Font Size vs Stroke Thickness)
    this.renderPropertyMenu(isTextMode, currentVal, currentColor);

    // Refresh overflow menu items and indicator
    this.renderOverflowMenuContent();
    this.updateActiveOverflowIndicator();
  }
}
