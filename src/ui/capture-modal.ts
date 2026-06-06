import { Modal, Notice } from "obsidian";
import type SmartCapturePlugin from "../main";
import type { CapturePreview, SkillType } from "../types";
import { renderSkillBadge } from "../services/render";

export class CaptureModal extends Modal {
  private inputValue = "";
  private textAreaEl: HTMLTextAreaElement | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private statusEl: HTMLElement | null = null;
  private previewBadgeEl: HTMLElement | null = null;
  private previewPathEl: HTMLElement | null = null;
  private previewSummaryEl: HTMLElement | null = null;
  private previewBodyEl: HTMLPreElement | null = null;
  private previewConfirmButton: HTMLButtonElement | null = null;
  private preview: CapturePreview | null = null;
  private batchMode = false;
  private batchPreviews: CapturePreview[] = [];
  private readonly eventCleanups: Array<() => void> = [];
  private readonly forcedSkill?: SkillType;

  constructor(plugin: SmartCapturePlugin, forcedSkill?: SkillType) {
    super(plugin.app);
    this.plugin = plugin;
    this.forcedSkill = forcedSkill;
  }

  private readonly plugin: SmartCapturePlugin;

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const shell = contentEl.createDiv({ cls: "sch-shell sch-capture-shell" });
    const hero = shell.createDiv({ cls: "sch-hero" });
    hero.createEl("p", { cls: "sch-kicker", text: this.forcedSkill ? `DIRECT: ${renderSkillBadge(this.forcedSkill)}` : "CAPTURE FLOW" });
    hero.createEl("h2", { text: this.forcedSkill ? `Capture: ${renderSkillBadge(this.forcedSkill)}` : "Smart Capture" });
    hero.createEl("p", {
      cls: "sch-hero-copy",
      text: this.forcedSkill
        ? "Input will be directly routed to this skill without analysis."
        : "Type or transcribe first, then inspect the routed preview before anything touches the vault."
    });

    const inputCard = shell.createDiv({ cls: "sch-card sch-input-card" });
    inputCard.createEl("h3", { text: "Input" });
    inputCard.createEl("p", {
      cls: "sch-card-copy",
      text: "Examples: lunch 32 cny, todo call Alice tomorrow, subscription YouTube 88 yearly"
    });

    this.textAreaEl = inputCard.createEl("textarea", {
      cls: "sch-input-area",
      attr: { rows: "7", placeholder: "Describe the thing you want to capture..." }
    }) as HTMLTextAreaElement;
    const onInput = () => {
      this.inputValue = this.textAreaEl?.value ?? "";
      this.clearPreview(false);
    };
    this.textAreaEl.addEventListener("input", onInput);
    this.eventCleanups.push(() => this.textAreaEl?.removeEventListener("input", onInput));

    const voiceRow = inputCard.createDiv({ cls: "sch-action-row" });
    const startButton = voiceRow.createEl("button", { cls: "sch-secondary-button", text: "Start Recording" }) as HTMLButtonElement;
    const stopButton = voiceRow.createEl("button", { cls: "sch-secondary-button", text: "Stop + Transcribe" }) as HTMLButtonElement;
    const batchButton = voiceRow.createEl("button", { cls: "sch-secondary-button", text: "Batch Mode: OFF" }) as HTMLButtonElement;
    const previewButton = voiceRow.createEl("button", { cls: "sch-primary-button", text: "Preview" }) as HTMLButtonElement;
    const confirmButton = voiceRow.createEl("button", {
      cls: "sch-primary-button",
      text: "Write",
      attr: { disabled: "true" }
    }) as HTMLButtonElement;
    this.previewConfirmButton = confirmButton;

    const onStart = async () => { await this.startRecording(); };
    const onStop = async () => { await this.stopRecordingAndTranscribe(); };
    const onBatch = () => {
      this.batchMode = !this.batchMode;
      batchButton.textContent = `Batch Mode: ${this.batchMode ? "ON" : "OFF"}`;
    };
    const onPreview = async () => { await this.generatePreview(); };
    const onConfirm = async () => { await this.commitPreview(); };
    startButton.addEventListener("click", onStart);
    stopButton.addEventListener("click", onStop);
    batchButton.addEventListener("click", onBatch);
    previewButton.addEventListener("click", onPreview);
    confirmButton.addEventListener("click", onConfirm);
    this.eventCleanups.push(
      () => startButton.removeEventListener("click", onStart),
      () => stopButton.removeEventListener("click", onStop),
      () => batchButton.removeEventListener("click", onBatch),
      () => previewButton.removeEventListener("click", onPreview),
      () => confirmButton.removeEventListener("click", onConfirm)
    );

    const previewCard = shell.createDiv({ cls: "sch-card sch-preview-card" });
    previewCard.createEl("h3", { text: "Preview" });
    const previewHeader = previewCard.createDiv({ cls: "sch-preview-header" });
    this.previewBadgeEl = previewHeader.createEl("span", { cls: "sch-pill", text: "Not analyzed" });
    this.previewPathEl = previewHeader.createDiv({ cls: "sch-preview-path", text: "Target path will appear here." });
    this.previewSummaryEl = previewCard.createEl("p", {
      cls: "sch-card-copy",
      text: "Generate a preview to see the routed skill, the target file, and the final markdown payload."
    });
    this.previewBodyEl = previewCard.createEl("pre", {
      cls: "sch-preview-code",
      text: "Preview content will appear here."
    });

    this.statusEl = shell.createEl("div", { cls: "sch-status", text: "Idle" });
  }

  onClose(): void {
    this.cleanupRecordingResources();
    for (const cleanup of this.eventCleanups) cleanup();
    this.eventCleanups.length = 0;
    this.contentEl.empty();
  }

  private async generatePreview(): Promise<void> {
    const text = this.inputValue.trim();
    if (!text) {
      new Notice("Please enter some text.");
      return;
    }

    if (this.batchMode) {
      await this.generateBatchPreview(text);
    } else {
      await this.generateSinglePreview(text);
    }
  }

  private async generateSinglePreview(text: string): Promise<void> {
    this.setStatus("Analyzing input...");

    try {
      const preview = this.forcedSkill
        ? await this.previewWithForcedSkill(text)
        : await this.plugin.previewInput(text);
      this.preview = preview;
      this.batchPreviews = [];
      this.renderPreview(preview);
      this.setStatus(`Preview ready: ${preview.result.path}`);
      if (this.previewConfirmButton) {
        this.previewConfirmButton.disabled = false;
      }
    } catch (error) {
      this.preview = null;
      this.renderEmptyPreview();
      this.setStatus("Preview failed.");
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  private async generateBatchPreview(text: string): Promise<void> {
    this.setStatus("Analyzing batch input...");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const previews: CapturePreview[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const preview = this.forcedSkill
          ? await this.previewWithForcedSkill(lines[i].trim())
          : await this.plugin.previewInput(lines[i].trim());
        previews.push(preview);
        this.setStatus(`Analyzing... ${i + 1}/${lines.length}`);
      } catch (error) {
        // skip failed lines
      }
    }

    this.batchPreviews = previews;
    this.preview = null;

    if (this.previewBadgeEl) this.previewBadgeEl.textContent = `Batch: ${previews.length} items`;
    if (this.previewPathEl) this.previewPathEl.textContent = `${previews.length} entries to write`;
    if (this.previewSummaryEl) {
      this.previewSummaryEl.textContent = previews.map((p) => p.result.summary).join("\n");
    }
    if (this.previewBodyEl) {
      this.previewBodyEl.textContent = previews.map((p, i) => `--- Entry ${i + 1} ---\n${p.result.content.trimEnd()}`).join("\n\n");
    }

    this.setStatus(`Batch preview ready: ${previews.length} items`);
    if (this.previewConfirmButton) this.previewConfirmButton.disabled = previews.length > 0;
  }

  private async commitPreview(): Promise<void> {
    if (this.batchPreviews.length > 0) {
      await this.commitBatch();
    } else if (this.preview) {
      await this.commitSingle();
    } else {
      new Notice("Generate a preview first.");
    }
  }

  private async commitSingle(): Promise<void> {
    if (!this.preview) return;

    try {
      const summary = await this.plugin.commitPreview(this.preview);
      this.setStatus("Write complete.");
      new Notice(summary);
      this.close();
    } catch (error) {
      this.setStatus("Write failed.");
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  private async commitBatch(): Promise<void> {
    let written = 0;
    for (const preview of this.batchPreviews) {
      try {
        await this.plugin.commitPreview(preview);
        written++;
        this.setStatus(`Writing... ${written}/${this.batchPreviews.length}`);
      } catch {
        // continue on error
      }
    }

    this.setStatus(`Batch write complete: ${written}/${this.batchPreviews.length}`);
    new Notice(`Batch: ${written}/${this.batchPreviews.length} entries written.`);
    this.close();
  }

  private async previewWithForcedSkill(text: string): Promise<CapturePreview> {
    const router = await import("../router");
    const r = new router.IntentRouter(this.plugin.settings);
    const normalized = await r.route(text);
    normalized.skill = this.forcedSkill!;

    const result = this.plugin.getSkill(this.forcedSkill!)!.execute(normalized, {
      settings: this.plugin.settings,
      now: new Date()
    });

    return { intent: normalized, result };
  }

  private renderPreview(preview: CapturePreview): void {
    if (this.previewBadgeEl) {
      this.previewBadgeEl.textContent = renderSkillBadge(preview.intent.skill);
    }
    if (this.previewPathEl) {
      this.previewPathEl.textContent = preview.result.path;
    }
    if (this.previewSummaryEl) {
      this.previewSummaryEl.textContent = preview.result.summary;
    }
    if (this.previewBodyEl) {
      this.previewBodyEl.textContent = preview.result.content.trimEnd();
    }
  }

  private renderEmptyPreview(): void {
    if (this.previewBadgeEl) {
      this.previewBadgeEl.textContent = "Not analyzed";
    }
    if (this.previewPathEl) {
      this.previewPathEl.textContent = "Target path will appear here.";
    }
    if (this.previewSummaryEl) {
      this.previewSummaryEl.textContent =
        "Generate a preview to see the routed skill, the target file, and the final markdown payload.";
    }
    if (this.previewBodyEl) {
      this.previewBodyEl.textContent = "Preview content will appear here.";
    }
    if (this.previewConfirmButton) {
      this.previewConfirmButton.disabled = true;
    }
  }

  private clearPreview(updateStatus = true): void {
    this.preview = null;
    this.batchPreviews = [];
    this.renderEmptyPreview();
    if (updateStatus) {
      this.setStatus("Idle");
    }
  }

  private async startRecording(): Promise<void> {
    if (this.recorder && this.recorder.state === "recording") {
      new Notice("Recording already in progress.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      new Notice("MediaRecorder is not supported in this environment.");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      this.recorder = new MediaRecorder(this.stream);

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.recorder.start();
      this.setStatus("Recording...");
      new Notice("Recording started.");
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
      this.cleanupRecordingResources();
    }
  }

  private async stopRecordingAndTranscribe(): Promise<void> {
    if (!this.recorder || this.recorder.state !== "recording") {
      new Notice("No active recording.");
      return;
    }

    this.setStatus("Processing audio...");
    const recorder = this.recorder;

    const recordedBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type: mimeType }));
      };
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.stop();
    });

    this.cleanupRecordingResources();

    if (recordedBlob.size === 0) {
      new Notice("Empty recording. Please try again.");
      this.setStatus("Idle");
      return;
    }

    try {
      const text = await this.plugin.transcribeAudio(recordedBlob);
      this.appendText(text);
      this.setStatus("Transcription complete.");
      new Notice("Transcription appended.");
    } catch (error) {
      this.setStatus("Transcription failed.");
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  private appendText(value: string): void {
    const next = this.inputValue ? `${this.inputValue}\n${value}` : value;
    this.inputValue = next;
    if (this.textAreaEl) {
      this.textAreaEl.value = next;
      this.textAreaEl.dispatchEvent(new Event("input"));
    }
    this.clearPreview(false);
  }

  private cleanupRecordingResources(): void {
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.stop();
    }
    this.recorder = null;

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    this.chunks = [];
  }

  private setStatus(text: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }
}
