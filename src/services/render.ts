import type { ParsedIntent } from "../types";

export interface MetaField {
  label: string;
  value: string;
}

export interface RecordDocumentOptions {
  sectionTitle?: string;
  calloutType: "note" | "abstract" | "todo" | "info" | "tip" | "warning" | "success" | "quote";
  title: string;
  fields: MetaField[];
  sourceText?: string;
}

export function createEntryId(prefix: string, now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}`;
}

export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function buildSectionHeading(dateOrMonth: string): string {
  return `## ${dateOrMonth}\n`;
}

export function buildRecordDocument(options: RecordDocumentOptions): string {
  const parts: string[] = [];

  if (options.sectionTitle) {
    parts.push(buildSectionHeading(options.sectionTitle).trimEnd());
  }

  parts.push(buildCalloutBlock(options.calloutType, options.title, options.fields, options.sourceText).trimEnd());

  return `${parts.join("\n\n")}\n\n`;
}

export function buildCalloutBlock(
  type: "note" | "abstract" | "todo" | "info" | "tip" | "warning" | "success" | "quote",
  title: string,
  fields: MetaField[],
  sourceText?: string
): string {
  const lines: string[] = [`> [!${type}] ${title}`];

  for (const field of fields) {
    lines.push(`> - ${field.label}: ${field.value}`);
  }

  if (sourceText && sourceText.trim().length > 0) {
    lines.push(">");
    lines.push("> 来源");
    for (const line of sourceText.trim().split("\n")) {
      lines.push(`> ${line}`);
    }
  }

  return `${lines.join("\n")}\n\n`;
}

export function renderTags(tags?: string[]): string {
  if (!tags || tags.length === 0) return "-";
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");
}

export function renderSkillBadge(intent: ParsedIntent["skill"]): string {
  switch (intent) {
    case "accounting":
      return "财务记录";
    case "subscription":
      return "订阅记录";
    case "todo":
      return "待办";
    case "reminder":
      return "提醒";
    case "habit":
      return "习惯打卡";
    case "quick-note":
      return "快速笔记";
    case "contact":
      return "联系人";
    case "idea":
      return "灵感";
    case "memo":
    default:
      return "备忘";
  }
}
