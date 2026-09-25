import { appState } from '../state/appState';
import { ToolType } from '../editor/annotationTypes';
import { ViewportManager } from '../viewport/viewportManager';
import { PDFExporter } from '../engine/pdfExporter';
import { SignatureDialog } from './signatureDialog';

export class Toolbar {
  private container: HTMLElement;
  private viewportManager: ViewportManager;
  private signatureDialog: SignatureDialog;

  constructor(
    container: HTMLElement,
    viewportManager: ViewportManager,
    signatureDialog: SignatureDialog
  ) {
    this.container = container;
    this.viewportManager = viewportManager;
    this.signatureDialog = signatureDialog;

    appState.subscribe(() => {
      this.updateState();
    });

    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="toolbar-left">
        <!-- Sidebar Toggle -->
        <button class="tool-btn sidebar-toggle-btn" title="Toggle Sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>

        <div class="tool-separator"></div>

        <!-- Open File -->
        <button class="tool-btn open-file-btn" title="Open PDF File">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <!-- Save / Export PDF -->
        <button class="tool-btn save-file-btn primary-action-btn" title="Save & Export PDF (with annotations baked in)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span class="btn-label">Export PDF</span>
        </button>

        <div class="tool-separator"></div>

        <!-- Undo / Redo -->
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

      <!-- Center Annotation Tools -->
      <div class="toolbar-center">
        <div class="tool-group">
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

        <div class="tool-separator"></div>

        <div class="tool-group">
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
          <button class="tool-btn tool-highlight ${appState.getTool() === 'highlight' ? 'active' : ''}" data-tool="highlight" title="Highlighter (Ctrl+H)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 11-6 6v3h3l6-6"></path>
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
            </svg>
          </button>

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

        <div class="tool-separator"></div>

        <div class="tool-group">
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

        <!-- Tool Property Options Bar (Color picker, stroke size) -->
        <div class="tool-options-bar">
          <input type="color" class="tool-color-picker" value="${appState.toolSettings.pen.color}" title="Color" />
          <select class="tool-stroke-size" title="Line Thickness">
            <option value="1">1 pt</option>
            <option value="2">2 pt</option>
            <option value="3" selected>3 pt</option>
            <option value="5">5 pt</option>
            <option value="8">8 pt</option>
            <option value="16">16 pt</option>
          </select>
        </div>
      </div>

      <!-- Right Controls: Zoom Controls -->
      <div class="toolbar-right">
        <div class="zoom-controls">
          <button class="tool-btn zoom-out-btn" title="Zoom Out (Trackpad Pinch In)">−</button>
          <span class="zoom-level-text" title="Current Zoom Scale">100%</span>
          <button class="tool-btn zoom-in-btn" title="Zoom In (Trackpad Pinch Out)">+</button>
          <button class="tool-btn fit-width-btn" title="Fit to Width">⬌</button>
          <button class="tool-btn fit-page-btn" title="Fit to Page">⬚</button>
        </div>
      </div>
    `;

    this.attachEvents();
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
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
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
      }
    });

    redoBtn.addEventListener('click', () => {
      const tab = appState.getActiveTab();
      if (tab) {
        tab.history.redo();
        this.viewportManager.refreshAnnotations();
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
    this.container.querySelector('.tool-signature')!.addEventListener('click', () => {
      this.signatureDialog.show((dataUrl) => {
        this.viewportManager.addSignatureToCurrentPage(dataUrl);
      });
    });

    // Tool property options
    const colorPicker = this.container.querySelector('.tool-color-picker') as HTMLInputElement;
    const strokeSelect = this.container.querySelector('.tool-stroke-size') as HTMLSelectElement;

    colorPicker.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      appState.toolSettings.pen.color = val;
      appState.toolSettings.shape.strokeColor = val;
      appState.toolSettings.text.color = val;
    });

    strokeSelect.addEventListener('change', (e) => {
      const val = Number((e.target as HTMLSelectElement).value);
      appState.toolSettings.pen.width = val;
      appState.toolSettings.shape.strokeWidth = val;
    });

    // Zoom buttons
    this.container.querySelector('.zoom-in-btn')!.addEventListener('click', () => {
      this.viewportManager.zoomIn();
    });

    this.container.querySelector('.zoom-out-btn')!.addEventListener('click', () => {
      this.viewportManager.zoomOut();
    });

    this.container.querySelector('.fit-width-btn')!.addEventListener('click', () => {
      this.viewportManager.fitWidth();
    });

    this.container.querySelector('.fit-page-btn')!.addEventListener('click', () => {
      this.viewportManager.fitPage();
    });
  }

  public updateState(): void {
    const tab = appState.getActiveTab();
    const tool = appState.getTool();

    // Update active tool button
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

    // Update Undo / Redo buttons
    const undoBtn = this.container.querySelector('.undo-btn') as HTMLButtonElement;
    const redoBtn = this.container.querySelector('.redo-btn') as HTMLButtonElement;
    if (undoBtn && redoBtn && tab) {
      undoBtn.disabled = !tab.history.canUndo();
      redoBtn.disabled = !tab.history.canRedo();
    }

    // Keep color picker in sync with current pen/tool color
    const colorPicker = this.container.querySelector('.tool-color-picker') as HTMLInputElement;
    if (colorPicker && appState.toolSettings.pen.color) {
      const hex = appState.toolSettings.pen.color;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex) && colorPicker.value.toLowerCase() !== hex.toLowerCase()) {
        colorPicker.value = hex;
      }
    }
  }
}
