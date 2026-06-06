import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SmartCapturePlugin from "./main";
import type { McpEndpoint, SmartCaptureSettings } from "./types";

export const DEFAULT_SETTINGS: SmartCaptureSettings = {
  llm: {
    enabled: false,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.1,
    timeoutMs: 30000,
    useLlmForParsing: true
  },
  stt: {
    enabled: false,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "whisper-1",
    language: "zh",
    temperature: 0,
    prompt: "",
    timeoutMs: 45000
  },
  skills: {
    accounting: true,
    subscription: true,
    todo: true,
    reminder: true,
    memo: true,
    habit: true,
    "quick-note": true,
    contact: true,
    idea: true
  },
  financeFolder: "Finance",
  subscriptionFile: "Subscriptions/index.md",
  taskFile: "Tasks/inbox.md",
  reminderFile: "Reminders/inbox.md",
  memoFolder: "Memos",
  habitFolder: "Habits",
  quickNoteFolder: "QuickNotes",
  contactFile: "Contacts/index.md",
  ideaFile: "Ideas/inbox.md",
  dailyReviewFolder: "Reviews",
  archiveFolder: "Archive",
  mcpEndpoints: [
    { name: "mobile-http", transport: "http", urlOrCommand: "", enabled: false },
    { name: "mobile-sse", transport: "sse", urlOrCommand: "", enabled: false },
    { name: "desktop-stdio", transport: "stdio", urlOrCommand: "", enabled: false }
  ],
  reminderMcp: {
    enabled: false,
    endpointName: "",
    toolName: "apple_reminders_create"
  },
  budget: {
    monthlyBudget: 0,
    currency: "CNY",
    categoryBudgets: {}
  },
  reminderScanner: {
    enabled: false,
    intervalMinutes: 5,
    advanceNoticeDays: 3
  },
  templates: {
    accounting: "",
    subscription: "",
    todo: "",
    reminder: "",
    memo: "",
    habit: "",
    quickNote: "",
    contact: "",
    idea: ""
  }
};

export class SmartCaptureSettingTab extends PluginSettingTab {
  plugin: SmartCapturePlugin;

  constructor(app: App, plugin: SmartCapturePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Intent Inbox" });

    this.renderCollapsibleGroup(containerEl, "AI Services", (content) => {
      this.renderLlmSettings(content);
      this.renderSttSettings(content);
    });

    this.renderCollapsibleGroup(containerEl, "Skills & Routing", (content) => {
      this.renderSkillSettings(content);
      this.renderBudgetSettings(content);
      this.renderReminderScannerSettings(content);
    }, true);

    this.renderCollapsibleGroup(containerEl, "Storage", (content) => {
      this.renderStorageSettings(content);
    });

    this.renderCollapsibleGroup(containerEl, "MCP Integration", (content) => {
      this.renderMcpEndpoints(content);
      this.renderReminderMcpSettings(content);
    });
  }

  private renderCollapsibleGroup(
    containerEl: HTMLElement,
    title: string,
    render: (content: HTMLElement) => void,
    defaultOpen = false
  ): void {
    const details = containerEl.createEl("details", {
      cls: "sch-settings-group",
      attr: defaultOpen ? { open: "" } : {}
    });
    const summary = details.createEl("summary");
    summary.createEl("h3", { text: title });
    const content = details.createDiv();
    render(content);
  }

  private renderLlmSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "LLM Parsing" });

    new Setting(containerEl)
      .setName("Enable LLM")
      .setDesc("Use external LLM for intent parsing and normalization.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.llm.enabled).onChange(async (value) => {
          this.plugin.settings.llm.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    this.addTextSetting(containerEl, "LLM base URL", this.plugin.settings.llm.baseUrl, async (value) => {
      this.plugin.settings.llm.baseUrl = value;
      await this.plugin.saveSettings();
    });

    this.addApiKeySetting(containerEl, "LLM API key", this.plugin.settings.llm.apiKey, async (value) => {
      this.plugin.settings.llm.apiKey = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "LLM model", this.plugin.settings.llm.model, async (value) => {
      this.plugin.settings.llm.model = value;
      await this.plugin.saveSettings();
    });

    new Setting(containerEl)
      .setName("Auto detect LLM model")
      .setDesc("Fetch /models using current LLM base URL + API key, then fill model automatically.")
      .addButton((button) =>
        button.setButtonText("Fetch + Fill").onClick(async () => {
          button.setDisabled(true);
          try {
            const model = await this.plugin.autoFillLlmModel();
            new Notice(`LLM model set to: ${model}`);
            this.display();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : String(error));
          } finally {
            button.setDisabled(false);
          }
        })
      );

    new Setting(containerEl)
      .setName("Use LLM for parsing")
      .setDesc("If disabled, parser falls back to local rule-based routing only.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.llm.useLlmForParsing).onChange(async (value) => {
          this.plugin.settings.llm.useLlmForParsing = value;
          await this.plugin.saveSettings();
        })
      );
  }

  private renderSttSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Voice Transcription (STT)" });

    new Setting(containerEl)
      .setName("Enable STT")
      .setDesc("Used by the Record button in Smart Capture modal.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.stt.enabled).onChange(async (value) => {
          this.plugin.settings.stt.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    this.addTextSetting(containerEl, "STT base URL", this.plugin.settings.stt.baseUrl, async (value) => {
      this.plugin.settings.stt.baseUrl = value;
      await this.plugin.saveSettings();
    });

    this.addApiKeySetting(containerEl, "STT API key", this.plugin.settings.stt.apiKey, async (value) => {
      this.plugin.settings.stt.apiKey = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "STT model", this.plugin.settings.stt.model, async (value) => {
      this.plugin.settings.stt.model = value;
      await this.plugin.saveSettings();
    });

    new Setting(containerEl)
      .setName("Auto detect STT model")
      .setDesc("Fetch /models using current STT base URL + API key, then fill model automatically.")
      .addButton((button) =>
        button.setButtonText("Fetch + Fill").onClick(async () => {
          button.setDisabled(true);
          try {
            const model = await this.plugin.autoFillSttModel();
            new Notice(`STT model set to: ${model}`);
            this.display();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : String(error));
          } finally {
            button.setDisabled(false);
          }
        })
      );

    this.addTextSetting(containerEl, "STT language", this.plugin.settings.stt.language, async (value) => {
      this.plugin.settings.stt.language = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "STT prompt", this.plugin.settings.stt.prompt, async (value) => {
      this.plugin.settings.stt.prompt = value;
      await this.plugin.saveSettings();
    });
  }

  private renderStorageSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Storage targets" });

    this.addTextSetting(containerEl, "Finance folder", this.plugin.settings.financeFolder, async (value) => {
      this.plugin.settings.financeFolder = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Subscription file", this.plugin.settings.subscriptionFile, async (value) => {
      this.plugin.settings.subscriptionFile = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Task file", this.plugin.settings.taskFile, async (value) => {
      this.plugin.settings.taskFile = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Reminder file", this.plugin.settings.reminderFile, async (value) => {
      this.plugin.settings.reminderFile = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Memo folder", this.plugin.settings.memoFolder, async (value) => {
      this.plugin.settings.memoFolder = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Habit folder", this.plugin.settings.habitFolder, async (value) => {
      this.plugin.settings.habitFolder = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Quick note folder", this.plugin.settings.quickNoteFolder, async (value) => {
      this.plugin.settings.quickNoteFolder = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Contact file", this.plugin.settings.contactFile, async (value) => {
      this.plugin.settings.contactFile = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Idea file", this.plugin.settings.ideaFile, async (value) => {
      this.plugin.settings.ideaFile = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Daily review folder", this.plugin.settings.dailyReviewFolder, async (value) => {
      this.plugin.settings.dailyReviewFolder = value;
      await this.plugin.saveSettings();
    });

    this.addTextSetting(containerEl, "Archive folder", this.plugin.settings.archiveFolder, async (value) => {
      this.plugin.settings.archiveFolder = value;
      await this.plugin.saveSettings();
    });
  }

  private renderSkillSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Skills" });

    this.addSkillToggle(containerEl, "Accounting", "accounting");
    this.addSkillToggle(containerEl, "Subscription", "subscription");
    this.addSkillToggle(containerEl, "Todo", "todo");
    this.addSkillToggle(containerEl, "Reminder", "reminder");
    this.addSkillToggle(containerEl, "Memo", "memo");
    this.addSkillToggle(containerEl, "Habit", "habit");
    this.addSkillToggle(containerEl, "Quick Note", "quick-note");
    this.addSkillToggle(containerEl, "Contact", "contact");
    this.addSkillToggle(containerEl, "Idea", "idea");
  }

  private renderMcpEndpoints(containerEl: HTMLElement): void {
    const endpointsContainer = containerEl.createDiv({ cls: "sch-mcp-endpoints" });

    const renderEndpoint = (endpoint: McpEndpoint, idx: number) => {
      const row = endpointsContainer.createDiv({ cls: "sch-mcp-row" });
      new Setting(row)
        .setName(`Endpoint ${idx + 1}: ${endpoint.name}`)
        .setDesc(`${endpoint.transport.toUpperCase()} | ${endpoint.urlOrCommand || "(not configured)"}`)
        .addToggle((toggle) =>
          toggle.setValue(endpoint.enabled).onChange(async (value) => {
            endpoint.enabled = value;
            await this.plugin.saveSettings();
            row.empty();
            renderEndpoint(endpoint, idx);
          })
        )
        .addDropdown((drop) =>
          drop
            .addOption("http", "http")
            .addOption("sse", "sse")
            .addOption("stdio", "stdio")
            .setValue(endpoint.transport)
            .onChange(async (value) => {
              endpoint.transport = value as "http" | "sse" | "stdio";
              await this.plugin.saveSettings();
              row.empty();
              renderEndpoint(endpoint, idx);
            })
        )
        .addText((text) =>
          text.setPlaceholder("name").setValue(endpoint.name).onChange(async (value) => {
            endpoint.name = value.trim() || endpoint.name;
            await this.plugin.saveSettings();
          })
        )
        .addText((text) =>
          text.setPlaceholder("url or command").setValue(endpoint.urlOrCommand).onChange(async (value) => {
            endpoint.urlOrCommand = value.trim();
            await this.plugin.saveSettings();
          })
        )
        .addText((text) =>
          text.setPlaceholder("auth header").setValue(endpoint.authHeader ?? "").onChange(async (value) => {
            endpoint.authHeader = value.trim();
            await this.plugin.saveSettings();
          })
        );
    };

    for (let idx = 0; idx < this.plugin.settings.mcpEndpoints.length; idx++) {
      renderEndpoint(this.plugin.settings.mcpEndpoints[idx], idx);
    }
  }

  private renderReminderMcpSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Reminder MCP Automation" });

    new Setting(containerEl)
      .setName("Enable reminder auto sync")
      .setDesc("After writing reminder note, call MCP tool automatically.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.reminderMcp.enabled).onChange(async (value) => {
          this.plugin.settings.reminderMcp.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    this.addTextSetting(
      containerEl,
      "Reminder MCP endpoint name",
      this.plugin.settings.reminderMcp.endpointName,
      async (value) => {
        this.plugin.settings.reminderMcp.endpointName = value;
        await this.plugin.saveSettings();
      }
    );

    this.addTextSetting(containerEl, "Reminder MCP tool name", this.plugin.settings.reminderMcp.toolName, async (value) => {
      this.plugin.settings.reminderMcp.toolName = value;
      await this.plugin.saveSettings();
    });
  }

  private renderBudgetSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Budget & Goals" });

    new Setting(containerEl)
      .setName("Monthly budget")
      .setDesc("Set to 0 to disable budget tracking.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.budget.monthlyBudget))
          .onChange(async (value) => {
            const num = Number.parseFloat(value);
            this.plugin.settings.budget.monthlyBudget = Number.isFinite(num) && num >= 0 ? num : 0;
            await this.plugin.saveSettings();
          })
      );

    this.addTextSetting(containerEl, "Budget currency", this.plugin.settings.budget.currency, async (value) => {
      this.plugin.settings.budget.currency = value;
      await this.plugin.saveSettings();
    });
  }

  private renderReminderScannerSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Reminder Scanner" });

    new Setting(containerEl)
      .setName("Enable reminder scanner")
      .setDesc("Periodically scan reminder files and show notifications for due items.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.reminderScanner.enabled).onChange(async (value) => {
          this.plugin.settings.reminderScanner.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Scan interval (minutes)")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.reminderScanner.intervalMinutes))
          .onChange(async (value) => {
            const num = Number.parseInt(value, 10);
            this.plugin.settings.reminderScanner.intervalMinutes = Number.isFinite(num) && num >= 1 ? num : 5;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Advance notice days")
      .setDesc("Days before subscription expiry to generate a reminder.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.reminderScanner.advanceNoticeDays))
          .onChange(async (value) => {
            const num = Number.parseInt(value, 10);
            this.plugin.settings.reminderScanner.advanceNoticeDays = Number.isFinite(num) && num >= 0 ? num : 3;
            await this.plugin.saveSettings();
          })
      );
  }

  private addApiKeySetting(
    containerEl: HTMLElement,
    name: string,
    value: string,
    onChange: (value: string) => Promise<void>
  ): void {
    new Setting(containerEl).setName(name).addText((text) =>
      text
        .setValue(value)
        .onChange(async (nextValue) => {
          await onChange(nextValue.trim());
        })
        .inputEl.setAttribute("type", "password")
    );
  }

  private addTextSetting(
    containerEl: HTMLElement,
    name: string,
    value: string,
    onChange: (value: string) => Promise<void>
  ): void {
    new Setting(containerEl).setName(name).addText((text) =>
      text.setValue(value).onChange(async (nextValue) => {
        await onChange(nextValue.trim());
      })
    );
  }

  private addSkillToggle(
    containerEl: HTMLElement,
    name: string,
    key: keyof SmartCaptureSettings["skills"]
  ): void {
    new Setting(containerEl)
      .setName(name)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.skills[key]).onChange(async (value) => {
          this.plugin.settings.skills[key] = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
