import { Modal, Setting } from "obsidian";
import type SmartCapturePlugin from "../main";
import type { SkillType } from "../types";
import { SearchService, type SearchResult } from "../services/search-service";
import { renderSkillBadge } from "../services/render";

export class SearchModal extends Modal {
  private keyword = "";
  private skillFilter: SkillType | "" = "";
  private dateFrom = "";
  private dateTo = "";
  private tagFilter = "";
  private resultsEl: HTMLElement | null = null;

  constructor(private readonly plugin: SmartCapturePlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Search Entries" });

    new Setting(contentEl).setName("Keyword").addText((text) => {
      text.setPlaceholder("search keyword...").onChange((value) => {
        this.keyword = value;
      });
    });

    const skillOptions: Record<string, string> = { "": "All skills" };
    const allSkills: SkillType[] = ["accounting", "subscription", "todo", "reminder", "memo", "habit", "quick-note", "contact", "idea"];
    for (const s of allSkills) {
      skillOptions[s] = renderSkillBadge(s);
    }

    new Setting(contentEl).setName("Skill type").addDropdown((drop) => {
      for (const [value, label] of Object.entries(skillOptions)) {
        drop.addOption(value, label);
      }
      drop.onChange((value) => {
        this.skillFilter = value as SkillType | "";
      });
    });

    new Setting(contentEl).setName("Date from (YYYY-MM-DD)").addText((text) => {
      text.setPlaceholder("2026-01-01").onChange((value) => {
        this.dateFrom = value.trim();
      });
    });

    new Setting(contentEl).setName("Date to (YYYY-MM-DD)").addText((text) => {
      text.setPlaceholder("2026-12-31").onChange((value) => {
        this.dateTo = value.trim();
      });
    });

    new Setting(contentEl).setName("Tag").addText((text) => {
      text.setPlaceholder("#work").onChange((value) => {
        this.tagFilter = value.trim();
      });
    });

    const searchButton = contentEl.createEl("button", { cls: "sch-primary-button", text: "Search" });
    searchButton.addEventListener("click", async () => {
      await this.runSearch();
    });

    this.resultsEl = contentEl.createDiv({ cls: "sch-search-results" });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async runSearch(): Promise<void> {
    if (!this.resultsEl) return;
    this.resultsEl.empty();
    this.resultsEl.createEl("p", { text: "Searching..." });

    try {
      const service = new SearchService(this.plugin.settings);
      const results = await service.searchAll(this.app.vault, {
        keyword: this.keyword || undefined,
        skillType: (this.skillFilter || undefined) as SkillType | undefined,
        dateRange: (this.dateFrom || this.dateTo) ? {
          from: this.dateFrom,
          to: this.dateTo
        } : undefined,
        tag: this.tagFilter || undefined
      });

      this.resultsEl.empty();

      if (results.length === 0) {
        this.resultsEl.createEl("p", { text: "No results found." });
        return;
      }

      this.resultsEl.createEl("p", { text: `${results.length} results` });

      for (const result of results) {
        this.renderResultItem(result);
      }
    } catch (error) {
      this.resultsEl.empty();
      this.resultsEl.createEl("p", { text: error instanceof Error ? error.message : String(error) });
    }
  }

  private renderResultItem(result: SearchResult): void {
    if (!this.resultsEl) return;

    const item = this.resultsEl.createDiv({ cls: "sch-search-result" });
    const header = item.createDiv({ cls: "sch-search-result-header" });

    header.createEl("span", { cls: "sch-pill", text: renderSkillBadge(result.skill) });
    header.createEl("span", { cls: "sch-search-result-title", text: ` ${result.title}` });

    const meta = item.createDiv({ cls: "sch-search-result-meta" });
    meta.createEl("span", { text: result.date });
    meta.createEl("span", { text: ` | ${result.file}` });
    if (result.status) {
      meta.createEl("span", { text: ` | ${result.status}` });
    }

    item.addEventListener("click", () => {
      this.app.workspace.openLinkText(result.file, "", false);
      this.close();
    });

    item.style.cursor = "pointer";
  }
}
