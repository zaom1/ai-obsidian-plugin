import { Modal, Notice, TFile, normalizePath } from "obsidian";
import type SmartCapturePlugin from "../main";
import { CaptureModal } from "./capture-modal";
import { DailyReviewModal } from "./daily-review-modal";
import { McpToolModal } from "./mcp-tool-modal";
import { SearchModal } from "./search-modal";

export class WorkspaceHubModal extends Modal {
  constructor(private readonly plugin: SmartCapturePlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const shell = contentEl.createDiv({ cls: "sch-shell sch-hub-shell" });
    const hero = shell.createDiv({ cls: "sch-hero" });
    hero.createEl("p", { cls: "sch-kicker", text: "ALL IN ONE" });
    hero.createEl("h2", { text: "Intent Inbox Workspace" });
    hero.createEl("p", {
      cls: "sch-hero-copy",
      text: "One place to capture notes, route them to skills, inspect MCP tools, and keep the vault organized."
    });

    const stats = hero.createDiv({ cls: "sch-stat-row" });
    this.renderStat(stats, "Skills", `${this.enabledSkillCount()} enabled`);
    this.renderStat(stats, "MCP", `${this.plugin.getEnabledMcpEndpoints().length} active`);
    this.renderStat(stats, "Finance", this.plugin.getCurrentMonthFinancePath());

    // async stats
    this.loadAsyncStats(stats);

    const grid = shell.createDiv({ cls: "sch-hub-grid" });

    this.renderActionCard(grid, "Capture", "Preview and write typed or transcribed input.", "Open Capture", () => {
      this.close();
      new CaptureModal(this.plugin).open();
    });

    this.renderActionCard(grid, "Search", "Search entries across all skill files.", "Search", () => {
      this.close();
      new SearchModal(this.plugin).open();
    });

    this.renderActionCard(grid, "MCP Tools", "Inspect and call configured MCP endpoints.", "Open Tool Runner", () => {
      this.close();
      new McpToolModal(this.plugin).open();
    });

    this.renderActionCard(grid, "Daily Review", "Generate a summary of today's captures.", "Generate", () => {
      this.close();
      new DailyReviewModal(this.plugin).open();
    });

    this.renderActionCard(grid, "Finance", "Recompute the current month summary from your finance inbox.", "Refresh Summary", async () => {
      const path = await this.plugin.refreshCurrentMonthFinanceSummary();
      new Notice(`Updated finance summary: ${path}`);
    });

    this.renderActionCard(grid, "Storage", "Configured vault targets for every skill.", "View Targets", () => {
      new Notice(
        [
          `Finance: ${this.plugin.settings.financeFolder}`,
          `Subscriptions: ${this.plugin.settings.subscriptionFile}`,
          `Tasks: ${this.plugin.settings.taskFile}`,
          `Reminders: ${this.plugin.settings.reminderFile}`,
          `Memos: ${this.plugin.settings.memoFolder}`,
          `Habits: ${this.plugin.settings.habitFolder}`,
          `Ideas: ${this.plugin.settings.ideaFile}`
        ].join(" | ")
      );
    });

    // subscription status card
    this.renderSubscriptionCard(grid);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private enabledSkillCount(): number {
    return Object.values(this.plugin.settings.skills).filter(Boolean).length;
  }

  private async loadAsyncStats(stats: HTMLElement): Promise<void> {
    try {
      const financePath = normalizePath(this.plugin.getCurrentMonthFinancePath());
      const file = this.app.vault.getAbstractFileByPath(financePath);
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        const expenseMatch = content.match(/- Expense:\s*([\d.]+)/);
        const incomeMatch = content.match(/- Income:\s*([\d.]+)/);
        if (expenseMatch) {
          this.renderStat(stats, "Expense", expenseMatch[1]);
        }
        if (incomeMatch) {
          this.renderStat(stats, "Income", incomeMatch[1]);
        }
      }

      // count open todos
      const taskFile = this.app.vault.getAbstractFileByPath(normalizePath(this.plugin.settings.taskFile));
      if (taskFile instanceof TFile) {
        const content = await this.app.vault.read(taskFile);
        const openCount = (content.match(/状态:\s*open/g) || []).length;
        this.renderStat(stats, "Open Todos", String(openCount));
      }

      // budget progress
      const budget = this.plugin.settings.budget.monthlyBudget;
      if (budget > 0) {
        const content = file instanceof TFile ? await this.app.vault.read(file) : "";
        const expenseMatch = content.match(/- Expense:\s*([\d.]+)/);
        const spent = expenseMatch ? Number.parseFloat(expenseMatch[1]) : 0;
        const pct = Math.min(100, (spent / budget) * 100);
        this.renderStat(stats, "Budget", `${pct.toFixed(0)}% used`);
      }
    } catch {
      // stats are optional, don't fail
    }
  }

  private renderSubscriptionCard(grid: HTMLElement): void {
    const card = grid.createDiv({ cls: "sch-card sch-hub-card" });
    card.createEl("h3", { text: "Subscriptions" });

    const subFile = this.app.vault.getAbstractFileByPath(normalizePath(this.plugin.settings.subscriptionFile));
    if (!(subFile instanceof TFile)) {
      card.createEl("p", { cls: "sch-card-copy", text: "No subscription file found." });
      return;
    }

    this.app.vault.read(subFile).then((content) => {
      const entries = this.parseUpcomingSubscriptions(content);
      if (entries.length === 0) {
        card.createEl("p", { cls: "sch-card-copy", text: "No upcoming subscriptions." });
        return;
      }

      const list = card.createEl("ul");
      for (const entry of entries.slice(0, 5)) {
        const item = list.createEl("li");
        item.textContent = `${entry.vendor} — ${entry.dueDate} (${entry.amount})`;
      }
    }).catch(() => {
      card.createEl("p", { cls: "sch-card-copy", text: "Could not read subscriptions." });
    });
  }

  private parseUpcomingSubscriptions(content: string): Array<{ vendor: string; dueDate: string; amount: string }> {
    const entries: Array<{ vendor: string; dueDate: string; amount: string }> = [];
    const lines = content.split("\n");
    let vendor = "";
    let dueDate = "";
    let amount = "";

    for (const line of lines) {
      if (/^\s*>\s+\[!/.test(line)) {
        if (vendor && dueDate) entries.push({ vendor, dueDate, amount });
        const titleMatch = line.match(/\|\s*(.+)$/);
        vendor = titleMatch?.[1]?.trim() ?? "";
        dueDate = "";
        amount = "";
        continue;
      }

      const dueMatch = line.match(/^\s*>\s*-\s*下次到期:\s*(.+)$/);
      if (dueMatch) { dueDate = dueMatch[1].trim(); continue; }

      const amountMatch = line.match(/^\s*>\s*-\s*金额:\s*(.+)$/);
      if (amountMatch) { amount = amountMatch[1].trim(); continue; }
    }

    if (vendor && dueDate) entries.push({ vendor, dueDate, amount });
    return entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  private renderStat(parent: HTMLElement, label: string, value: string): void {
    const stat = parent.createDiv({ cls: "sch-stat" });
    stat.createEl("span", { cls: "sch-stat-label", text: label });
    stat.createEl("strong", { cls: "sch-stat-value", text: value });
  }

  private renderActionCard(
    parent: HTMLElement,
    title: string,
    description: string,
    buttonText: string,
    onClick: () => void | Promise<void>
  ): void {
    const card = parent.createDiv({ cls: "sch-card sch-hub-card" });
    card.createEl("h3", { text: title });
    card.createEl("p", { cls: "sch-card-copy", text: description });

    const button = card.createEl("button", { cls: "sch-primary-button", text: buttonText });
    button.addEventListener("click", async () => {
      await onClick();
    });
  }
}
