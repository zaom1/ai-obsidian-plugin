import { TFile, normalizePath, type Vault } from "obsidian";

// serialize writes to the same path to avoid read-modify-write races
const writeLocks = new Map<string, Promise<unknown>>();

function withFileLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const existing = writeLocks.get(path) ?? Promise.resolve();
  const next = existing.then(fn, fn);
  const tracked = next.finally(() => {
    if (writeLocks.get(path) === next) {
      writeLocks.delete(path);
    }
  });
  writeLocks.set(path, next);
  return tracked;
}

export async function appendToVaultFile(vault: Vault, path: string, content: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  await ensureParentFolder(vault, normalizedPath);

  return withFileLock(normalizedPath, async () => {
    const file = vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      await vault.append(file, content);
    } else {
      await vault.create(normalizedPath, content);
    }
  });
}

export async function prependToVaultFile(vault: Vault, path: string, content: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  await ensureParentFolder(vault, normalizedPath);

  return withFileLock(normalizedPath, async () => {
    const file = vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      const current = await vault.read(file);
      await vault.modify(file, `${content}${current}`);
    } else {
      await vault.create(normalizedPath, content);
    }
  });
}

async function ensureParentFolder(vault: Vault, path: string): Promise<void> {
  const parts = path.split("/");
  parts.pop();
  if (parts.length === 0) return;

  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      await vault.createFolder(current);
    }
  }
}
