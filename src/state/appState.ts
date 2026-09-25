import { Annotation, ToolType } from '../editor/annotationTypes';
import { HistoryManager } from './history';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface DocumentTab {
  id: string;
  title: string;
  fileBuffer: ArrayBuffer;
  pdfDoc: PDFDocumentProxy | null;
  pageCount: number;
  currentPage: number;
  zoom: number; // 1.0 = 100%
  pageRotations: Record<number, number>; // pageIndex -> rotation degrees (0, 90, 180, 270)
  annotations: Record<number, Annotation[]>; // pageIndex -> Annotation[]
  deletedPages: Set<number>;
  pageOrder: number[]; // Array of original page indices representing current order
  isDirty: boolean;
  history: HistoryManager;
  scrollPosition: { x: number; y: number };
}

export interface ToolSettings {
  pen: {
    color: string;
    width: number;
    opacity: number;
  };
  highlight: {
    color: string;
    width: number;
    opacity: number;
  };
  text: {
    fontSize: number;
    fontFamily: string;
    color: string;
    isBold: boolean;
    isItalic: boolean;
    textAlign: 'left' | 'center' | 'right';
  };
  shape: {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    opacity: number;
  };
  redaction: {
    fillColor: string;
  };
}

export type PlatformStyle = 'fluent' | 'gtk4';
export type ThemeMode = 'dark' | 'light';
export type SidebarTab = 'thumbnails' | 'outline' | 'annotations';

export class AppStateManager {
  private tabs: DocumentTab[] = [];
  private activeTabId: string | null = null;
  private currentTool: ToolType = 'select';
  private platformStyle: PlatformStyle = 'fluent';
  private themeMode: ThemeMode = 'dark';
  private sidebarOpen = true;
  private activeSidebarTab: SidebarTab = 'thumbnails';
  private selectedAnnotationId: string | null = null;

  public toolSettings: ToolSettings = {
    pen: {
      color: '#0078d4',
      width: 3,
      opacity: 1,
    },
    highlight: {
      color: '#ffeb3b',
      width: 20,
      opacity: 0.45,
    },
    text: {
      fontSize: 16,
      fontFamily: 'Segoe UI, Cantarell, sans-serif',
      color: '#1a1a1a',
      isBold: false,
      isItalic: false,
      textAlign: 'left',
    },
    shape: {
      strokeColor: '#0078d4',
      fillColor: 'transparent',
      strokeWidth: 2,
      opacity: 1,
    },
    redaction: {
      fillColor: '#000000',
    },
  };

  private listeners: Set<() => void> = new Set();

  constructor() {
    // Detect OS if running in Electron or browser
    const winObj = window as any;
    if (winObj.electronAPI?.platform) {
      this.platformStyle = winObj.electronAPI.platform === 'win32' ? 'fluent' : 'gtk4';
    } else {
      // Check user agent
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('linux')) {
        this.platformStyle = 'gtk4';
      } else {
        this.platformStyle = 'fluent';
      }
    }

    // Check system prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      this.themeMode = 'light';
    } else {
      this.themeMode = 'dark';
    }

    // Query native system accent color from OS (Windows / Linux)
    if (winObj.electronAPI?.getSystemAccentColor) {
      winObj.electronAPI.getSystemAccentColor().then((color: string | null) => {
        if (color) {
          document.documentElement.style.setProperty('--accent-color', color);
          this.toolSettings.pen.color = color;
          this.toolSettings.shape.strokeColor = color;
          this.notify();
        }
      });
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    this.listeners.forEach((l) => l());
  }

  // Tabs Management
  public getTabs(): DocumentTab[] {
    return this.tabs;
  }

  public getActiveTab(): DocumentTab | null {
    return this.tabs.find((t) => t.id === this.activeTabId) || null;
  }

  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  public setActiveTab(id: string): void {
    if (this.activeTabId !== id) {
      this.activeTabId = id;
      this.selectedAnnotationId = null;
      this.notify();
    }
  }

  public addTab(tab: DocumentTab): void {
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.notify();
  }

  public closeTab(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    this.tabs.splice(idx, 1);
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        const nextIdx = Math.max(0, idx - 1);
        this.activeTabId = this.tabs[nextIdx].id;
      } else {
        this.activeTabId = null;
      }
    }
    this.notify();
  }

  // Tool Management
  public getTool(): ToolType {
    return this.currentTool;
  }

  public setTool(tool: ToolType): void {
    if (this.currentTool !== tool) {
      this.currentTool = tool;
      if (tool !== 'select') {
        this.selectedAnnotationId = null;
      }
      this.notify();
    }
  }

  // Selected Annotation
  public getSelectedAnnotationId(): string | null {
    return this.selectedAnnotationId;
  }

  public setSelectedAnnotationId(id: string | null): void {
    if (this.selectedAnnotationId !== id) {
      this.selectedAnnotationId = id;
      this.notify();
    }
  }

  // UI Customization
  public getPlatformStyle(): PlatformStyle {
    return this.platformStyle;
  }

  public setPlatformStyle(style: PlatformStyle): void {
    this.platformStyle = style;
    document.documentElement.setAttribute('data-platform', style);
    this.notify();
  }

  public togglePlatformStyle(): void {
    this.setPlatformStyle(this.platformStyle === 'fluent' ? 'gtk4' : 'fluent');
  }

  public getThemeMode(): ThemeMode {
    return this.themeMode;
  }

  public setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    document.documentElement.setAttribute('data-theme', mode);
    this.notify();
  }

  public toggleTheme(): void {
    this.setThemeMode(this.themeMode === 'dark' ? 'light' : 'dark');
  }

  public isSidebarOpen(): boolean {
    return this.sidebarOpen;
  }

  public toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.notify();
  }

  public getActiveSidebarTab(): SidebarTab {
    return this.activeSidebarTab;
  }

  public setActiveSidebarTab(tab: SidebarTab): void {
    this.activeSidebarTab = tab;
    this.notify();
  }
}

export const appState = new AppStateManager();
