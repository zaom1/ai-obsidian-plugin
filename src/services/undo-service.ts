import { TFile, normalizePath, type Vault } from "obsidian";

interface UndoEntry {
  path: string;
  previousContent: string | null; // null means file was created (undo = delete)
}

const MAX_UNDO_DEPTH = 20;

export class UndoService {
  private undoStack: UndoEntry[] = [];

  async push(vault: Vault, path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const file = vault.getAbstractFileByPath(normalizedPath);

    let previousContent: string | null = null;
    if (file instanceof TFile) {
      previousContent = await vault.read(file);
    }

    this.undoStack.push({ path: normalizedPath, previousContent });
    if (this.undoStack.length > MAX_UNDO_DEPTH) {
      this.undoStack.shift();
    }
  }

  async undo(vault: Vault): Promise<string | null> {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    const file = vault.getAbstractFileByPath(entry.path);

    if (entry.previousContent === null) {
      // file was created by the write, so undo = delete
      if (file instanceof TFile) {
        await vault.delete(file);
      }
      return `Deleted ${entry.path}`;
    }

    if (file instanceof TFile) {
      await vault.modify(file, entry.previousContent);
    } else {
      await vault.create(entry.path, entry.previousContent);
    }
    return `Restored ${entry.path}`;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
}
