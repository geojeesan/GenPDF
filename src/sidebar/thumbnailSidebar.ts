import { appState } from '../state/appState';
import { PageRenderer } from '../engine/pageRenderer';
import { ViewportManager } from '../viewport/viewportManager';

export class ThumbnailSidebar {
  private container: HTMLElement;
  private viewportManager: ViewportManager;
  private dragSrcIndex: number | null = null;

  constructor(container: HTMLElement, viewportManager: ViewportManager) {
    this.container = container;
    this.viewportManager = viewportManager;

    appState.subscribe(() => {
      this.updateActivePageHighlight();
    });
  }

  public async render(): Promise<void> {
    const tab = appState.getActiveTab();
    if (!tab || !tab.pdfDoc) {
      this.container.innerHTML = `
        <div class="sidebar-empty">
          <p>No document open</p>
        </div>
      `;
      return;
    }

    const activeSidebarTab = appState.getActiveSidebarTab();
    this.container.innerHTML = '';

    // Sidebar header tabs
    const headerEl = document.createElement('div');
    headerEl.className = 'sidebar-header-tabs';
    headerEl.innerHTML = `
      <button class="sidebar-tab-btn ${activeSidebarTab === 'thumbnails' ? 'active' : ''}" data-tab="thumbnails" title="Page Thumbnails">
        Pages (${tab.pageOrder.length - tab.deletedPages.size})
      </button>
      <button class="sidebar-tab-btn ${activeSidebarTab === 'outline' ? 'active' : ''}" data-tab="outline" title="Bookmarks / Outline">
        Outline
      </button>
      <button class="sidebar-tab-btn ${activeSidebarTab === 'annotations' ? 'active' : ''}" data-tab="annotations" title="Annotations">
        Annotations
      </button>
    `;
    this.container.appendChild(headerEl);

    headerEl.querySelectorAll('.sidebar-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetTab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;
        appState.setActiveSidebarTab(targetTab);
        this.render();
      });
    });

    const contentEl = document.createElement('div');
    contentEl.className = 'sidebar-content-scroll';
    this.container.appendChild(contentEl);

    if (activeSidebarTab === 'thumbnails') {
      await this.renderThumbnailsView(contentEl, tab);
    } else if (activeSidebarTab === 'outline') {
      await this.renderOutlineView(contentEl, tab);
    } else {
      this.renderAnnotationsView(contentEl, tab);
    }
  }

  private async renderThumbnailsView(parent: HTMLElement, tab: any): Promise<void> {
    const listEl = document.createElement('div');
    listEl.className = 'thumbnail-list';
    parent.appendChild(listEl);

    const validIndices = tab.pageOrder.filter((idx: number) => !tab.deletedPages.has(idx));

    for (let displayIndex = 0; displayIndex < validIndices.length; displayIndex++) {
      const pageIndex = validIndices[displayIndex];

      const itemEl = document.createElement('div');
      itemEl.className = `thumbnail-item ${tab.currentPage === pageIndex + 1 ? 'active' : ''}`;
      itemEl.setAttribute('data-page-index', pageIndex.toString());
      itemEl.setAttribute('draggable', 'true');

      // Thumbnail Canvas
      const canvasWrapper = document.createElement('div');
      canvasWrapper.className = 'thumbnail-canvas-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'thumbnail-canvas';
      canvasWrapper.appendChild(canvas);
      itemEl.appendChild(canvasWrapper);

      // Thumbnail Footer (page number + actions)
      const footerEl = document.createElement('div');
      footerEl.className = 'thumbnail-footer';
      footerEl.innerHTML = `
        <span class="thumbnail-page-num">${displayIndex + 1}</span>
        <div class="thumbnail-actions">
          <button class="thumb-act-btn rotate-btn" title="Rotate Clockwise">↻</button>
          <button class="thumb-act-btn delete-btn" title="Delete Page">✕</button>
        </div>
      `;
      itemEl.appendChild(footerEl);
      listEl.appendChild(itemEl);

      // Click to scroll
      canvasWrapper.addEventListener('click', () => {
        this.viewportManager.scrollToPage(pageIndex);
        tab.currentPage = pageIndex + 1;
        this.updateActivePageHighlight();
      });

      // Rotate action
      const rotateBtn = footerEl.querySelector('.rotate-btn')!;
      rotateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentRot = tab.pageRotations[pageIndex] || 0;
        tab.pageRotations[pageIndex] = (currentRot + 90) % 360;
        tab.isDirty = true;
        this.viewportManager.refreshPage(pageIndex);
        PageRenderer.renderThumbnail(tab.pdfDoc, pageIndex + 1, canvas, 130, tab.pageRotations[pageIndex]);
        appState.notify();
      });

      // Delete action
      const deleteBtn = footerEl.querySelector('.delete-btn')!;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (validIndices.length <= 1) {
          alert('A document must have at least one page.');
          return;
        }
        tab.deletedPages.add(pageIndex);
        tab.isDirty = true;
        this.viewportManager.loadDocument(tab);
        this.render();
      });

      // Drag and drop reordering
      itemEl.addEventListener('dragstart', (e) => {
        this.dragSrcIndex = pageIndex;
        itemEl.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
      });

      itemEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        itemEl.classList.add('drag-over');
      });

      itemEl.addEventListener('dragleave', () => {
        itemEl.classList.remove('drag-over');
      });

      itemEl.addEventListener('drop', (e) => {
        e.preventDefault();
        itemEl.classList.remove('drag-over');
        if (this.dragSrcIndex === null || this.dragSrcIndex === pageIndex) return;

        // Reorder pageOrder array
        const fromIdx = tab.pageOrder.indexOf(this.dragSrcIndex);
        const toIdx = tab.pageOrder.indexOf(pageIndex);

        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = tab.pageOrder.splice(fromIdx, 1);
          tab.pageOrder.splice(toIdx, 0, moved);
          tab.isDirty = true;
          this.viewportManager.loadDocument(tab);
          this.render();
        }
        this.dragSrcIndex = null;
      });

      itemEl.addEventListener('dragend', () => {
        itemEl.classList.remove('dragging');
      });

      // Asynchronously render thumbnail canvas
      const rot = tab.pageRotations[pageIndex] || 0;
      PageRenderer.renderThumbnail(tab.pdfDoc, pageIndex + 1, canvas, 130, rot);
    }
  }

  private async renderOutlineView(parent: HTMLElement, tab: any): Promise<void> {
    const outline = await tab.pdfDoc.getOutline();
    if (!outline || outline.length === 0) {
      parent.innerHTML = `
        <div class="sidebar-empty">
          <p>No document bookmarks or outline available in this file.</p>
        </div>
      `;
      return;
    }

    const outlineList = document.createElement('div');
    outlineList.className = 'outline-list';

    for (const item of outline) {
      const itemEl = document.createElement('div');
      itemEl.className = 'outline-item';
      itemEl.textContent = item.title;
      itemEl.addEventListener('click', async () => {
        if (typeof item.dest === 'string') {
          const dest = await tab.pdfDoc.getDestination(item.dest);
          if (dest) {
            const pageRef = dest[0];
            const pageIndex = await tab.pdfDoc.getPageIndex(pageRef);
            this.viewportManager.scrollToPage(pageIndex);
          }
        }
      });
      outlineList.appendChild(itemEl);
    }
    parent.appendChild(outlineList);
  }

  private renderAnnotationsView(parent: HTMLElement, tab: any): void {
    const listEl = document.createElement('div');
    listEl.className = 'annotations-inspector-list';

    let count = 0;
    for (const [pageIdxStr, anns] of Object.entries(tab.annotations)) {
      const pageIndex = Number(pageIdxStr);
      const annList = anns as any[];

      for (const ann of annList) {
        count++;
        const itemEl = document.createElement('div');
        itemEl.className = 'annotation-list-card';
        itemEl.innerHTML = `
          <div class="ann-card-header">
            <span class="ann-badge ann-${ann.type}">${ann.type.toUpperCase()}</span>
            <span class="ann-page-tag">Page ${pageIndex + 1}</span>
          </div>
          <div class="ann-card-desc">
            ${ann.text ? ann.text.slice(0, 30) : (ann.label || `Shape (${ann.strokeColor || '#0078d4'})`)}
          </div>
        `;
        itemEl.addEventListener('click', () => {
          this.viewportManager.scrollToPage(pageIndex);
          appState.setSelectedAnnotationId(ann.id);
          this.viewportManager.refreshAnnotations();
        });
        listEl.appendChild(itemEl);
      }
    }

    if (count === 0) {
      parent.innerHTML = `
        <div class="sidebar-empty">
          <p>No annotations in this document yet.</p>
          <small>Use the top toolbar to add text, ink, or shapes.</small>
        </div>
      `;
      return;
    }

    parent.appendChild(listEl);
  }

  private updateActivePageHighlight(): void {
    const tab = appState.getActiveTab();
    if (!tab) return;

    this.container.querySelectorAll('.thumbnail-item').forEach((item) => {
      const idx = Number(item.getAttribute('data-page-index'));
      if (tab.currentPage === idx + 1) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}
