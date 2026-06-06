import { Notice, Plugin } from "obsidian";
import { IntentRouter } from "./router";
import { SmartCaptureSettingTab, DEFAULT_SETTINGS } from "./settings";
import { updateFinanceSummary } from "./services/finance-summary";
import { McpService, type McpTool } from "./services/mcp";
import { scanReminders } from "./services/reminder-scanner";
import { checkSubscriptionExpiry } from "./services/subscription-watcher";
import { UndoService } from "./services/undo-service";
import { SttTranscriber } from "./services/transcription";
import { appendToVaultFile, prependToVaultFile } from "./services/vault-writer";
import { AccountingSkill } from "./skills/accounting";
import { ContactSkill } from "./skills/contact";
import { HabitSkill } from "./skills/habit";
import { IdeaSkill } from "./skills/idea";
import { MemoSkill } from "./skills/memo";
import { QuickNoteSkill } from "./skills/quick-note";
import { ReminderSkill } from "./skills/reminder";
import { SubscriptionSkill } from "./skills/subscription";
import { TodoSkill } from "./skills/todo";
import type { Skill } from "./skills/base";
import type { CapturePreview, McpEndpoint, ParsedIntent, SkillType, SmartCaptureSettings } from "./types";
import { CaptureModal } from "./ui/capture-modal";
import { DailyReviewModal } from "./ui/daily-review-modal";
import { McpToolModal } from "./ui/mcp-tool-modal";
import { SearchModal } from "./ui/search-modal";
import { WorkspaceHubModal } from "./ui/workspace-hub-modal";

export default class SmartCapturePlugin extends Plugin {
  settings: SmartCaptureSettings = DEFAULT_SETTINGS;
  private skills = new Map<SkillType, Skill>();
  private mcpService: McpService | null = null;
  private undoService = new UndoService();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerSkills();
    this.mcpService = new McpService(this.settings.mcpEndpoints);

    this.addSettingTab(new SmartCaptureSettingTab(this.app, this));

    this.addRibbonIcon("layout-dashboard", "Workspace Hub", () => {
      new WorkspaceHubModal(this).open();
    });

    this.addCommand({
      id: "open-workspace-hub",
      name: "Open Workspace Hub",
      callback: () => { new WorkspaceHubModal(this).open(); }
    });

    this.addCommand({
      id: "open-smart-capture-modal",
      name: "Open Smart Capture",
      callback: () => { new CaptureModal(this).open(); }
    });

    this.addCommand({
      id: "open-mcp-tool-runner",
      name: "Open MCP Tool Runner",
      callback: () => { new McpToolModal(this).open(); }
    });

    this.addCommand({
      id: "search-entries",
      name: "Search Entries",
      callback: () => { new SearchModal(this).open(); }
    });

    this.addCommand({
      id: "undo-last-capture",
      name: "Undo Last Capture",
      callback: async () => {
        if (!this.undoService.canUndo()) {
          new Notice("Nothing to undo.");
          return;
        }
        const result = await this.undoService.undo(this.app.vault);
        new Notice(result ?? "Undo failed.");
      }
    });

    this.addCommand({
      id: "generate-daily-review",
      name: "Generate Daily Review",
      callback: () => { new DailyReviewModal(this).open(); }
    });

    // direct capture commands for each skill
    const directSkills: SkillType[] = ["accounting", "subscription", "todo", "reminder", "memo", "habit", "quick-note", "contact", "idea"];
    for (const skill of directSkills) {
      this.addCommand({
        id: `capture-${skill}`,
        name: `Capture: ${skill}`,
        callback: () => { new CaptureModal(this, skill).open(); }
      });
    }

    this.addCommand({
      id: "ping-enabled-mcp-endpoints",
      name: "Ping MCP endpoints",
      callback: async () => {
        const mcp = this.createMcpService();
        const endpoints = mcp.getEnabledEndpoints();
        if (endpoints.length === 0) {
          new Notice("No enabled MCP endpoints found.");
          return;
        }
        for (const endpoint of endpoints) {
          const ok = await mcp.pingEndpoint(endpoint);
          new Notice(`${endpoint.name}: ${ok ? "reachable" : "unreachable"}`);
        }
      }
    });

    this.addCommand({
      id: "refresh-current-month-finance-summary",
      name: "Refresh current month finance summary",
      callback: async () => {
        const path = await this.refreshCurrentMonthFinanceSummary();
        new Notice(`Updated finance summary: ${path}`);
      }
    });

    // reminder scanner interval
    this.setupReminderScanner();
  }

  async captureInput(rawInput: string): Promise<string> {
    const preview = await this.previewInput(rawInput);
    return this.commitPreview(preview);
  }

  async previewInput(rawInput: string): Promise<CapturePreview> {
    const router = new IntentRouter(this.settings);
    const intent = await router.route(rawInput);
    const skill = this.skills.get(intent.skill);

    if (!skill) {
      throw new Error(`No skill registered for ${intent.skill}`);
    }

    const result = skill.execute(intent, {
      settings: this.settings,
      now: new Date()
    });

    return { intent, result };
  }

  async commitPreview(preview: CapturePreview): Promise<string> {
    const { intent, result } = preview;

    // save state for undo
    await this.undoService.push(this.app.vault, result.path);

    if (result.action === "append") {
      await appendToVaultFile(this.app.vault, result.path, result.content);
    } else {
      await prependToVaultFile(this.app.vault, result.path, result.content);
    }

    if (intent.skill === "accounting") {
      await updateFinanceSummary(this.app.vault, result.path);
    }

    if (intent.skill === "reminder") {
      await this.syncReminderToMcp(intent);
    }

    return result.summary;
  }

  async transcribeAudio(blob: Blob): Promise<string> {
    const transcriber = new SttTranscriber(this.settings.stt);
    return transcriber.transcribeAudio(blob);
  }

  async autoFillLlmModel(): Promise<string> {
    const models = await this.discoverModels(
      this.settings.llm.baseUrl,
      this.settings.llm.apiKey,
      this.settings.llm.timeoutMs
    );
    const model = pickPreferredModel(models, [
      "gpt-4o-mini",
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4.1",
      "claude-3-5-sonnet",
      "claude-3-7-sonnet"
    ]);
    this.settings.llm.model = model;
    await this.saveSettings();
    return model;
  }

  async autoFillSttModel(): Promise<string> {
    const models = await this.discoverModels(
      this.settings.stt.baseUrl,
      this.settings.stt.apiKey,
      this.settings.stt.timeoutMs
    );
    const model = pickPreferredModel(models, ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"]);
    this.settings.stt.model = model;
    await this.saveSettings();
    return model;
  }

  async refreshCurrentMonthFinanceSummary(): Promise<string> {
    const path = this.getCurrentMonthFinancePath(new Date());
    await updateFinanceSummary(this.app.vault, path);
    return path;
  }

  getEnabledMcpEndpoints(): McpEndpoint[] {
    return this.settings.mcpEndpoints.filter((e) => e.enabled && e.urlOrCommand.trim().length > 0);
  }

  async listMcpTools(endpoint: McpEndpoint): Promise<McpTool[]> {
    const mcp = this.createMcpService();
    return mcp.listTools(endpoint);
  }

  async callMcpTool(endpoint: McpEndpoint, toolName: string, args: Record<string, unknown>): Promise<string> {
    const mcp = this.createMcpService();
    return mcp.callTool(endpoint, toolName, args);
  }

  getSkill(skillType: SkillType): Skill | undefined {
    return this.skills.get(skillType);
  }

  getUndoService(): UndoService {
    return this.undoService;
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data,
      llm: { ...DEFAULT_SETTINGS.llm, ...(data?.llm ?? {}) },
      stt: { ...DEFAULT_SETTINGS.stt, ...(data?.stt ?? {}) },
      skills: { ...DEFAULT_SETTINGS.skills, ...(data?.skills ?? {}) },
      mcpEndpoints: Array.isArray(data?.mcpEndpoints) ? data.mcpEndpoints : DEFAULT_SETTINGS.mcpEndpoints,
      reminderMcp: { ...DEFAULT_SETTINGS.reminderMcp, ...(data?.reminderMcp ?? {}) },
      budget: { ...DEFAULT_SETTINGS.budget, ...(data?.budget ?? {}) },
      reminderScanner: { ...DEFAULT_SETTINGS.reminderScanner, ...(data?.reminderScanner ?? {}) },
      templates: { ...DEFAULT_SETTINGS.templates, ...(data?.templates ?? {}) }
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private registerSkills(): void {
    const entries: Skill[] = [
      new AccountingSkill(),
      new SubscriptionSkill(),
      new TodoSkill(),
      new ReminderSkill(),
      new MemoSkill(),
      new HabitSkill(),
      new QuickNoteSkill(),
      new ContactSkill(),
      new IdeaSkill()
    ];

    for (const skill of entries) {
      this.skills.set(skill.id, skill);
    }
  }

  private createMcpService(): McpService {
    if (!this.mcpService) {
      this.mcpService = new McpService(this.settings.mcpEndpoints);
    }
    return this.mcpService;
  }

  private setupReminderScanner(): void {
    if (!this.settings.reminderScanner.enabled) return;

    const intervalMs = Math.max(1, this.settings.reminderScanner.intervalMinutes) * 60 * 1000;

    this.registerInterval(
      window.setInterval(() => {
        scanReminders(this.app.vault, this.settings.reminderFile);
        checkSubscriptionExpiry(
          this.app.vault,
          this.settings.subscriptionFile,
          this.settings.reminderFile,
          this.settings.reminderScanner.advanceNoticeDays
        );
      }, intervalMs)
    );

    // also run once on load after a short delay
    window.setTimeout(() => {
      scanReminders(this.app.vault, this.settings.reminderFile);
      checkSubscriptionExpiry(
        this.app.vault,
        this.settings.subscriptionFile,
        this.settings.reminderFile,
        this.settings.reminderScanner.advanceNoticeDays
      );
    }, 3000);
  }

  private async syncReminderToMcp(intent: ParsedIntent): Promise<void> {
    if (!this.settings.reminderMcp.enabled) return;
    const toolName = this.settings.reminderMcp.toolName.trim();
    if (!toolName) return;

    const endpoint = this.resolveReminderEndpoint();
    if (!endpoint) {
      new Notice("Reminder MCP sync skipped: no matching enabled endpoint.");
      return;
    }

    try {
      const result = await this.callMcpTool(endpoint, toolName, {
        title: intent.title ?? intent.text,
        text: intent.text,
        dueDate: intent.dueDate ?? null,
        source: "obsidian-smart-capture"
      });
      if (result.trim().length > 0) {
        new Notice(`Reminder synced via MCP: ${endpoint.name}`);
      }
    } catch (error) {
      new Notice(`Reminder MCP sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private resolveReminderEndpoint(): McpEndpoint | null {
    const enabled = this.getEnabledMcpEndpoints();
    if (enabled.length === 0) return null;

    const preferredName = this.settings.reminderMcp.endpointName.trim().toLowerCase();
    if (!preferredName) return enabled[0];

    return enabled.find((endpoint) => endpoint.name.trim().toLowerCase() === preferredName) ?? null;
  }

  private async discoverModels(baseUrl: string, apiKey: string, timeoutMs: number): Promise<string[]> {
    const trimmedBaseUrl = baseUrl.trim().replace(/\/$/, "");
    if (!trimmedBaseUrl) {
      throw new Error("Base URL is required.");
    }
    if (!apiKey.trim()) {
      throw new Error("API key is required.");
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(timeoutMs, 5000));

    try {
      const response = await fetch(`${trimmedBaseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Model discovery failed: ${response.status}`);
      }

      const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
      const ids = (payload.data ?? [])
        .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
        .filter((item) => item.length > 0);

      if (ids.length === 0) {
        throw new Error("No models found from this endpoint.");
      }

      return ids;
    } finally {
      window.clearTimeout(timer);
    }
  }

  getCurrentMonthFinancePath(date: Date = new Date()): string {
    return `${this.settings.financeFolder}/${this.currentMonthString(date)}.md`;
  }

  private currentMonthString(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }

  onunload(): void {
    this.mcpService?.dispose();
    this.mcpService = null;
  }
}

function pickPreferredModel(models: string[], preferred: string[]): string {
  const loweredMap = new Map<string, string>();
  for (const model of models) {
    loweredMap.set(model.toLowerCase(), model);
  }

  for (const expected of preferred) {
    const hit = loweredMap.get(expected.toLowerCase());
    if (hit) return hit;
  }

  return models[0];
}
