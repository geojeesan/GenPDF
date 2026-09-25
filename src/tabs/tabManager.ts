import { appState, DocumentTab } from '../state/appState';
import { PDFEngine } from '../engine/pdfEngine';
import { HistoryManager } from '../state/history';
import { ViewportManager } from '../viewport/viewportManager';
import { ThumbnailSidebar } from '../sidebar/thumbnailSidebar';

export class TabManager {
  private container: HTMLElement;
  private viewportManager: ViewportManager;
  private sidebar: ThumbnailSidebar;

  constructor(
    container: HTMLElement,
    viewportManager: ViewportManager,
    sidebar: ThumbnailSidebar
  ) {
    this.container = container;
    this.viewportManager = viewportManager;
    this.sidebar = sidebar;

    appState.subscribe(() => {
      this.render();
    });

    this.setupDragAndDrop();
  }

  public render(): void {
    const tabs = appState.getTabs();
    const activeTabId = appState.getActiveTabId();

    this.container.innerHTML = '';

    const tabsListEl = document.createElement('div');
    tabsListEl.className = 'tab-strip-list';

    for (const tab of tabs) {
      const isActive = tab.id === activeTabId;
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${isActive ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`;
      tabEl.setAttribute('data-tab-id', tab.id);

      tabEl.innerHTML = `
        <span class="tab-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </span>
        <span class="tab-title" title="${tab.title}">${tab.title}</span>
        ${tab.isDirty ? '<span class="tab-dirty-indicator" title="Unsaved changes">●</span>' : ''}
        <button class="tab-close-btn" title="Close document">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      // Click tab to activate
      tabEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.tab-close-btn')) return;
        this.switchTab(tab.id);
      });

      // Close tab button
      const closeBtn = tabEl.querySelector('.tab-close-btn')!;
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      tabsListEl.appendChild(tabEl);
    }

    // New Tab (+) Button
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'tab-add-btn';
    newTabBtn.title = 'Open new document';
    newTabBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    newTabBtn.addEventListener('click', () => {
      this.promptOpenFile();
    });

    this.container.appendChild(tabsListEl);
    this.container.appendChild(newTabBtn);
  }

  public async openPDF(title: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const pdfDoc = await PDFEngine.loadDocument(buffer);
      const pageCount = pdfDoc.numPages;

      const newTab: DocumentTab = {
        id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title,
        fileBuffer: buffer,
        pdfDoc,
        pageCount,
        currentPage: 1,
        zoom: 1.0,
        pageRotations: {},
        annotations: {},
        deletedPages: new Set<number>(),
        pageOrder: Array.from({ length: pageCount }, (_, i) => i),
        isDirty: false,
        history: new HistoryManager(),
        scrollPosition: { x: 0, y: 0 },
      };

      appState.addTab(newTab);
      await this.viewportManager.loadDocument(newTab);
      await this.sidebar.render();
      this.viewportManager.fitWidth();
    } catch (err: any) {
      console.error('Failed to open PDF:', err);
      alert(`Could not open PDF: ${err?.message || err}`);
    }
  }

  public async switchTab(id: string): Promise<void> {
    appState.setActiveTab(id);
    const activeTab = appState.getActiveTab();
    if (activeTab) {
      await this.viewportManager.loadDocument(activeTab);
      await this.sidebar.render();
    }
  }

  public closeTab(id: string): void {
    const tab = appState.getTabs().find((t) => t.id === id);
    if (tab && tab.isDirty) {
      const confirmClose = confirm(`Document "${tab.title}" has unsaved changes. Close anyway?`);
      if (!confirmClose) return;
    }

    appState.closeTab(id);
    const nextActive = appState.getActiveTab();
    if (nextActive) {
      this.viewportManager.loadDocument(nextActive);
      this.sidebar.render();
    } else {
      // If no tabs left, open the welcome document
      PDFEngine.createWelcomeDocument().then((buf) => {
        this.openPDF('Welcome to GenPDF.pdf', buf);
      });
    }
  }

  public promptOpenFile(): void {
    const winObj = window as any;
    if (winObj.electronAPI?.openFileDialog) {
      winObj.electronAPI.openFileDialog().then((files: any[]) => {
        if (files && files.length > 0) {
          for (const f of files) {
            this.openPDF(f.name, f.data);
          }
        }
      });
    } else {
      // Browser file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.multiple = true;
      input.onchange = async () => {
        if (input.files) {
          for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            const buffer = await file.arrayBuffer();
            this.openPDF(file.name, buffer);
          }
        }
      };
      input.click();
    }
  }

  private setupDragAndDrop(): void {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
            const buffer = await file.arrayBuffer();
            this.openPDF(file.name, buffer);
          }
        }
      }
    });
  }
}
