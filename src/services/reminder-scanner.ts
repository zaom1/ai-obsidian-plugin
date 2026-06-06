import { Notice, TFile, normalizePath, type Vault } from "obsidian";

const NOTIFIED_IDS = new Set<string>();

interface ReminderEntry {
  entryId: string;
  title: string;
  dueDate: string;
  status: string;
}

export function scanReminders(vault: Vault, reminderFile: string): void {
  const path = normalizePath(reminderFile);
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof TFile)) return;

  vault.read(abstractFile).then((content) => {
    const entries = parseReminderEntries(content);
    const now = new Date();

    for (const entry of entries) {
      if (entry.status !== "scheduled") continue;
      if (NOTIFIED_IDS.has(entry.entryId)) continue;

      const due = parseDueDateTime(entry.dueDate);
      if (!due) continue;

      if (now >= due) {
        NOTIFIED_IDS.add(entry.entryId);
        new Notice(`⏰ 提醒: ${entry.title}`, 10000);
      }
    }
  }).catch(() => { /* file may not exist yet */ });
}

export function resetNotifiedIds(): void {
  NOTIFIED_IDS.clear();
}

function parseReminderEntries(content: string): ReminderEntry[] {
  const entries: ReminderEntry[] = [];
  const lines = content.split("\n");
  let current: Partial<ReminderEntry> | null = null;

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      if (current?.entryId) entries.push(current as ReminderEntry);
      const titleMatch = line.match(/\|\s*(.+)$/);
      current = { title: titleMatch?.[1]?.trim() ?? "unknown" };
      continue;
    }

    if (!current) continue;

    const idMatch = line.match(/^\s*>\s*-\s*编号:\s*(.+)$/);
    if (idMatch) { current.entryId = idMatch[1].trim(); continue; }

    const statusMatch = line.match(/^\s*>\s*-\s*状态:\s*(.+)$/);
    if (statusMatch) { current.status = statusMatch[1].trim(); continue; }

    const dateMatch = line.match(/^\s*>\s*-\s*时间:\s*(.+)$/);
    if (dateMatch) { current.dueDate = dateMatch[1].trim(); continue; }
  }

  if (current?.entryId) entries.push(current as ReminderEntry);
  return entries;
}

function parseDueDateTime(value: string): Date | null {
  if (!value || value === "unspecified") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
