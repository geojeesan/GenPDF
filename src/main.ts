import { appState } from './state/appState';
import { PDFEngine } from './engine/pdfEngine';
import { Titlebar } from './ui/titlebar';
import { Toolbar } from './ui/toolbar';
import { SignatureDialog } from './ui/signatureDialog';
import { ViewportManager } from './viewport/viewportManager';
import { ThumbnailSidebar } from './sidebar/thumbnailSidebar';
import { TabManager } from './tabs/tabManager';

async function bootstrap() {
  const titlebarContainer = document.getElementById('titlebar-container')!;
  const tabsContainer = document.getElementById('tabs-container')!;
  const toolbarContainer = document.getElementById('toolbar-container')!;
  const sidebarContainer = document.getElementById('sidebar-container')!;
  const viewportContainer = document.getElementById('viewport-container')!;

  // Set initial data attributes for platform & theme
  document.documentElement.setAttribute('data-platform', appState.getPlatformStyle());
  document.documentElement.setAttribute('data-theme', appState.getThemeMode());
  document.getElementById('app')!.setAttribute('data-tool', appState.getTool());

  // Instantiate UI Components
  const titlebar = new Titlebar(titlebarContainer);
  const signatureDialog = new SignatureDialog();
  const viewportManager = new ViewportManager(viewportContainer);
  const sidebar = new ThumbnailSidebar(sidebarContainer, viewportManager);
  const tabManager = new TabManager(tabsContainer, viewportManager, sidebar);
  const toolbar = new Toolbar(toolbarContainer, viewportManager, signatureDialog);

  // Attach global references for debugging or cross-module access
  (window as any).appState = appState;
  (window as any).tabManager = tabManager;
  (window as any).viewportManager = viewportManager;

  // React to app state changes
  appState.subscribe(() => {
    // Sync sidebar open/close
    if (appState.isSidebarOpen()) {
      sidebarContainer.classList.remove('collapsed');
    } else {
      sidebarContainer.classList.add('collapsed');
    }

    // Sync active tool attribute for cursor styles
    document.getElementById('app')!.setAttribute('data-tool', appState.getTool());
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const activeTag = document.activeElement?.tagName.toLowerCase();
    const isTyping = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable');

    if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      const tab = appState.getActiveTab();
      if (tab) {
        tab.history.undo();
        viewportManager.refreshAnnotations();
      }
    } else if (isCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      const tab = appState.getActiveTab();
      if (tab) {
        tab.history.redo();
        viewportManager.refreshAnnotations();
      }
    } else if (isCtrl && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      tabManager.promptOpenFile();
    } else if (isCtrl && e.key === '=') {
      e.preventDefault();
      viewportManager.zoomIn();
    } else if (isCtrl && e.key === '-') {
      e.preventDefault();
      viewportManager.zoomOut();
    } else if (isCtrl && e.key === '0') {
      e.preventDefault();
      viewportManager.fitWidth();
    } else if (!isCtrl && !isTyping) {
      if (e.key.toLowerCase() === 'v') appState.setTool('select');
      if (e.key.toLowerCase() === 'h') appState.setTool('hand');
      if (e.key.toLowerCase() === 't') appState.setTool('text');
      if (e.key.toLowerCase() === 'p') appState.setTool('pen');
    }
  });

  // Load interactive demo PDF on startup
  try {
    const welcomeBuffer = await PDFEngine.createWelcomeDocument();
    await tabManager.openPDF('Welcome to GenPDF.pdf', welcomeBuffer);
  } catch (err) {
    console.error('Failed to create welcome document:', err);
  }
}

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
