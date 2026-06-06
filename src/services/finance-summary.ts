import { TFile, type Vault } from "obsidian";
import { getBudgetStatus, renderBudgetProgressBar } from "./budget-service";

const START = "<!-- SCH_FINANCE_SUMMARY_START -->";
const END = "<!-- SCH_FINANCE_SUMMARY_END -->";

interface Totals {
  expense: number;
  income: number;
  entries: number;
  currencies: Set<string>;
  categoryTotals: Map<string, number>;
  dailyTotals: Map<string, number>;
}

interface ParsedEntry {
  type?: "expense" | "income";
  amount?: number;
  currency?: string;
  category?: string;
  date?: string;
}

export async function updateFinanceSummary(vault: Vault, path: string): Promise<void> {
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof TFile)) return;

  const content = await vault.read(abstractFile);
  const totals = parseTotals(content);
  const summary = buildSummaryBlock(totals);

  const nextContent = replaceOrInsertSummary(content, summary);
  if (nextContent !== content) {
    await vault.modify(abstractFile, nextContent);
  }
}

export async function updateFinanceSummaryWithBudget(
  vault: Vault,
  path: string,
  financeFolder: string,
  monthlyBudget: number,
  budgetCurrency: string,
  categoryBudgets: Record<string, number>
): Promise<void> {
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof TFile)) return;

  const content = await vault.read(abstractFile);
  const totals = parseTotals(content);

  const monthMatch = path.match(/(\d{4}-\d{2})/);
  const month = monthMatch ? monthMatch[1] : "";

  let budgetSection = "";
  if (monthlyBudget > 0 && month) {
    const status = await getBudgetStatus(vault, financeFolder, month, monthlyBudget, budgetCurrency, categoryBudgets);
    budgetSection = [
      "",
      "### Budget",
      `- Total: ${renderBudgetProgressBar(status.total.spent, status.total.budget)}`,
      ...status.categories.map((c) => `- ${c.name}: ${renderBudgetProgressBar(c.spent, c.budget)}`)
    ].join("\n");
  }

  const summary = buildSummaryBlock(totals) + budgetSection;
  const nextContent = replaceOrInsertSummary(content, summary);
  if (nextContent !== content) {
    await vault.modify(abstractFile, nextContent);
  }
}

function parseTotals(content: string): Totals {
  const totals: Totals = {
    expense: 0,
    income: 0,
    entries: 0,
    currencies: new Set<string>(),
    categoryTotals: new Map<string, number>(),
    dailyTotals: new Map<string, number>()
  };

  const lines = content.split("\n");
  let entry: ParsedEntry | null = null;

  const commitEntry = () => {
    if (!entry || !entry.type || entry.amount === undefined || !Number.isFinite(entry.amount)) {
      entry = null;
      return;
    }

    totals.entries += 1;
    if (entry.currency) {
      totals.currencies.add(entry.currency);
    }
    if (entry.type === "expense") {
      totals.expense += entry.amount;
      if (entry.category) {
        totals.categoryTotals.set(entry.category, (totals.categoryTotals.get(entry.category) ?? 0) + entry.amount);
      }
      if (entry.date) {
        const dayKey = entry.date.slice(0, 10);
        totals.dailyTotals.set(dayKey, (totals.dailyTotals.get(dayKey) ?? 0) + entry.amount);
      }
    } else {
      totals.income += entry.amount;
    }
    entry = null;
  };

  for (const line of lines) {
    if (isEntryBoundary(line)) {
      commitEntry();
      entry = parseEntryType(line);
      continue;
    }

    if (!entry) {
      continue;
    }

    const type = parseEntryTypeFromField(line);
    if (type) {
      entry.type = type;
      continue;
    }

    const amountMatch = line.match(/^\s*(?:>\s*)?-\s*金额:\s*([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Z]{3})\s*$/);
    if (amountMatch) {
      entry.amount = Number.parseFloat(amountMatch[1]);
      entry.currency = amountMatch[2];
    }

    const catMatch = line.match(/^\s*(?:>\s*)?-\s*消费分类:\s*(.+)$/);
    if (catMatch) {
      entry.category = catMatch[1].trim();
    }

    const dateMatch = line.match(/^\s*(?:>\s*)?-\s*记录时间:\s*(.+)$/);
    if (dateMatch) {
      entry.date = dateMatch[1].trim();
    }
  }

  commitEntry();

  return totals;
}

function isEntryBoundary(line: string): boolean {
  return /^\s*-\s+\[/.test(line) || /^\s*>\s+\[!/.test(line);
}

function parseEntryType(line: string): ParsedEntry {
  const type = parseTypeToken(line);
  return type ? { type } : {};
}

function parseEntryTypeFromField(line: string): "expense" | "income" | undefined {
  const match = line.match(/^\s*(?:>\s*)?-\s*(分类|类型|交易类型):\s*(expense|income|收入|支出)\s*$/i);
  if (match) {
    const value = match[2].toLowerCase();
    return value === "income" || value === "收入" ? "income" : "expense";
  }
  return undefined;
}

function parseTypeToken(line: string): "expense" | "income" | undefined {
  const lowered = line.toLowerCase();
  if (/\[(expense|income)\/[^\]]+\]/.test(lowered)) {
    const match = lowered.match(/\[(expense|income)\//);
    return match ? (match[1] as "expense" | "income") : undefined;
  }
  if (/^\s*>\s+\[![^\]]+\]\s+(expense|income)\b/.test(lowered)) {
    const match = lowered.match(/^\s*>\s+\[![^\]]+\]\s+(expense|income)\b/);
    return match ? (match[1] as "expense" | "income") : undefined;
  }
  if (/^\s*>\s+\[![^\]]+\]\s+(收入|支出)\b/.test(line)) {
    const match = line.match(/^\s*>\s+\[![^\]]+\]\s+(收入|支出)\b/);
    return match ? (match[1] === "收入" ? "income" : "expense") : undefined;
  }
  if (/^\s*-\s+\[(收入|支出)\//.test(line)) {
    const match = line.match(/^\s*-\s+\[(收入|支出)\//);
    return match ? (match[1] === "收入" ? "income" : "expense") : undefined;
  }
  return undefined;
}

function buildSummaryBlock(totals: Totals): string {
  const net = totals.income - totals.expense;
  const currencies = totals.currencies.size > 0 ? [...totals.currencies].join(", ") : "none";

  const lines = [
    START,
    "## Monthly Summary (auto)",
    `- Entries: ${totals.entries}`,
    `- Expense: ${totals.expense.toFixed(2)}`,
    `- Income: ${totals.income.toFixed(2)}`,
    `- Net: ${net.toFixed(2)}`,
    `- Currencies: ${currencies}`
  ];

  // category breakdown
  if (totals.categoryTotals.size > 0) {
    lines.push("", "### By Category");
    const sorted = [...totals.categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, amount] of sorted) {
      lines.push(`- ${cat}: ${amount.toFixed(2)}`);
    }
  }

  lines.push(END, "");
  return lines.join("\n");
}

function replaceOrInsertSummary(content: string, summary: string): string {
  const startIndex = content.indexOf(START);
  const endIndex = content.indexOf(END);

  if (startIndex >= 0 && endIndex >= startIndex) {
    const afterEnd = content.indexOf("\n", endIndex);
    const tail = afterEnd >= 0 ? content.slice(afterEnd + 1) : "";
    const head = content.slice(0, startIndex);
    return `${head}${summary}${tail}`;
  }

  return `${summary}${content}`;
}
