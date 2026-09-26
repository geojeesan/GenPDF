export interface HistoryAction {
  description: string;
  undo: () => void;
  redo: () => void;
}

export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistory = 50;
  private onChangeCallbacks: Array<(canUndo: boolean, canRedo: boolean) => void> = [];

  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
  }

  public push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.notify();
  }

  public undo(): void {
    const action = this.undoStack.pop();
    if (action) {
      action.undo();
      this.redoStack.push(action);
      this.notify();
    }
  }

  public redo(): void {
    const action = this.redoStack.pop();
    if (action) {
      action.redo();
      this.undoStack.push(action);
      this.notify();
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  public static onHistoryChange: (() => void) | null = null;

  public subscribe(cb: (canUndo: boolean, canRedo: boolean) => void): () => void {
    this.onChangeCallbacks.push(cb);
    cb(this.canUndo(), this.canRedo());
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notify(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();
    this.onChangeCallbacks.forEach((cb) => cb(canUndo, canRedo));
    if (HistoryManager.onHistoryChange) {
      HistoryManager.onHistoryChange();
    }
  }
}
