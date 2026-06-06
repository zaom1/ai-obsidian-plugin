export type SkillType =
  | "accounting"
  | "subscription"
  | "todo"
  | "reminder"
  | "memo"
  | "habit"
  | "quick-note"
  | "contact"
  | "idea";

export type McpTransport = "http" | "sse" | "stdio";

export interface LlmSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  useLlmForParsing: boolean;
}

export interface SttSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  temperature: number;
  prompt: string;
  timeoutMs: number;
}

export interface McpEndpoint {
  name: string;
  transport: McpTransport;
  urlOrCommand: string;
  enabled: boolean;
  authHeader?: string;
}

export interface SkillToggles {
  accounting: boolean;
  subscription: boolean;
  todo: boolean;
  reminder: boolean;
  memo: boolean;
  habit: boolean;
  "quick-note": boolean;
  contact: boolean;
  idea: boolean;
}

export interface ReminderMcpSettings {
  enabled: boolean;
  endpointName: string;
  toolName: string;
}

export interface BudgetSettings {
  monthlyBudget: number;
  currency: string;
  categoryBudgets: Record<string, number>;
}

export interface ReminderScannerSettings {
  enabled: boolean;
  intervalMinutes: number;
  advanceNoticeDays: number;
}

export interface TemplateSettings {
  accounting: string;
  subscription: string;
  todo: string;
  reminder: string;
  memo: string;
  habit: string;
  quickNote: string;
  contact: string;
  idea: string;
}

export interface SmartCaptureSettings {
  llm: LlmSettings;
  stt: SttSettings;
  skills: SkillToggles;
  financeFolder: string;
  subscriptionFile: string;
  taskFile: string;
  reminderFile: string;
  memoFolder: string;
  habitFolder: string;
  quickNoteFolder: string;
  contactFile: string;
  ideaFile: string;
  dailyReviewFolder: string;
  archiveFolder: string;
  mcpEndpoints: McpEndpoint[];
  reminderMcp: ReminderMcpSettings;
  budget: BudgetSettings;
  reminderScanner: ReminderScannerSettings;
  templates: TemplateSettings;
}

export interface ParsedIntent {
  skill: SkillType;
  text: string;
  amount?: number;
  currency?: string;
  transactionType?: "expense" | "income";
  paymentMethod?: string;
  title?: string;
  dueDate?: string;
  cycle?: string;
  vendor?: string;
  tags?: string[];
  category?: string;
  habitName?: string;
  personName?: string;
  pinned?: boolean;
  priority?: "low" | "medium" | "high";
}

export interface SkillResult {
  path: string;
  content: string;
  action: "append" | "prepend";
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface CapturePreview {
  intent: ParsedIntent;
  result: SkillResult;
}
