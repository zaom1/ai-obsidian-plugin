import { TFile, normalizePath, type Vault } from "obsidian";
import { appendToVaultFile } from "./vault-writer";

export async function markAsDone(vault: Vault, entryId: string, filePath: string): Promise<boolean> {
  const path = normalizePath(filePath);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;

  const content = await vault.read(file);
  const updated = content.replace(
    new RegExp(`(编号:\\s*${escapeRegex(entryId)}[\\s\\S]*?状态:\\s*)(open|scheduled|logged)`, "m"),
    "$1done"
  );

  if (updated === content) return false;
  await vault.modify(file, updated);
  return true;
}

export async function archiveEntry(
  vault: Vault,
  entryId: string,
  filePath: string,
  archiveFolder: string,
  now: Date = new Date()
): Promise<boolean> {
  const path = normalizePath(filePath);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;

  const content = await vault.read(file);
  const { block, remaining } = extractBlock(content, entryId);
  if (!block) return false;

  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const archivePath = `${archiveFolder}/${month}.md`;

  await appendToVaultFile(vault, archivePath, block);
  await vault.modify(file, remaining);
  return true;
}

function extractBlock(content: string, entryId: string): { block: string | null; remaining: string } {
  const lines = content.split("\n");
  const blockLines: string[] = [];
  const remainingLines: string[] = [];
  let inTargetBlock = false;
  let found = false;

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      if (inTargetBlock && found) {
        // end of target block
        inTargetBlock = false;
      }
      if (!inTargetBlock) {
        inTargetBlock = true;
        found = false;
        blockLines.length = 0;
      }
    }

    if (inTargetBlock) {
      blockLines.push(line);
      if (line.includes(`编号: ${entryId}`) || line.includes(`编号:${entryId}`)) {
        found = true;
      }
    } else {
      remainingLines.push(line);
    }
  }

  if (found) {
    return { block: blockLines.join("\n") + "\n", remaining: remainingLines.join("\n") };
  }

  return { block: null, remaining: content };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
