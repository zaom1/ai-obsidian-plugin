import { Modal, Notice } from "obsidian";
import type SmartCapturePlugin from "../main";
import { generateDailyReview, saveDailyReview } from "../services/daily-review";

export class DailyReviewModal extends Modal {
  private previewEl: HTMLElement | null = null;
  private reviewContent = "";

  constructor(private readonly plugin: SmartCapturePlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Daily Review" });
    contentEl.createEl("p", { cls: "sch-card-copy", text: "Generate a summary of today's captures across all skills." });

    const actionRow = contentEl.createDiv({ cls: "sch-action-row" });

    const generateBtn = actionRow.createEl("button", { cls: "sch-primary-button", text: "Generate" });
    generateBtn.addEventListener("click", async () => {
      await this.generate();
    });

    const saveBtn = actionRow.createEl("button", {
      cls: "sch-secondary-button",
      text: "Save to Vault",
      attr: { disabled: "true" }
    });
    saveBtn.addEventListener("click", async () => {
      await this.save(saveBtn);
    });

    this.previewEl = contentEl.createEl("pre", { cls: "sch-preview-code" });
    this.previewEl.textContent = "Click Generate to create today's review.";
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async generate(): Promise<void> {
    if (!this.previewEl) return;
    this.previewEl.textContent = "Generating...";

    try {
      this.reviewContent = await generateDailyReview(this.app.vault, this.plugin.settings);
      this.previewEl.textContent = this.reviewContent;

      // enable save button
      const saveBtn = this.contentEl.querySelector(".sch-secondary-button") as HTMLButtonElement;
      if (saveBtn) saveBtn.disabled = false;
    } catch (error) {
      this.previewEl.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  private async save(saveBtn: HTMLButtonElement): Promise<void> {
    if (!this.reviewContent) {
      new Notice("Generate a review first.");
      return;
    }

    try {
      const path = await saveDailyReview(this.app.vault, this.plugin.settings, this.reviewContent);
      new Notice(`Daily review saved to ${path}`);
      saveBtn.disabled = true;
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }
}
