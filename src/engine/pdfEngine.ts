import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker || '/pdf.worker.min.js';
}

export class PDFEngine {
  /**
   * Load PDF document from ArrayBuffer using PDF.js
   */
  public static async loadDocument(buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    // Clone buffer so PDF.js worker transfer does not neuter the original buffer
    const bufferClone = buffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(bufferClone),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });
    return await loadingTask.promise;
  }

  /**
   * Extract document outline / bookmarks
   */
  public static async getOutline(pdfDoc: PDFDocumentProxy): Promise<any[]> {
    try {
      const outline = await pdfDoc.getOutline();
      return outline || [];
    } catch {
      return [];
    }
  }

  /**
   * Creates a rich, interactive Welcome PDF document using pdf-lib
   * so the app starts with a complete multi-page document demonstrating all features.
   */
  public static async createWelcomeDocument(): Promise<ArrayBuffer> {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // PAGE 1: Welcome & Overview
    const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page1.getSize();

    // Top Header Banner
    page1.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: rgb(0.0, 0.47, 0.83), // Fluent / Adwaita Blue
    });

    page1.drawText('GenPDF Studio', {
      x: 45,
      y: height - 60,
      size: 32,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    page1.drawText('High-Performance Modern Cross-Platform PDF Viewer & Editor', {
      x: 45,
      y: height - 90,
      size: 14,
      font: helvetica,
      color: rgb(0.9, 0.95, 1),
    });

    // Content Section
    let currentY = height - 160;

    page1.drawText('Welcome to GenPDF', {
      x: 45,
      y: currentY,
      size: 20,
      font: helveticaBold,
      color: rgb(0.12, 0.12, 0.12),
    });

    currentY -= 28;
    const introText = [
      'GenPDF is engineered from the ground up to deliver a native, fluid, and powerful PDF experience.',
      'Unlike simple PDF.js wrappers, GenPDF features a custom interactive vector and annotation engine,',
      'full multi-tab document management, page reordering, and native byte-level PDF export via pdf-lib.',
      'It dynamically adapts to Windows Fluent UI (with Mica backdrop) and Linux GNOME GTK 4 / Libadwaita.'
    ];

    for (const line of introText) {
      page1.drawText(line, {
        x: 45,
        y: currentY,
        size: 11,
        font: helvetica,
        color: rgb(0.25, 0.25, 0.25),
      });
      currentY -= 18;
    }

    currentY -= 15;

    // Feature Cards
    const features = [
      {
        title: 'Trackpad Gestures & Smooth Zoom',
        desc: 'Pinch to zoom with your trackpad or Ctrl+Wheel. Smooth 60fps continuous panning with inertia.',
      },
      {
        title: 'Full Vector & Text Editing',
        desc: 'Add editable rich text boxes, Catmull-Rom smoothed pen ink, translucent highlighters, and shapes.',
      },
      {
        title: 'Signatures & Stamps',
        desc: 'Draw digital signatures, type cursive signatures, or place official approval and confidential stamps.',
      },
      {
        title: 'Page Organizer & Thumbnail Sidebar',
        desc: 'Drag and drop to reorder pages, rotate clockwise/counter-clockwise, or delete pages on the fly.',
      },
      {
        title: 'Multi-Tab Productivity',
        desc: 'Open multiple PDFs simultaneously in independent tabs with individual undo/redo and zoom states.',
      },
      {
        title: 'Dual Design Systems (Fluent Mica & GTK 4)',
        desc: 'Switch effortlessly between Windows 11 Fluent UI with Mica glass and GNOME GTK 4 Libadwaita.',
      },
    ];

    for (const feat of features) {
      // Card background
      page1.drawRectangle({
        x: 45,
        y: currentY - 50,
        width: width - 90,
        height: 58,
        color: rgb(0.96, 0.97, 0.98),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1,
      });

      page1.drawText(feat.title, {
        x: 60,
        y: currentY - 18,
        size: 13,
        font: helveticaBold,
        color: rgb(0.0, 0.4, 0.75),
      });

      page1.drawText(feat.desc, {
        x: 60,
        y: currentY - 36,
        size: 10,
        font: helvetica,
        color: rgb(0.35, 0.35, 0.35),
      });

      currentY -= 68;
    }

    // Footer note
    page1.drawText('Try selecting any tool from the top toolbar to start annotating this document right now!', {
      x: 45,
      y: 40,
      size: 10,
      font: helveticaOblique,
      color: rgb(0.5, 0.5, 0.5),
    });

    // PAGE 2: Sample Form & Interactive Playground
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    
    page2.drawText('Interactive Document Playground', {
      x: 45,
      y: height - 60,
      size: 22,
      font: helveticaBold,
      color: rgb(0.12, 0.12, 0.12),
    });

    page2.drawText('Test annotations, signatures, shapes, and page reorganization below.', {
      x: 45,
      y: height - 85,
      size: 12,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Drawing box playground
    page2.drawRectangle({
      x: 45,
      y: height - 280,
      width: width - 90,
      height: 170,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1.5,
    });

    page2.drawText('Freehand Pen & Highlighter Test Zone', {
      x: 60,
      y: height - 125,
      size: 12,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    page2.drawText('Use the Pen tool to sketch or sign. Use the Highlighter to highlight this text passage.', {
      x: 60,
      y: height - 145,
      size: 10,
      font: helvetica,
      color: rgb(0.45, 0.45, 0.45),
    });

    // Signature Area
    page2.drawRectangle({
      x: 45,
      y: height - 440,
      width: 240,
      height: 120,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
    });

    page2.drawText('Authorized Signature', {
      x: 60,
      y: height - 340,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    page2.drawLine({
      start: { x: 60, y: height - 400 },
      end: { x: 260, y: height - 400 },
      thickness: 1,
      color: rgb(0.6, 0.6, 0.6),
    });

    page2.drawText('Click the Signature tool above to place your signature here', {
      x: 60,
      y: height - 425,
      size: 8,
      font: helveticaOblique,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Stamp Area
    page2.drawRectangle({
      x: 310,
      y: height - 440,
      width: 240,
      height: 120,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
    });

    page2.drawText('Official Document Stamp', {
      x: 325,
      y: height - 340,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    page2.drawText('Select the Stamp tool (Approved / Confidential / Draft) and place it here.', {
      x: 325,
      y: height - 380,
      size: 9,
      font: helvetica,
      color: rgb(0.45, 0.45, 0.45),
    });

    // Table / Grid Demonstration
    page2.drawText('Sample Data Table', {
      x: 45,
      y: height - 480,
      size: 14,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    // Table Header
    page2.drawRectangle({
      x: 45,
      y: height - 515,
      width: width - 90,
      height: 25,
      color: rgb(0.9, 0.93, 0.96),
    });

    page2.drawText('Module', { x: 55, y: height - 505, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page2.drawText('Target Platform', { x: 180, y: height - 505, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page2.drawText('Rendering Engine', { x: 320, y: height - 505, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page2.drawText('Status', { x: 480, y: height - 505, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });

    const rows = [
      ['Windows UI', 'Windows 11 / 10', 'Fluent UI with Mica Backdrop', 'Active'],
      ['GNOME UI', 'Linux GNOME 45+', 'GTK 4 / Libadwaita Design', 'Active'],
      ['Gesture Engine', 'Trackpad / Touch', 'Continuous 60fps Pinch Zoom', 'Active'],
      ['PDF Serializer', 'Standard PDF 1.7', 'Native byte-level pdf-lib export', 'Active'],
    ];

    let rowY = height - 540;
    for (const r of rows) {
      page2.drawLine({
        start: { x: 45, y: rowY + 18 },
        end: { x: width - 45, y: rowY + 18 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });

      page2.drawText(r[0], { x: 55, y: rowY, size: 9, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
      page2.drawText(r[1], { x: 180, y: rowY, size: 9, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
      page2.drawText(r[2], { x: 320, y: rowY, size: 9, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
      page2.drawText(r[3], { x: 480, y: rowY, size: 9, font: helveticaBold, color: rgb(0.1, 0.6, 0.3) });
      rowY -= 25;
    }

    // Save and return buffer
    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer;
  }
}
