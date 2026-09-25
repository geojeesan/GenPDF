import { appState } from '../state/appState';
import { SignatureAnnotation } from '../editor/annotationTypes';

export class SignatureDialog {
  private overlay: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private points: { x: number; y: number }[] = [];
  private onSignatureReady?: (dataUrl: string) => void;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop signature-modal-overlay';
    this.overlay.style.display = 'none';

    this.overlay.innerHTML = `
      <div class="modal-dialog signature-dialog">
        <div class="modal-header">
          <h3>Add Digital Signature</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="signature-tabs">
          <button class="sig-tab active" data-tab="draw">Draw</button>
          <button class="sig-tab" data-tab="type">Type</button>
        </div>
        <div class="signature-body">
          <div class="sig-view sig-view-draw">
            <div class="sig-canvas-container">
              <canvas class="sig-pad-canvas" width="500" height="200"></canvas>
              <div class="sig-baseline"></div>
            </div>
            <div class="sig-canvas-footer">
              <button class="fluent-btn sig-clear-btn">Clear</button>
              <div class="sig-pen-colors">
                <span class="color-dot active" data-color="#000000" style="background:#000000;"></span>
                <span class="color-dot" data-color="#002060" style="background:#002060;"></span>
                <span class="color-dot" data-color="#0078d4" style="background:#0078d4;"></span>
              </div>
            </div>
          </div>
          <div class="sig-view sig-view-type" style="display:none;">
            <input type="text" class="sig-text-input" placeholder="Type your name" value="John Doe" />
            <div class="sig-font-previews">
              <div class="sig-preview-card active" data-font="'Brush Script MT', 'Dancing Script', cursive">
                <span class="sig-text-preview" style="font-family: 'Brush Script MT', cursive;">John Doe</span>
              </div>
              <div class="sig-preview-card" data-font="'Segoe Script', cursive">
                <span class="sig-text-preview" style="font-family: 'Segoe Script', cursive;">John Doe</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="fluent-btn btn-secondary modal-cancel-btn">Cancel</button>
          <button class="fluent-btn btn-primary sig-insert-btn">Insert Signature</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.canvas = this.overlay.querySelector('.sig-pad-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupEvents();
  }

  private setupEvents(): void {
    let activeColor = '#000000';
    let activeFont = "'Brush Script MT', cursive";
    let activeTab = 'draw';

    // Close / Cancel
    this.overlay.querySelector('.modal-close-btn')!.addEventListener('click', () => this.hide());
    this.overlay.querySelector('.modal-cancel-btn')!.addEventListener('click', () => this.hide());

    // Switch Tabs
    const tabs = this.overlay.querySelectorAll('.sig-tab');
    const drawView = this.overlay.querySelector('.sig-view-draw') as HTMLElement;
    const typeView = this.overlay.querySelector('.sig-view-type') as HTMLElement;

    tabs.forEach((t) => {
      t.addEventListener('click', (e) => {
        tabs.forEach((tab) => tab.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        activeTab = (e.currentTarget as HTMLElement).getAttribute('data-tab') || 'draw';

        if (activeTab === 'draw') {
          drawView.style.display = 'block';
          typeView.style.display = 'none';
        } else {
          drawView.style.display = 'none';
          typeView.style.display = 'block';
        }
      });
    });

    // Clear Canvas
    this.overlay.querySelector('.sig-clear-btn')!.addEventListener('click', () => {
      this.clearCanvas();
    });

    // Colors
    const dots = this.overlay.querySelectorAll('.color-dot');
    dots.forEach((d) => {
      d.addEventListener('click', (e) => {
        dots.forEach((dot) => dot.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        activeColor = (e.currentTarget as HTMLElement).getAttribute('data-color') || '#000000';
      });
    });

    // Type input updates previews
    const input = this.overlay.querySelector('.sig-text-input') as HTMLInputElement;
    const previews = this.overlay.querySelectorAll('.sig-text-preview');
    input.addEventListener('input', () => {
      const val = input.value.trim() || 'Signature';
      previews.forEach((p) => ((p as HTMLElement).innerText = val));
    });

    // Font cards
    const cards = this.overlay.querySelectorAll('.sig-preview-card');
    cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        cards.forEach((c) => c.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        activeFont = (e.currentTarget as HTMLElement).getAttribute('data-font') || '';
      });
    });

    // Drawing on canvas
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDrawing = true;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.points = [{ x, y }];

      this.ctx.strokeStyle = activeColor;
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDrawing) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.points.push({ x, y });

      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    });

    window.addEventListener('pointerup', () => {
      if (this.isDrawing) {
        this.isDrawing = false;
      }
    });

    // Insert Signature button
    this.overlay.querySelector('.sig-insert-btn')!.addEventListener('click', () => {
      let dataUrl = '';
      if (activeTab === 'draw') {
        dataUrl = this.canvas.toDataURL('image/png');
      } else {
        // Render typed signature to transparent canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 150;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.font = `44px ${activeFont}`;
        tempCtx.fillStyle = activeColor;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText(input.value || 'Signature', 200, 75);
        dataUrl = tempCanvas.toDataURL('image/png');
      }

      if (this.onSignatureReady) {
        this.onSignatureReady(dataUrl);
      }
      this.hide();
    });
  }

  public show(onReady: (dataUrl: string) => void): void {
    this.onSignatureReady = onReady;
    this.clearCanvas();
    this.overlay.style.display = 'flex';
  }

  public hide(): void {
    this.overlay.style.display = 'none';
  }

  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.points = [];
  }
}
