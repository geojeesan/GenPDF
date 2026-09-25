import { appState } from '../state/appState';

export class Titlebar {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();

    appState.subscribe(() => {
      this.updateTitle();
    });
  }

  public render(): void {
    const isFluent = appState.getPlatformStyle() === 'fluent';

    this.container.innerHTML = `
      <div class="titlebar-drag-region">
        <div class="titlebar-left">
          <div class="app-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <path d="M12 18v-6"></path>
              <path d="m9 15 3 3 3-3"></path>
            </svg>
          </div>
          <span class="app-title">GenPDF Studio</span>
        </div>

        <div class="titlebar-center">
          <span class="document-name-header">Welcome to GenPDF.pdf</span>
        </div>

        <div class="titlebar-right">
          <div class="window-controls ${isFluent ? 'fluent-controls' : 'gtk-controls'}">
            <button class="win-btn win-min-btn" title="Minimize" aria-label="Minimize">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M 0,5 L 10,5" stroke="currentColor" stroke-width="1" />
              </svg>
            </button>
            <button class="win-btn win-max-btn" title="Maximize" aria-label="Maximize">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                <rect x="0.5" y="0.5" width="9" height="9" stroke-width="1" />
              </svg>
            </button>
            <button class="win-btn win-close-btn" title="Close" aria-label="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                <path d="M 1,1 L 9,9 M 9,1 L 1,9" stroke-width="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const winObj = window as any;

    const dragRegion = this.container.querySelector('.titlebar-drag-region');
    if (dragRegion) {
      dragRegion.addEventListener('dblclick', (e) => {
        if ((e.target as HTMLElement).closest('.window-controls')) return;
        if (winObj.electronAPI?.maximizeWindow) {
          winObj.electronAPI.maximizeWindow();
        }
      });
    }

    const minBtn = this.container.querySelector('.win-min-btn');
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (winObj.electronAPI?.minimizeWindow) {
          winObj.electronAPI.minimizeWindow();
        }
      });
    }

    const maxBtn = this.container.querySelector('.win-max-btn');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (winObj.electronAPI?.maximizeWindow) {
          winObj.electronAPI.maximizeWindow();
        }
      });
    }

    const closeBtn = this.container.querySelector('.win-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (winObj.electronAPI?.closeWindow) {
          winObj.electronAPI.closeWindow();
        }
      });
    }

    if (winObj.electronAPI?.onMaximizedChange) {
      winObj.electronAPI.onMaximizedChange((isMax: boolean) => {
        this.updateMaximizedState(isMax);
      });
    }

    const checkMax = async () => {
      if (winObj.electronAPI?.isMaximized) {
        const isMax = await winObj.electronAPI.isMaximized();
        this.updateMaximizedState(isMax);
      }
    };
    checkMax();
    window.addEventListener('resize', checkMax);
  }

  private updateMaximizedState(isMax: boolean): void {
    const maxBtn = this.container.querySelector('.win-max-btn');
    if (!maxBtn) return;
    if (isMax) {
      maxBtn.setAttribute('title', 'Restore');
      maxBtn.setAttribute('aria-label', 'Restore');
      maxBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
          <path d="M 2.5,0.5 L 9.5,0.5 L 9.5,7.5" stroke-width="1" />
          <rect x="0.5" y="2.5" width="7" height="7" stroke-width="1" />
        </svg>
      `;
    } else {
      maxBtn.setAttribute('title', 'Maximize');
      maxBtn.setAttribute('aria-label', 'Maximize');
      maxBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
          <rect x="0.5" y="0.5" width="9" height="9" stroke-width="1" />
        </svg>
      `;
    }
  }

  private updateTitle(): void {
    const tab = appState.getActiveTab();
    const docNameEl = this.container.querySelector('.document-name-header');
    if (docNameEl && tab) {
      docNameEl.textContent = `${tab.title}${tab.isDirty ? ' •' : ''}`;
    }
  }
}
