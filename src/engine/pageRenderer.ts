import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';

export class PageRenderer {
  private static renderTasks: Map<HTMLCanvasElement, RenderTask> = new Map();

  /**
   * Renders a full PDF page onto a canvas at target scale and rotation with crisp HiDPI support.
   */
  public static async renderPage(
    pdfDoc: PDFDocumentProxy,
    pageNumber: number, // 1-based
    canvas: HTMLCanvasElement,
    scale: number,
    rotation: number = 0
  ): Promise<{ width: number; height: number }> {
    // Cancel existing render on this canvas if any
    const existingTask = this.renderTasks.get(canvas);
    if (existingTask) {
      existingTask.cancel();
      this.renderTasks.delete(canvas);
    }

    try {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
      const totalRotation = (page.rotate + rotation) % 360;

      // Base CSS viewport
      const cssViewport = page.getViewport({ scale, rotation: totalRotation });

      // Crisp HiDPI rendering using window.devicePixelRatio
      const dpr = window.devicePixelRatio || 1;
      const renderViewport = page.getViewport({ scale: scale * dpr, rotation: totalRotation });

      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${Math.floor(cssViewport.width)}px`;
      canvas.style.height = `${Math.floor(cssViewport.height)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not get 2D context');

      // Always initialize with crisp white background so canvas never flashes black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const renderContext = {
        canvasContext: ctx,
        viewport: renderViewport,
      };

      const task = page.render(renderContext);
      this.renderTasks.set(canvas, task);

      await task.promise;
      this.renderTasks.delete(canvas);

      return {
        width: cssViewport.width,
        height: cssViewport.height,
      };
    } catch (err: any) {
      this.renderTasks.delete(canvas);
      if (err?.name === 'RenderingCancelledException') {
        // Ignored: Expected when zooming/scrolling fast
        return { width: 0, height: 0 };
      }
      console.error(`Error rendering page ${pageNumber}:`, err);
      throw err;
    }
  }

  /**
   * Renders a lightweight thumbnail for the sidebar.
   */
  public static async renderThumbnail(
    pdfDoc: PDFDocumentProxy,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    targetWidth: number = 140,
    rotation: number = 0
  ): Promise<void> {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const totalRotation = (page.rotate + rotation) % 360;
      const unscaledViewport = page.getViewport({ scale: 1, rotation: totalRotation });
      const scale = targetWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale, rotation: totalRotation });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;
    } catch (err) {
      // Thumbnail rendering errors ignored
    }
  }
}
