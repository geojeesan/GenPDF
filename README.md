# GenPDF Studio

A modern, high-performance cross-platform PDF Viewer and Editor built for **Windows** (Fluent UI with Mica background effect) and **Linux GNOME** (GTK 4 / Libadwaita).

GenPDF Studio is not just a PDF.js viewer wrapper—it integrates an interactive vector drawing and annotation layer, multi-tab document management, a thumbnail page organizer, and native byte-level PDF modification and export powered by `pdf-lib`.

---

## Key Features

### 1. Dual Modern Design Systems
- **Windows 11 Fluent UI**:
  - Translucent **Mica backdrop** effect (`backgroundMaterial: 'mica'`, layered acrylic, frosted glassmorphism).
  - Native Windows titlebar caption controls (Minimize, Maximize/Restore, Close) with exact 38px height, 46px width, and double-click to maximize/restore.
  - Automatic detection and adoption of the Windows **System Accent Color**.
  - Modern Segoe UI typography and Fluent tab strip with active accent indicators.
- **Linux GNOME GTK 4 / Libadwaita**:
  - GNOME 45+ HeaderBar styling with centered document title.
  - `AdwTabBar` / `AdwTabView` styled pill tabs.
  - Libadwaita color scheme (Adwaita blue `#3584e4`, dark/light surfaces).
  - Cantarell / GNOME typography and symbolic icons.
- **Automatic Theme & Platform Detection**: Automatically detects your operating system and dark/light color scheme preferences.

### 2. Full PDF Editing & Modification (pdf-lib Core)
- **Rich Text Boxes**: Add draggable, resizable text boxes with custom font size, font family, color, bold, and italic formatting. Text can be edited inline and moved from both the center and resize handles.
- **Freehand Pen & Ink**: Draw with smooth Catmull-Rom curve interpolation, custom line thickness, and opacity.
- **Highlighter**: Translucent text highlighter brush with `multiply` blend mode.
- **Vector Shapes**: Draw Rectangles, Circles/Ellipses, Lines, and Arrows with customizable stroke and fill colors.
- **Digital Signatures**: Draw signatures with mouse/trackpad/stylus or generate cursive typed signatures, automatically placed on the currently visible page.
- **Rubber Stamps**: Place official stamps (`APPROVED`, `CONFIDENTIAL`, `DRAFT`, `REVIEWED`) with timestamps.
- **Redaction / Whiteout**: Block out sensitive sections cleanly.
- **Byte-level PDF Export**: Automatically bakes all annotations, shapes, text, signatures, rotations, and page order into a valid standard PDF 1.7 file that works in Acrobat, Apple Preview, Edge, or Evince.

### 3. Trackpad Gestures & Smooth Zooming
- **Pinch-to-Zoom**: Native trackpad pinch gesture handling (`Ctrl + Wheel`) anchored smoothly to the trackpad cursor location without canvas blackout.
- **Native Smooth Scrolling**: Pure, continuous two-finger scrolling without laggy overscroll resistance.
- **Smooth Panning**: Hand tool (`H`) and middle-click panning for precise navigation.
- **Zoom Presets**: Fit to Width, Fit to Page, Zoom In (+), and Zoom Out (-).
- **High-DPI Rendering**: Automatically scales canvas using `window.devicePixelRatio` for tack-sharp text and graphics.

### 4. Multi-Tab Document Management
- Open multiple PDF files simultaneously.
- Independent zoom, scroll position, page rotations, and history per tab.
- Unsaved changes indicator (`●`) on dirty tabs with close prompts.
- Drag & Drop PDF files directly into the window or onto the tab bar to open.

### 5. Thumbnail Sidebar & Page Organizer
- Live asynchronous rendering of page thumbnails.
- Active page highlight border.
- **Drag-and-Drop Page Reordering**: Grab any thumbnail to change page sequence.
- **Rotate Pages**: 90° clockwise and counter-clockwise rotation per page.
- **Delete Pages**: Quick removal of unwanted pages.
- Outline / Bookmarks inspector and Annotations list inspector.

---

## Project Structure

```
GenPDF/
├── electron/
│   ├── main.js             # Electron main process (Mica, native window management, IPC)
│   └── preload.js          # Secure contextBridge API for filesystem, dialogs, and window controls
├── src/
│   ├── editor/
│   │   ├── annotationLayer.ts # Interactive SVG + HTML annotation canvas
│   │   └── annotationTypes.ts # Type definitions for all annotation shapes & tools
│   ├── engine/
│   │   ├── pageRenderer.ts    # High-DPI PDF.js page rendering with cancelation
│   │   ├── pdfEngine.ts       # Document loading and thumbnail generation
│   │   └── pdfExporter.ts     # pdf-lib binary compilation & annotation baking
│   ├── sidebar/
│   │   └── thumbnailSidebar.ts# Thumbnails, drag-and-drop reordering, rotate, delete
│   ├── state/
│   │   ├── appState.ts        # Reactive state manager, system accent, tools
│   │   └── history.ts         # Undo / Redo history stack
│   ├── styles/
│   │   ├── base.css           # Core layout, window controls, scrollbars
│   │   ├── fluent.css         # Windows 11 Fluent UI, Mica glass, Segoe UI
│   │   ├── gtk4.css           # Linux GNOME 45+ GTK 4 / Libadwaita styling
│   │   └── annotations.css    # Interactive overlay handles and controls
│   ├── tabs/
│   │   └── tabManager.ts      # Multi-document tabs, dirty tracking, drag-drop
│   ├── ui/
│   │   ├── titlebar.ts        # Custom draggable titlebar and window controls
│   │   ├── toolbar.ts         # Annotation toolstrip, color picker, zoom controls
│   │   └── signatureDialog.ts # Digital signature pad & cursive typography generator
│   ├── viewport/
│   │   └── viewportManager.ts # Virtualized scroll viewport & trackpad pinch-zoom
│   └── main.ts                # Application bootstrap
├── run-dev.sh                 # Linux launch script for Vite dev server
├── run-electron.sh            # Linux launch script for native Electron desktop app
├── run-dev.bat                # Windows launch script for Vite dev server
├── run-electron.bat           # Windows launch script for native Electron desktop app
├── tsconfig.json              # TypeScript configuration
└── vite.config.ts             # Vite bundler configuration
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node.js 18 & 20 LTS)
- npm 9+

### Quick Launch Scripts

#### Linux
```bash
# Launch native desktop application (GTK 4 / Libadwaita styling)
./run-electron.sh [optional-file.pdf]

# Or launch Vite development server (http://localhost:5173/)
./run-dev.sh
```

#### Windows
- Double click or execute `.\run-electron.bat` to launch the native desktop application with Mica effect.
- Double click or execute `.\run-dev.bat` to launch the Vite local dev server.

### Manual Commands

```bash
# Install dependencies
npm install

# Start Vite development server (http://localhost:5173/)
npm run dev

# Run native Electron desktop app
npm run electron

# Build for production
npm run build
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + Z` | Undo annotation edit |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Ctrl + O` | Open PDF file |
| `Ctrl + S` | Export & Save PDF |
| `Ctrl + Wheel` / Trackpad Pinch | Smooth Pinch-to-Zoom |
| `Ctrl + +` / `Ctrl + -` | Zoom in / Zoom out |
| `V` | Select & Move/Resize Tool |
| `H` | Hand Pan Tool |
| `T` | Add Text Box |
| `P` | Freehand Pen / Ink |
| `Delete` / `Backspace` | Delete selected annotation |
| Double-Click Titlebar | Maximize / Restore window |
