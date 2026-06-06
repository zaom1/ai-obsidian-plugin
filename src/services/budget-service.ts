import { TFile, normalizePath, type Vault } from "obsidian";

export interface BudgetStatus {
  total: { budget: number; spent: number; percentage: number };
  categories: Array<{ name: string; budget: number; spent: number; percentage: number }>;
}

export async function getBudgetStatus(
  vault: Vault,
  financeFolder: string,
  month: string,
  monthlyBudget: number,
  currency: string,
  categoryBudgets: Record<string, number>
): Promise<BudgetStatus> {
  const path = normalizePath(`${financeFolder}/${month}.md`);
  const file = vault.getAbstractFileByPath(path);

  let totalSpent = 0;
  const categorySpent = new Map<string, number>();

  if (file instanceof TFile) {
    const content = await vault.read(file);
    parseExpenseEntries(content, categorySpent, (total) => { totalSpent = total; });
  }

  const result: BudgetStatus = {
    total: {
      budget: monthlyBudget,
      spent: totalSpent,
      percentage: monthlyBudget > 0 ? Math.min(100, (totalSpent / monthlyBudget) * 100) : 0
    },
    categories: []
  };

  for (const [name, budget] of Object.entries(categoryBudgets)) {
    const spent = categorySpent.get(name) ?? 0;
    result.categories.push({
      name,
      budget,
      spent,
      percentage: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
    });
  }

  return result;
}

function parseExpenseEntries(
  content: string,
  categorySpent: Map<string, number>,
  setTotal: (total: number) => void
): void {
  const lines = content.split("\n");
  let currentCategory = "";
  let currentAmount = 0;
  let currentType = "";
  let totalExpense = 0;

  const commitEntry = () => {
    if (currentType === "expense" && currentAmount > 0) {
      totalExpense += currentAmount;
      const cat = currentCategory || "其他";
      categorySpent.set(cat, (categorySpent.get(cat) ?? 0) + currentAmount);
    }
    currentCategory = "";
    currentAmount = 0;
    currentType = "";
  };

  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      commitEntry();
      if (/支出/.test(line)) currentType = "expense";
      else if (/收入/.test(line)) currentType = "income";
      continue;
    }

    const typeMatch = line.match(/^\s*>\s*-\s*交易类型:\s*(expense|income)\s*$/);
    if (typeMatch) { currentType = typeMatch[1]; continue; }

    const catMatch = line.match(/^\s*>\s*-\s*消费分类:\s*(.+)$/);
    if (catMatch) { currentCategory = catMatch[1].trim(); continue; }

    const amountMatch = line.match(/^\s*>\s*-\s*金额:\s*([0-9]+(?:\.[0-9]{1,2})?)\s+[A-Z]{3}\s*$/);
    if (amountMatch) { currentAmount = Number.parseFloat(amountMatch[1]); continue; }
  }

  commitEntry();
  setTotal(totalExpense);
}

export function renderBudgetProgressBar(spent: number, budget: number, width = 20): string {
  if (budget <= 0) return "";
  const percentage = Math.min(100, (spent / budget) * 100);
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${spent.toFixed(2)}/${budget.toFixed(2)} (${percentage.toFixed(0)}%) [${bar}]`;
}
