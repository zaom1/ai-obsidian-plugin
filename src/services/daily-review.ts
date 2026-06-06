import { TFile, normalizePath, type Vault } from "obsidian";
import type { SmartCaptureSettings } from "../types";
import { formatDate } from "./render";

export async function generateDailyReview(
  vault: Vault,
  settings: SmartCaptureSettings,
  date: Date = new Date()
): Promise<string> {
  const dateStr = formatDate(date);
  const sections: string[] = [
    `# Daily Review — ${dateStr}`,
    ""
  ];

  // accounting
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const financePath = normalizePath(`${settings.financeFolder}/${month}.md`);
  const financeEntries = await collectEntriesForDate(vault, financePath, dateStr);
  if (financeEntries.length > 0) {
    sections.push("## 💰 今日记账", "");
    sections.push(...financeEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  // todo
  const todoEntries = await collectEntriesForDate(vault, normalizePath(settings.taskFile), dateStr);
  if (todoEntries.length > 0) {
    sections.push("## ✅ 待办事项", "");
    sections.push(...todoEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  // reminder
  const reminderEntries = await collectEntriesForDate(vault, normalizePath(settings.reminderFile), dateStr);
  if (reminderEntries.length > 0) {
    sections.push("## ⏰ 提醒", "");
    sections.push(...reminderEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  // memo
  const memoPath = normalizePath(`${settings.memoFolder}/${dateStr}.md`);
  const memoEntries = await collectAllEntries(vault, memoPath);
  if (memoEntries.length > 0) {
    sections.push("## 📝 备忘", "");
    sections.push(...memoEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  // habit
  const habitPath = normalizePath(`${settings.habitFolder}/${month}.md`);
  const habitEntries = await collectEntriesForDate(vault, habitPath, dateStr);
  if (habitEntries.length > 0) {
    sections.push("## 🎯 习惯打卡", "");
    sections.push(...habitEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  // quick-note
  const qnPath = normalizePath(`${settings.quickNoteFolder}/${dateStr}.md`);
  const qnEntries = await collectAllEntries(vault, qnPath);
  if (qnEntries.length > 0) {
    sections.push("## 📌 快速笔记", "");
    sections.push(...qnEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  // idea
  const ideaEntries = await collectEntriesForDate(vault, normalizePath(settings.ideaFile), dateStr);
  if (ideaEntries.length > 0) {
    sections.push("## 💡 灵感", "");
    sections.push(...ideaEntries.map((e) => `- ${e}`));
    sections.push("");
  }

  if (sections.length <= 2) {
    sections.push("今天没有记录。保持好习惯，明天继续加油！", "");
  }

  return sections.join("\n");
}

export async function saveDailyReview(
  vault: Vault,
  settings: SmartCaptureSettings,
  content: string,
  date: Date = new Date()
): Promise<string> {
  const dateStr = formatDate(date);
  const path = normalizePath(`${settings.dailyReviewFolder}/${dateStr}.md`);

  const file = vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    await vault.modify(file, content);
  } else {
    // ensure folder exists
    const parts = path.split("/");
    parts.pop();
    if (parts.length > 0) {
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        if (!vault.getAbstractFileByPath(current)) {
          await vault.createFolder(current);
        }
      }
    }
    await vault.create(path, content);
  }

  return path;
}

async function collectEntriesForDate(vault: Vault, filePath: string, dateStr: string): Promise<string[]> {
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) return [];

  const content = await vault.read(file);
  const lines = content.split("\n");
  const entries: string[] = [];
  let currentTitle = "";
  let currentDate = "";

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      const titleMatch = line.match(/\|\s*(.+)$/);
      currentTitle = titleMatch?.[1]?.trim() ?? "";
      currentDate = "";
      continue;
    }

    const dateMatch = line.match(/^\s*>\s*-\s*(?:记录时间|时间|日期|开始时间):\s*(.+)$/);
    if (dateMatch) {
      currentDate = dateMatch[1].trim();
      if (currentDate.startsWith(dateStr) && currentTitle) {
        entries.push(currentTitle);
      }
      continue;
    }
  }

  return entries;
}

async function collectAllEntries(vault: Vault, filePath: string): Promise<string[]> {
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) return [];

  const content = await vault.read(file);
  const lines = content.split("\n");
  const entries: string[] = [];

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      const titleMatch = line.match(/\|\s*(.+)$/);
      if (titleMatch) entries.push(titleMatch[1].trim());
    }

    // quick-note format
    if (/^###\s+\d{2}:\d{2}$/.test(line)) {
      entries.push(line.replace(/^###\s+/, ""));
    }
  }

  return entries;
}
