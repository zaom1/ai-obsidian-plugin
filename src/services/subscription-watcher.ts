import { TFile, normalizePath, type Vault } from "obsidian";
import { createEntryId, formatDate } from "./render";
import { appendToVaultFile } from "./vault-writer";

const NOTIFIED_SUBSCRIPTIONS = new Set<string>();

interface SubscriptionEntry {
  vendor: string;
  dueDate: string;
  amount: string;
}

export async function checkSubscriptionExpiry(
  vault: Vault,
  subscriptionFile: string,
  reminderFile: string,
  advanceNoticeDays: number,
  now: Date = new Date()
): Promise<void> {
  const path = normalizePath(subscriptionFile);
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof TFile)) return;

  const content = await vault.read(abstractFile);
  const entries = parseSubscriptionEntries(content);

  for (const entry of entries) {
    const key = `${entry.vendor}:${entry.dueDate}`;
    if (NOTIFIED_SUBSCRIPTIONS.has(key)) continue;

    const due = new Date(entry.dueDate);
    if (Number.isNaN(due.getTime())) continue;

    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= advanceNoticeDays) {
      NOTIFIED_SUBSCRIPTIONS.add(key);
      const entryId = createEntryId("rem", now);
      const reminderContent = [
        `> [!warning] 提醒 | 订阅即将到期: ${entry.vendor}`,
        `> - 编号: ${entryId}`,
        `> - 状态: scheduled`,
        `> - 时间: ${formatDate(due)}`,
        `>`,
        `> 来源`,
        `> 订阅 ${entry.vendor} (${entry.amount}) 将于 ${formatDate(due)} 到期`,
        "",
        ""
      ].join("\n");

      await appendToVaultFile(vault, reminderFile, reminderContent);
    }
  }
}

export function resetSubscriptionNotifications(): void {
  NOTIFIED_SUBSCRIPTIONS.clear();
}

function parseSubscriptionEntries(content: string): SubscriptionEntry[] {
  const entries: SubscriptionEntry[] = [];
  const lines = content.split("\n");
  let current: Partial<SubscriptionEntry> | null = null;

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      if (current?.vendor && current?.dueDate) entries.push(current as SubscriptionEntry);
      const titleMatch = line.match(/\|\s*(.+)$/);
      current = { vendor: titleMatch?.[1]?.trim() ?? "unknown" };
      continue;
    }

    if (!current) continue;

    const dueMatch = line.match(/^\s*>\s*-\s*下次到期:\s*(.+)$/);
    if (dueMatch) { current.dueDate = dueMatch[1].trim(); continue; }

    const amountMatch = line.match(/^\s*>\s*-\s*金额:\s*(.+)$/);
    if (amountMatch) { current.amount = amountMatch[1].trim(); continue; }
  }

  if (current?.vendor && current?.dueDate) entries.push(current as SubscriptionEntry);
  return entries;
}
