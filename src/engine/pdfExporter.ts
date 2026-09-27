import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { DocumentTab } from '../state/appState';
import { 
  Annotation, 
  TextAnnotation, 
  PenAnnotation, 
  HighlightAnnotation, 
  ShapeAnnotation, 
  SignatureAnnotation, 
  StampAnnotation,
  RedactionAnnotation 
} from '../editor/annotationTypes';

export class PDFExporter {
  /**
   * Exports the modified document with all annotations, rotations, and page reorganizations
   * baked into a real standard PDF file using pdf-lib.
   */
  public static async exportPDF(tab: DocumentTab): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(tab.fileBuffer);
    const newDoc = await PDFDocument.create();

    const helvetica = await newDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await newDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await newDoc.embedFont(StandardFonts.TimesRoman);
    const courier = await newDoc.embedFont(StandardFonts.Courier);

    // Filter out deleted pages and follow user pageOrder
    const validPageIndices = tab.pageOrder.filter((idx) => !tab.deletedPages.has(idx));

    // Copy ordered pages into the new document
    const copiedPages = await newDoc.copyPages(srcDoc, validPageIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      const page = copiedPages[i];
      const originalPageIndex = validPageIndices[i];
      newDoc.addPage(page);

      // Apply page rotation if any
      const userRotation = tab.pageRotations[originalPageIndex] || 0;
      if (userRotation !== 0) {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees((currentRot + userRotation) % 360));
      }

      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Retrieve annotations for this page
      const annotations: Annotation[] = tab.annotations[originalPageIndex] || [];

      for (const ann of annotations) {
        switch (ann.type) {
          case 'text':
            await this.drawTextAnnotation(page, ann as TextAnnotation, pageWidth, pageHeight, {
              helvetica,
              helveticaBold,
              timesRoman,
              courier,
            });
            break;

          case 'pen':
            this.drawPenAnnotation(page, ann as PenAnnotation, pageWidth, pageHeight);
            break;

          case 'highlight':
            this.drawHighlightAnnotation(page, ann as HighlightAnnotation, pageWidth, pageHeight);
            break;

          case 'rectangle':
          case 'circle':
          case 'line':
          case 'arrow':
            this.drawShapeAnnotation(page, ann as ShapeAnnotation, pageWidth, pageHeight);
            break;

          case 'signature':
            await this.drawSignatureAnnotation(newDoc, page, ann as SignatureAnnotation, pageWidth, pageHeight);
            break;

          case 'stamp':
            this.drawStampAnnotation(page, ann as StampAnnotation, pageWidth, pageHeight, helveticaBold);
            break;

          case 'redaction':
            this.drawRedactionAnnotation(page, ann as RedactionAnnotation, pageWidth, pageHeight);
            break;
        }
      }
    }

    return await newDoc.save();
  }

  private static hexToRgb(hex: string) {
    if (!hex || hex === 'transparent') return null;
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return rgb(0, 0, 0);
    return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
  }

  private static async drawTextAnnotation(
    page: any,
    ann: TextAnnotation,
    pageWidth: number,
    pageHeight: number,
    fonts: any
  ) {
    const x = ann.x * pageWidth;
    // PDF coordinate origin is bottom-left, while screen is top-left
    const y = pageHeight - (ann.y * pageHeight) - (ann.fontSize * 1.15);

    let font = fonts.helvetica;
    if (ann.isBold) font = fonts.helveticaBold;
    if (ann.fontFamily?.toLowerCase().includes('times')) font = fonts.timesRoman;
    if (ann.fontFamily?.toLowerCase().includes('courier')) font = fonts.courier;

    const textColor = this.hexToRgb(ann.color) || rgb(0, 0, 0);

    // If this is an existing text edit or has originalBounds, redact / whiteout original bounding box first
    if (ann.isExistingTextEdit && ann.originalBounds) {
      const origX = ann.originalBounds.x * pageWidth;
      const origW = ann.originalBounds.width * pageWidth;
      const origH = ann.originalBounds.height * pageHeight;
      const origY = pageHeight - ((ann.originalBounds.y + ann.originalBounds.height) * pageHeight);

      // Cover whichever is larger between original bounds and new text width/height
      const whiteoutW = Math.max(origW, ann.width * pageWidth);
      const whiteoutH = Math.max(origH, ann.height * pageHeight);

      page.drawRectangle({
        x: Math.max(0, origX - 1),
        y: Math.max(0, origY - 1),
        width: whiteoutW + 2,
        height: whiteoutH + 2,
        color: rgb(1, 1, 1),
      });
    }

    // Optional background box
    if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
      const bgColor = this.hexToRgb(ann.backgroundColor);
      if (bgColor) {
        page.drawRectangle({
          x: ann.x * pageWidth,
          y: pageHeight - ((ann.y + ann.height) * pageHeight),
          width: ann.width * pageWidth,
          height: ann.height * pageHeight,
          color: bgColor,
        });
      }
    }

    const maxWidth = ann.width * pageWidth;
    const rawLines = (ann.text || '').split('\n');
    const lines: string[] = [];

    for (const rawLine of rawLines) {
      if (!maxWidth || maxWidth <= 0 || font.widthOfTextAtSize(rawLine, ann.fontSize) <= maxWidth || ann.isExistingTextEdit) {
        lines.push(rawLine);
        continue;
      }
      const words = rawLine.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, ann.fontSize) > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    let lineY = y;
    for (const line of lines) {
      let lineX = x;
      if (ann.textAlign === 'center') {
        const lineWidth = font.widthOfTextAtSize(line, ann.fontSize);
        lineX = x + Math.max(0, (ann.width * pageWidth - lineWidth) / 2);
      } else if (ann.textAlign === 'right') {
        const lineWidth = font.widthOfTextAtSize(line, ann.fontSize);
        lineX = x + Math.max(0, ann.width * pageWidth - lineWidth);
      }

      page.drawText(line, {
        x: lineX,
        y: lineY,
        size: ann.fontSize,
        font,
        color: textColor,
      });
      lineY -= ann.fontSize * 1.25;
    }
  }

  private static drawPenAnnotation(
    page: any,
    ann: PenAnnotation,
    pageWidth: number,
    pageHeight: number
  ) {
    if (!ann.points || ann.points.length < 2) return;
    const strokeColor = this.hexToRgb(ann.color) || rgb(0, 0, 0);

    for (let i = 0; i < ann.points.length - 1; i++) {
      const p1 = ann.points[i];
      const p2 = ann.points[i + 1];

      page.drawLine({
        start: { x: p1.x * pageWidth, y: pageHeight - (p1.y * pageHeight) },
        end: { x: p2.x * pageWidth, y: pageHeight - (p2.y * pageHeight) },
        thickness: ann.strokeWidth,
        color: strokeColor,
        opacity: ann.opacity ?? 1,
      });
    }
  }

  private static drawHighlightAnnotation(
    page: any,
    ann: HighlightAnnotation,
    pageWidth: number,
    pageHeight: number
  ) {
    if (!ann.points || ann.points.length < 2) return;
    const strokeColor = this.hexToRgb(ann.color) || rgb(1, 1, 0);

    for (let i = 0; i < ann.points.length - 1; i++) {
      const p1 = ann.points[i];
      const p2 = ann.points[i + 1];

      page.drawLine({
        start: { x: p1.x * pageWidth, y: pageHeight - (p1.y * pageHeight) },
        end: { x: p2.x * pageWidth, y: pageHeight - (p2.y * pageHeight) },
        thickness: ann.strokeWidth || 18,
        color: strokeColor,
        opacity: ann.opacity ?? 0.35,
      });
    }
  }

  private static drawShapeAnnotation(
    page: any,
    ann: ShapeAnnotation,
    pageWidth: number,
    pageHeight: number
  ) {
    const strokeColor = this.hexToRgb(ann.strokeColor) || rgb(0, 0, 0);
    const fillColor = this.hexToRgb(ann.fillColor);

    const x = ann.x * pageWidth;
    const y = pageHeight - ((ann.y + ann.height) * pageHeight);
    const w = ann.width * pageWidth;
    const h = ann.height * pageHeight;

    if (ann.type === 'rectangle') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderWidth: ann.strokeWidth,
        borderColor: strokeColor,
        color: fillColor || undefined,
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'circle') {
      const xRadius = w / 2;
      const yRadius = h / 2;
      page.drawEllipse({
        x: x + xRadius,
        y: y + yRadius,
        xScale: xRadius,
        yScale: yRadius,
        borderWidth: ann.strokeWidth,
        borderColor: strokeColor,
        color: fillColor || undefined,
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'line' || ann.type === 'arrow') {
      if (!ann.startPoint || !ann.endPoint) return;
      const sx = ann.startPoint.x * pageWidth;
      const sy = pageHeight - (ann.startPoint.y * pageHeight);
      const ex = ann.endPoint.x * pageWidth;
      const ey = pageHeight - (ann.endPoint.y * pageHeight);

      page.drawLine({
        start: { x: sx, y: sy },
        end: { x: ex, y: ey },
        thickness: ann.strokeWidth,
        color: strokeColor,
        opacity: ann.opacity ?? 1,
      });
    }
  }

  private static async drawSignatureAnnotation(
    doc: PDFDocument,
    page: any,
    ann: SignatureAnnotation,
    pageWidth: number,
    pageHeight: number
  ) {
    if (!ann.imageDataUrl) return;

    try {
      const base64Data = ann.imageDataUrl.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const image = await doc.embedPng(imageBytes);

      const x = ann.x * pageWidth;
      const y = pageHeight - ((ann.y + ann.height) * pageHeight);
      const w = ann.width * pageWidth;
      const h = ann.height * pageHeight;

      page.drawImage(image, {
        x,
        y,
        width: w,
        height: h,
      });
    } catch (err) {
      console.error('Failed to embed signature PNG into exported PDF:', err);
    }
  }

  private static drawStampAnnotation(
    page: any,
    ann: StampAnnotation,
    pageWidth: number,
    pageHeight: number,
    fontBold: any
  ) {
    const x = ann.x * pageWidth;
    const y = pageHeight - ((ann.y + ann.height) * pageHeight);
    const w = ann.width * pageWidth;
    const h = ann.height * pageHeight;
    const color = this.hexToRgb(ann.color) || rgb(0.8, 0, 0);

    // Stamp outline
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderWidth: 3,
      borderColor: color,
    });

    // Stamp text
    const label = ann.label.toUpperCase();
    const fontSize = Math.min(h * 0.45, 20);
    const labelWidth = fontBold.widthOfTextAtSize(label, fontSize);
    const textX = x + (w - labelWidth) / 2;
    const textY = y + (h / 2) - (fontSize / 4);

    page.drawText(label, {
      x: Math.max(x + 4, textX),
      y: textY,
      size: fontSize,
      font: fontBold,
      color,
    });
  }

  private static drawRedactionAnnotation(
    page: any,
    ann: RedactionAnnotation,
    pageWidth: number,
    pageHeight: number
  ) {
    const x = ann.x * pageWidth;
    const y = pageHeight - ((ann.y + ann.height) * pageHeight);
    const w = ann.width * pageWidth;
    const h = ann.height * pageHeight;
    const color = this.hexToRgb(ann.fillColor) || rgb(0, 0, 0);

    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color,
    });
  }
}
