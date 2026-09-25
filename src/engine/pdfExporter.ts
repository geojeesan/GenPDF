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

    const lines = ann.text.split('\n');
    let lineY = y;
    for (const line of lines) {
      page.drawText(line, {
        x,
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
        thickness: ann.strokeWidth || 2,
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
    const highlightColor = this.hexToRgb(ann.color) || rgb(1, 0.9, 0.2);

    for (let i = 0; i < ann.points.length - 1; i++) {
      const p1 = ann.points[i];
      const p2 = ann.points[i + 1];

      page.drawLine({
        start: { x: p1.x * pageWidth, y: pageHeight - (p1.y * pageHeight) },
        end: { x: p2.x * pageWidth, y: pageHeight - (p2.y * pageHeight) },
        thickness: ann.strokeWidth || 16,
        color: highlightColor,
        opacity: ann.opacity ?? 0.4,
      });
    }
  }

  private static drawShapeAnnotation(
    page: any,
    ann: ShapeAnnotation,
    pageWidth: number,
    pageHeight: number
  ) {
    const x = ann.x * pageWidth;
    const y = pageHeight - ((ann.y + ann.height) * pageHeight);
    const w = ann.width * pageWidth;
    const h = ann.height * pageHeight;
    const strokeColor = this.hexToRgb(ann.strokeColor);
    const fillColor = this.hexToRgb(ann.fillColor);

    if (ann.type === 'rectangle') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderWidth: ann.strokeWidth || 2,
        borderColor: strokeColor || undefined,
        color: fillColor || undefined,
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'circle') {
      page.drawEllipse({
        x: x + w / 2,
        y: y + h / 2,
        xScale: w / 2,
        yScale: h / 2,
        borderWidth: ann.strokeWidth || 2,
        borderColor: strokeColor || undefined,
        color: fillColor || undefined,
        opacity: ann.opacity ?? 1,
      });
    } else if (ann.type === 'line' || ann.type === 'arrow') {
      const sx = (ann.startPoint ? ann.startPoint.x : ann.x) * pageWidth;
      const sy = (ann.startPoint ? ann.startPoint.y : ann.y) * pageHeight;
      const ex = (ann.endPoint ? ann.endPoint.x : ann.x + ann.width) * pageWidth;
      const ey = (ann.endPoint ? ann.endPoint.y : ann.y + ann.height) * pageHeight;

      const pdfStartX = sx;
      const pdfStartY = pageHeight - sy;
      const pdfEndX = ex;
      const pdfEndY = pageHeight - ey;

      page.drawLine({
        start: { x: pdfStartX, y: pdfStartY },
        end: { x: pdfEndX, y: pdfEndY },
        thickness: ann.strokeWidth || 2,
        color: strokeColor || rgb(0, 0, 0),
        opacity: ann.opacity ?? 1,
      });

      if (ann.type === 'arrow') {
        const angle = Math.atan2(pdfEndY - pdfStartY, pdfEndX - pdfStartX);
        const headLen = Math.max(10, (ann.strokeWidth || 2) * 3.5);
        page.drawLine({
          start: { x: pdfEndX, y: pdfEndY },
          end: {
            x: pdfEndX - headLen * Math.cos(angle - Math.PI / 6),
            y: pdfEndY - headLen * Math.sin(angle - Math.PI / 6),
          },
          thickness: ann.strokeWidth || 2,
          color: strokeColor || rgb(0, 0, 0),
        });
        page.drawLine({
          start: { x: pdfEndX, y: pdfEndY },
          end: {
            x: pdfEndX - headLen * Math.cos(angle + Math.PI / 6),
            y: pdfEndY - headLen * Math.sin(angle + Math.PI / 6),
          },
          thickness: ann.strokeWidth || 2,
          color: strokeColor || rgb(0, 0, 0),
        });
      }
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
      const pngImage = await doc.embedPng(imageBytes);

      const x = ann.x * pageWidth;
      const y = pageHeight - ((ann.y + ann.height) * pageHeight);
      const w = ann.width * pageWidth;
      const h = ann.height * pageHeight;

      page.drawImage(pngImage, {
        x,
        y,
        width: w,
        height: h,
      });
    } catch (err) {
      console.error('Failed to embed signature image:', err);
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
    const stampColor = this.hexToRgb(ann.color) || rgb(0.8, 0.1, 0.1);

    // Double-lined box for official stamp look
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderWidth: 2.5,
      borderColor: stampColor,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });

    page.drawRectangle({
      x: x + 3,
      y: y + 3,
      width: w - 6,
      height: h - 6,
      borderWidth: 1,
      borderColor: stampColor,
    });

    const fontSize = Math.min(h * 0.45, 18);
    page.drawText(ann.label, {
      x: x + (w - fontBold.widthOfTextAtSize(ann.label, fontSize)) / 2,
      y: y + (h / 2) - (fontSize / 3) + (ann.dateStr ? 4 : 0),
      size: fontSize,
      font: fontBold,
      color: stampColor,
    });

    if (ann.dateStr) {
      page.drawText(ann.dateStr, {
        x: x + (w - fontBold.widthOfTextAtSize(ann.dateStr, 8)) / 2,
        y: y + 8,
        size: 8,
        font: fontBold,
        color: stampColor,
      });
    }
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
    const fillColor = this.hexToRgb(ann.fillColor) || rgb(0, 0, 0);

    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: fillColor,
    });
  }
}
