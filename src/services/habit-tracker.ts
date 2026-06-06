import { TFile, normalizePath, type Vault } from "obsidian";
import { formatDate } from "./render";

export interface HabitMonthlyStats {
  completed: number;
  total: number;
  rate: number;
}

export async function getStreak(vault: Vault, habitFolder: string, habitName: string, now: Date): Promise<number> {
  let streak = 0;
  const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // check up to 365 days back
  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(checkDate);
    const month = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}`;
    const path = normalizePath(`${habitFolder}/${month}.md`);
    const file = vault.getAbstractFileByPath(path);

    if (file instanceof TFile) {
      const content = await vault.read(file);
      if (hasHabitOnDate(content, habitName, dateStr)) {
        streak++;
      } else if (i > 0) {
        // streak broken (but allow today to be not yet logged)
        break;
      }
    } else if (i > 0) {
      break;
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export async function getMonthlyStats(vault: Vault, habitFolder: string, habitName: string, now: Date): Promise<HabitMonthlyStats> {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const path = normalizePath(`${habitFolder}/${month}.md`);
  const file = vault.getAbstractFileByPath(path);

  let completed = 0;
  if (file instanceof TFile) {
    const content = await vault.read(file);
    completed = countHabitEntries(content, habitName);
  }

  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const total = Math.min(today, daysInMonth);

  return {
    completed,
    total,
    rate: total > 0 ? (completed / total) * 100 : 0
  };
}

function hasHabitOnDate(content: string, habitName: string, dateStr: string): boolean {
  const lines = content.split("\n");
  let inBlock = false;
  let blockHabit = "";
  let blockDate = "";

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      if (inBlock && blockHabit === habitName && blockDate === dateStr) return true;
      inBlock = true;
      blockHabit = "";
      blockDate = "";

      const titleMatch = line.match(/\|\s*习惯打卡\s*\|\s*(.+)$/);
      if (titleMatch) blockHabit = titleMatch[1].trim();
      continue;
    }

    if (!inBlock) continue;

    const habitMatch = line.match(/^\s*>\s*-\s*习惯:\s*(.+)$/);
    if (habitMatch) { blockHabit = habitMatch[1].trim(); continue; }

    const dateMatch = line.match(/^\s*>\s*-\s*日期:\s*(.+)$/);
    if (dateMatch) { blockDate = dateMatch[1].trim(); continue; }
  }

  return inBlock && blockHabit === habitName && blockDate === dateStr;
}

function countHabitEntries(content: string, habitName: string): number {
  const lines = content.split("\n");
  let count = 0;
  let currentHabit = "";

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      currentHabit = "";
      const titleMatch = line.match(/\|\s*习惯打卡\s*\|\s*(.+)$/);
      if (titleMatch) currentHabit = titleMatch[1].trim();
      continue;
    }

    const habitMatch = line.match(/^\s*>\s*-\s*习惯:\s*(.+)$/);
    if (habitMatch) currentHabit = habitMatch[1].trim();

    if (/^\s*>\s*-\s*日期:/.test(line) && currentHabit === habitName) {
      count++;
    }
  }

  return count;
}
