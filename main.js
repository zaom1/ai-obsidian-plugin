"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/services/llm.ts
var import_obsidian, ALL_SKILLS, LlmParser;
var init_llm = __esm({
  "src/services/llm.ts"() {
    "use strict";
    import_obsidian = require("obsidian");
    ALL_SKILLS = [
      "accounting",
      "subscription",
      "todo",
      "reminder",
      "memo",
      "habit",
      "quick-note",
      "contact",
      "idea"
    ];
    LlmParser = class {
      constructor(settings) {
        this.settings = settings;
        this.lastError = null;
      }
      getLastError() {
        return this.lastError;
      }
      isReady() {
        return this.settings.enabled && this.settings.useLlmForParsing && this.settings.baseUrl.length > 0 && this.settings.apiKey.length > 0 && this.settings.model.length > 0;
      }
      async parse(text) {
        if (!this.isReady()) return null;
        const prompt = this.buildPrompt(text);
        const url = `${this.settings.baseUrl.replace(/\/$/, "")}/chat/completions`;
        try {
          const response = await (0, import_obsidian.requestUrl)({
            url,
            method: "POST",
            throw: false,
            contentType: "application/json",
            headers: {
              Authorization: `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify({
              model: this.settings.model,
              temperature: this.settings.temperature,
              messages: [
                {
                  role: "system",
                  content: "You normalize user notes into JSON for a personal organizer plugin. Return JSON only, no markdown."
                },
                { role: "user", content: prompt }
              ],
              response_format: { type: "json_object" }
            })
          });
          if (response.status < 200 || response.status >= 300) {
            this.lastError = { message: `LLM request failed with status ${response.status}`, status: response.status };
            return null;
          }
          const body = response.json;
          const content = body.choices?.[0]?.message?.content;
          if (!content) {
            this.lastError = { message: "LLM returned empty response" };
            return null;
          }
          try {
            const parsed = JSON.parse(content);
            if (!parsed.skill || !this.isSupportedSkill(parsed.skill)) {
              this.lastError = { message: `Unsupported skill: ${parsed.skill}` };
              return null;
            }
            if (!parsed.text) parsed.text = text;
            if (parsed.amount !== void 0 && typeof parsed.amount !== "number") {
              const num = Number(parsed.amount);
              parsed.amount = Number.isFinite(num) ? num : void 0;
            }
            if (parsed.currency !== void 0 && typeof parsed.currency !== "string") {
              parsed.currency = void 0;
            }
            if (parsed.currency && !/^[A-Z]{3}$/.test(parsed.currency)) {
              parsed.currency = parsed.currency.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || void 0;
            }
            if (parsed.dueDate !== void 0 && typeof parsed.dueDate !== "string") {
              parsed.dueDate = void 0;
            }
            if (parsed.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
              parsed.dueDate = void 0;
            }
            const validCycles = ["daily", "weekly", "monthly", "quarterly", "yearly"];
            if (parsed.cycle !== void 0 && (typeof parsed.cycle !== "string" || !validCycles.includes(parsed.cycle))) {
              parsed.cycle = void 0;
            }
            if (parsed.transactionType !== void 0 && parsed.transactionType !== "expense" && parsed.transactionType !== "income") {
              parsed.transactionType = void 0;
            }
            if (parsed.priority !== void 0 && !["low", "medium", "high"].includes(parsed.priority)) {
              parsed.priority = void 0;
            }
            if (parsed.pinned !== void 0 && typeof parsed.pinned !== "boolean") {
              parsed.pinned = void 0;
            }
            this.lastError = null;
            return parsed;
          } catch {
            this.lastError = { message: "Failed to parse LLM response as JSON" };
            return null;
          }
        } catch (error) {
          this.lastError = { message: error instanceof Error ? error.message : String(error) };
          return null;
        }
      }
      buildPrompt(text) {
        return [
          "Classify and normalize this input into one skill:",
          "  accounting, subscription, todo, reminder, memo, habit, contact, idea.",
          "",
          "Always return JSON with fields:",
          "  skill, text, amount?, currency?, transactionType?, paymentMethod?,",
          "  title?, dueDate?(YYYY-MM-DD), cycle?, vendor?, tags?,",
          "  category?(for accounting: \u9910\u996E/\u4EA4\u901A/\u8D2D\u7269/\u5A31\u4E50/\u5C45\u4F4F/\u533B\u7597/\u6559\u80B2/\u5DE5\u8D44/\u901A\u8BAF/\u793E\u4EA4/\u5176\u4ED6),",
          "  habitName?(for habit), personName?(for contact), pinned?(for idea), priority?(low/medium/high for todo).",
          "",
          "currency must be uppercase ISO code when possible (CNY, USD, EUR, GBP, JPY, HKD).",
          "cycle must be one of daily, weekly, monthly, quarterly, yearly when relevant.",
          "",
          "Input:",
          text
        ].join("\n");
      }
      isSupportedSkill(skill) {
        return ALL_SKILLS.includes(skill);
      }
    };
  }
});

// src/services/render.ts
function createEntryId(prefix, now) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}`;
}
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}
function buildSectionHeading(dateOrMonth) {
  return `## ${dateOrMonth}
`;
}
function buildRecordDocument(options) {
  const parts = [];
  if (options.sectionTitle) {
    parts.push(buildSectionHeading(options.sectionTitle).trimEnd());
  }
  parts.push(buildCalloutBlock(options.calloutType, options.title, options.fields, options.sourceText).trimEnd());
  return `${parts.join("\n\n")}

`;
}
function buildCalloutBlock(type, title, fields, sourceText) {
  const lines = [`> [!${type}] ${title}`];
  for (const field of fields) {
    lines.push(`> - ${field.label}: ${field.value}`);
  }
  if (sourceText && sourceText.trim().length > 0) {
    lines.push(">");
    lines.push("> \u6765\u6E90");
    for (const line of sourceText.trim().split("\n")) {
      lines.push(`> ${line}`);
    }
  }
  return `${lines.join("\n")}

`;
}
function renderTags(tags) {
  if (!tags || tags.length === 0) return "-";
  return tags.map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ");
}
function renderSkillBadge(intent) {
  switch (intent) {
    case "accounting":
      return "\u8D22\u52A1\u8BB0\u5F55";
    case "subscription":
      return "\u8BA2\u9605\u8BB0\u5F55";
    case "todo":
      return "\u5F85\u529E";
    case "reminder":
      return "\u63D0\u9192";
    case "habit":
      return "\u4E60\u60EF\u6253\u5361";
    case "quick-note":
      return "\u5FEB\u901F\u7B14\u8BB0";
    case "contact":
      return "\u8054\u7CFB\u4EBA";
    case "idea":
      return "\u7075\u611F";
    case "memo":
    default:
      return "\u5907\u5FD8";
  }
}
var init_render = __esm({
  "src/services/render.ts"() {
    "use strict";
  }
});

// src/services/nlp.ts
function normalizeIntent(intent, now = /* @__PURE__ */ new Date()) {
  const normalized = { ...intent };
  normalized.amount = normalized.amount ?? extractAmount(normalized.text);
  normalized.currency = normalizeCurrency(normalized.currency ?? detectCurrency(normalized.text));
  normalized.cycle = normalizeCycle(normalized.cycle ?? extractCycle(normalized.text));
  normalized.dueDate = normalizeDate(normalized.dueDate ?? extractNaturalDueDate(normalized.text, now));
  if (normalized.skill === "accounting") {
    normalized.transactionType = inferTransactionType(normalized);
    normalized.paymentMethod = normalized.paymentMethod ?? extractPaymentMethod(normalized.text);
    normalized.title = normalized.title ?? extractShortTitle(normalized.text);
    normalized.category = normalized.category ?? extractCategory(normalized.text);
  }
  if (normalized.skill === "subscription") {
    normalized.vendor = normalized.vendor ?? extractVendor(normalized.text);
    normalized.title = normalized.title ?? normalized.vendor;
    if (!normalized.dueDate && normalized.cycle) {
      normalized.dueDate = inferNextDateFromCycle(normalized.cycle, now);
    }
  }
  if ((normalized.skill === "todo" || normalized.skill === "reminder") && !normalized.dueDate) {
    normalized.dueDate = extractNaturalDueDate(normalized.text, now);
  }
  if (normalized.skill === "habit") {
    normalized.habitName = normalized.habitName ?? extractHabitName(normalized.text);
  }
  if (normalized.skill === "contact") {
    normalized.personName = normalized.personName ?? extractPersonName(normalized.text);
  }
  return normalized;
}
function inferSkillByRules(input, isEnabled) {
  const lowered = input.toLowerCase();
  const candidates = [];
  if (/(记账|花了|支出|收入|rmb|cny|usd|eur|gbp|¥|\$|€|£|消费|报销|账单|spent|expense|income|salary|refund)/i.test(lowered)) {
    candidates.push("accounting");
  }
  if (/(订阅|续费|月费|年费|subscription|renew|netflix|youtube|icloud|apple\s*one|spotify)/i.test(lowered)) {
    candidates.push("subscription");
  }
  if (/(todo|待办|任务|to-do|办事|follow up|next action|todo:)/i.test(lowered)) {
    candidates.push("todo");
  }
  if (/(提醒|remind|截止|deadline|到期|闹钟|提醒我|remember to)/i.test(lowered)) {
    candidates.push("reminder");
  }
  if (/(打卡|习惯|habit|streak|每天.*运动|每天.*阅读|daily check|签到|完成.*打卡)/i.test(lowered)) {
    candidates.push("habit");
  }
  if (/(联系人|见了|联系了|聊了|call with|meeting with|约了|拜访|认识|和张|和李|和王|和赵|和陈|和刘)/i.test(lowered)) {
    candidates.push("contact");
  }
  if (/(想法|灵感|idea|点子|brainstorm|突然想到|灵光一现|脑洞|创意|concept)/i.test(lowered)) {
    candidates.push("idea");
  }
  for (const candidate of candidates) {
    if (isEnabled(candidate)) return candidate;
  }
  return isEnabled("memo") ? "memo" : firstEnabledSkill(isEnabled);
}
function firstEnabledSkill(isEnabled) {
  const keys = ["accounting", "subscription", "todo", "reminder", "habit", "contact", "idea", "memo", "quick-note"];
  for (const key of keys) {
    if (isEnabled(key)) return key;
  }
  return "memo";
}
function extractAmount(text) {
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/(?:^|\s)(\d+(?:\.\d{1,2})?)(?:\s|$)/);
  if (!match) return void 0;
  const amount = Number.parseFloat(match[1]);
  return Number.isFinite(amount) ? amount : void 0;
}
function detectCurrency(text) {
  const symbolMatch = text.match(/[¥$€£￥]/);
  if (symbolMatch) {
    return CURRENCY_SYMBOL_MAP[symbolMatch[0]];
  }
  const codeMatch = text.match(/\b(cny|rmb|usd|eur|gbp|jpy|hkd)\b/i);
  if (!codeMatch) return void 0;
  const code = codeMatch[1].toUpperCase();
  return code === "RMB" ? "CNY" : code;
}
function normalizeCurrency(currency) {
  if (!currency) return void 0;
  const upper = currency.toUpperCase();
  if (upper === "RMB") return "CNY";
  return upper;
}
function extractCycle(text) {
  const lowered = text.toLowerCase();
  if (/(daily|每天|每日)/.test(lowered)) return "daily";
  if (/(weekly|每周|每星期)/.test(lowered)) return "weekly";
  if (/(quarterly|每季|季度)/.test(lowered)) return "quarterly";
  if (/(yearly|annual|每年|年费)/.test(lowered)) return "yearly";
  if (/(monthly|每月|月费)/.test(lowered)) return "monthly";
  return void 0;
}
function normalizeCycle(cycle) {
  if (!cycle) return void 0;
  const lowered = cycle.toLowerCase();
  if (lowered.startsWith("day")) return "daily";
  if (lowered.startsWith("week")) return "weekly";
  if (lowered.startsWith("month")) return "monthly";
  if (lowered.startsWith("quarter")) return "quarterly";
  if (lowered.startsWith("year") || lowered.startsWith("annual")) return "yearly";
  return lowered;
}
function extractNaturalDueDate(text, now = /* @__PURE__ */ new Date()) {
  const lowered = text.toLowerCase();
  if (/(today|今天)/.test(lowered)) return formatDate(now);
  if (/(tomorrow|明天)/.test(lowered)) return formatDate(addDays(now, 1));
  if (/(后天)/.test(lowered)) return formatDate(addDays(now, 2));
  if (/(next week|下周)/.test(lowered)) return formatDate(addDays(now, 7));
  if (/(next month|下个月)/.test(lowered)) return formatDate(addMonths(now, 1));
  const iso = text.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/);
  if (iso) return normalizeDate(iso[1]);
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (slash) {
    const yyyy = now.getFullYear();
    const mm = Number.parseInt(slash[1], 10);
    const dd = Number.parseInt(slash[2], 10);
    const date = new Date(yyyy, mm - 1, dd);
    if (date >= startOfDay(now)) return formatDate(date);
    return formatDate(new Date(yyyy + 1, mm - 1, dd));
  }
  return void 0;
}
function normalizeDate(value) {
  if (!value) return void 0;
  const match = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return value;
  const yyyy = match[1];
  const mm = match[2].padStart(2, "0");
  const dd = match[3].padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function inferNextDateFromCycle(cycle, now) {
  switch (normalizeCycle(cycle)) {
    case "daily":
      return formatDate(addDays(now, 1));
    case "weekly":
      return formatDate(addDays(now, 7));
    case "quarterly":
      return formatDate(addMonths(now, 3));
    case "yearly":
      return formatDate(addMonths(now, 12));
    case "monthly":
    default:
      return formatDate(addMonths(now, 1));
  }
}
function extractPaymentMethod(text) {
  const lowered = text.toLowerCase();
  if (/(wechat|微信)/.test(lowered)) return "wechat";
  if (/(alipay|支付宝)/.test(lowered)) return "alipay";
  if (/(cash|现金)/.test(lowered)) return "cash";
  if (/(visa|master|credit|信用卡)/.test(lowered)) return "card";
  if (/(bank|transfer|转账)/.test(lowered)) return "bank-transfer";
  return void 0;
}
function inferTransactionType(intent) {
  const lowered = intent.text.toLowerCase();
  if (intent.transactionType === "expense" || intent.transactionType === "income") return intent.transactionType;
  if (/(收入|工资|报销到账|refund|income|salary|received|赚了)/i.test(lowered)) {
    return "income";
  }
  return "expense";
}
function extractVendor(text) {
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/subscription|订阅|续费|monthly|yearly|每月|每年/gi, "").replace(/\d+(?:\.\d{1,2})?/g, "").replace(/[¥$€£￥]/g, "").replace(/\b(cny|rmb|usd|eur|gbp|jpy|hkd)\b/gi, "").trim();
  return cleaned.length > 0 ? cleaned : void 0;
}
function extractShortTitle(text) {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}
function extractCategory(text) {
  for (const [category, pattern] of Object.entries(ACCOUNTING_CATEGORIES)) {
    if (pattern.test(text)) return category;
  }
  return void 0;
}
function extractHabitName(text) {
  const cleaned = text.replace(/打卡|习惯|habit|签到|完成|做了|today|今天|每日|每天/gi, "").replace(/[！!。.，,、]/g, "").trim();
  return cleaned.length > 0 && cleaned.length <= 20 ? cleaned : void 0;
}
function extractPersonName(text) {
  const cnMatch = text.match(/(?:和|跟|见了|找了|约了|拜访了?|联系了?|认识了?|@)([\u4e00-\u9fa5]{2,4})/);
  if (cnMatch) return cnMatch[1];
  const enMatch = text.match(/(?:call|meeting|chat)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (enMatch) return enMatch[1];
  const atMatch = text.match(/@(\S{2,20})/);
  if (atMatch) return atMatch[1];
  return void 0;
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function addMonths(date, months) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}
var CURRENCY_SYMBOL_MAP, ACCOUNTING_CATEGORIES;
var init_nlp = __esm({
  "src/services/nlp.ts"() {
    "use strict";
    init_render();
    CURRENCY_SYMBOL_MAP = {
      "\xA5": "CNY",
      "$": "USD",
      "\u20AC": "EUR",
      "\xA3": "GBP",
      "\uFFE5": "CNY"
    };
    ACCOUNTING_CATEGORIES = {
      "\u9910\u996E": /吃饭|午餐|晚餐|早餐|外卖|饭|餐|奶茶|咖啡|美团|饿了么|火锅|烧烤|快餐|饮料|水果|零食|夜宵|小吃|面馆|饭店|餐厅|早饭|午饭|晚饭/i,
      "\u4EA4\u901A": /打车|地铁|公交|滴滴|加油|停车|高铁|火车|机票|飞机|出租车|共享单车|骑行|高速|过路费|洗车|保养|维修|uber|taxi/i,
      "\u8D2D\u7269": /淘宝|京东|购物|衣服|鞋|包|超市|日用|拼多多|天猫|商城|百货|服装|裤子|帽子|外套|裙子|化妆品|护肤/i,
      "\u5A31\u4E50": /电影|游戏|KTV|旅游|门票|演出|剧本杀|密室|演唱会|音乐节|展览|网吧|电竞|充值/i,
      "\u5C45\u4F4F": /房租|水电|物业|燃气|暖气|房贷|装修|家具|家电|维修|宽带|网费/i,
      "\u533B\u7597": /医院|药|体检|看病|挂号|门诊|手术|牙科|眼科|配镜|保险|医疗/i,
      "\u6559\u80B2": /书|课程|培训|学费|考试|报名|教材|网课|会员|学习/i,
      "\u5DE5\u8D44": /工资|薪资|奖金|年终奖|绩效|提成|补贴|报销到账|income|salary|refund/i,
      "\u901A\u8BAF": /话费|流量|手机|充值|月租|宽带费/i,
      "\u793E\u4EA4": /红包|份子钱|礼物|送礼|请客|聚餐|AA/i
    };
  }
});

// src/router.ts
var router_exports = {};
__export(router_exports, {
  IntentRouter: () => IntentRouter
});
var IntentRouter;
var init_router = __esm({
  "src/router.ts"() {
    "use strict";
    init_llm();
    init_nlp();
    IntentRouter = class {
      constructor(settings) {
        this.settings = settings;
        this.llmParser = new LlmParser(settings.llm);
      }
      async route(rawInput, now = /* @__PURE__ */ new Date()) {
        const input = rawInput.trim();
        if (input.length === 0) {
          return { skill: "memo", text: "" };
        }
        const llmIntent = await this.llmParser.parse(input);
        if (llmIntent && this.isEnabled(llmIntent.skill)) {
          return normalizeIntent(llmIntent, now);
        }
        const fallbackSkill = this.ruleBasedSkill(input);
        return normalizeIntent({
          skill: fallbackSkill,
          text: input
        }, now);
      }
      ruleBasedSkill(input) {
        return inferSkillByRules(input, (skill) => this.isEnabled(skill));
      }
      isEnabled(skill) {
        return this.settings.skills[skill];
      }
    };
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SmartCapturePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian17 = require("obsidian");
init_router();

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  llm: {
    enabled: false,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.1,
    timeoutMs: 3e4,
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
    timeoutMs: 45e3
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
var SmartCaptureSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
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
  renderCollapsibleGroup(containerEl, title, render, defaultOpen = false) {
    const details = containerEl.createEl("details", {
      cls: "sch-settings-group",
      attr: defaultOpen ? { open: "" } : {}
    });
    const summary = details.createEl("summary");
    summary.createEl("h3", { text: title });
    const content = details.createDiv();
    render(content);
  }
  renderLlmSettings(containerEl) {
    containerEl.createEl("h3", { text: "LLM Parsing" });
    new import_obsidian2.Setting(containerEl).setName("Enable LLM").setDesc("Use external LLM for intent parsing and normalization.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.llm.enabled).onChange(async (value) => {
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
    new import_obsidian2.Setting(containerEl).setName("Auto detect LLM model").setDesc("Fetch /models using current LLM base URL + API key, then fill model automatically.").addButton(
      (button) => button.setButtonText("Fetch + Fill").onClick(async () => {
        button.setDisabled(true);
        try {
          const model = await this.plugin.autoFillLlmModel();
          new import_obsidian2.Notice(`LLM model set to: ${model}`);
          this.display();
        } catch (error) {
          new import_obsidian2.Notice(error instanceof Error ? error.message : String(error));
        } finally {
          button.setDisabled(false);
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Use LLM for parsing").setDesc("If disabled, parser falls back to local rule-based routing only.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.llm.useLlmForParsing).onChange(async (value) => {
        this.plugin.settings.llm.useLlmForParsing = value;
        await this.plugin.saveSettings();
      })
    );
  }
  renderSttSettings(containerEl) {
    containerEl.createEl("h3", { text: "Voice Transcription (STT)" });
    new import_obsidian2.Setting(containerEl).setName("Enable STT").setDesc("Used by the Record button in Smart Capture modal.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.stt.enabled).onChange(async (value) => {
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
    new import_obsidian2.Setting(containerEl).setName("Auto detect STT model").setDesc("Fetch /models using current STT base URL + API key, then fill model automatically.").addButton(
      (button) => button.setButtonText("Fetch + Fill").onClick(async () => {
        button.setDisabled(true);
        try {
          const model = await this.plugin.autoFillSttModel();
          new import_obsidian2.Notice(`STT model set to: ${model}`);
          this.display();
        } catch (error) {
          new import_obsidian2.Notice(error instanceof Error ? error.message : String(error));
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
  renderStorageSettings(containerEl) {
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
  renderSkillSettings(containerEl) {
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
  renderMcpEndpoints(containerEl) {
    const endpointsContainer = containerEl.createDiv({ cls: "sch-mcp-endpoints" });
    const renderEndpoint = (endpoint, idx) => {
      const row = endpointsContainer.createDiv({ cls: "sch-mcp-row" });
      new import_obsidian2.Setting(row).setName(`Endpoint ${idx + 1}: ${endpoint.name}`).setDesc(`${endpoint.transport.toUpperCase()} | ${endpoint.urlOrCommand || "(not configured)"}`).addToggle(
        (toggle) => toggle.setValue(endpoint.enabled).onChange(async (value) => {
          endpoint.enabled = value;
          await this.plugin.saveSettings();
          row.empty();
          renderEndpoint(endpoint, idx);
        })
      ).addDropdown(
        (drop) => drop.addOption("http", "http").addOption("sse", "sse").addOption("stdio", "stdio").setValue(endpoint.transport).onChange(async (value) => {
          endpoint.transport = value;
          await this.plugin.saveSettings();
          row.empty();
          renderEndpoint(endpoint, idx);
        })
      ).addText(
        (text) => text.setPlaceholder("name").setValue(endpoint.name).onChange(async (value) => {
          endpoint.name = value.trim() || endpoint.name;
          await this.plugin.saveSettings();
        })
      ).addText(
        (text) => text.setPlaceholder("url or command").setValue(endpoint.urlOrCommand).onChange(async (value) => {
          endpoint.urlOrCommand = value.trim();
          await this.plugin.saveSettings();
        })
      ).addText(
        (text) => text.setPlaceholder("auth header").setValue(endpoint.authHeader ?? "").onChange(async (value) => {
          endpoint.authHeader = value.trim();
          await this.plugin.saveSettings();
        })
      );
    };
    for (let idx = 0; idx < this.plugin.settings.mcpEndpoints.length; idx++) {
      renderEndpoint(this.plugin.settings.mcpEndpoints[idx], idx);
    }
  }
  renderReminderMcpSettings(containerEl) {
    containerEl.createEl("h3", { text: "Reminder MCP Automation" });
    new import_obsidian2.Setting(containerEl).setName("Enable reminder auto sync").setDesc("After writing reminder note, call MCP tool automatically.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.reminderMcp.enabled).onChange(async (value) => {
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
  renderBudgetSettings(containerEl) {
    containerEl.createEl("h3", { text: "Budget & Goals" });
    new import_obsidian2.Setting(containerEl).setName("Monthly budget").setDesc("Set to 0 to disable budget tracking.").addText(
      (text) => text.setValue(String(this.plugin.settings.budget.monthlyBudget)).onChange(async (value) => {
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
  renderReminderScannerSettings(containerEl) {
    containerEl.createEl("h3", { text: "Reminder Scanner" });
    new import_obsidian2.Setting(containerEl).setName("Enable reminder scanner").setDesc("Periodically scan reminder files and show notifications for due items.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.reminderScanner.enabled).onChange(async (value) => {
        this.plugin.settings.reminderScanner.enabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Scan interval (minutes)").addText(
      (text) => text.setValue(String(this.plugin.settings.reminderScanner.intervalMinutes)).onChange(async (value) => {
        const num = Number.parseInt(value, 10);
        this.plugin.settings.reminderScanner.intervalMinutes = Number.isFinite(num) && num >= 1 ? num : 5;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Advance notice days").setDesc("Days before subscription expiry to generate a reminder.").addText(
      (text) => text.setValue(String(this.plugin.settings.reminderScanner.advanceNoticeDays)).onChange(async (value) => {
        const num = Number.parseInt(value, 10);
        this.plugin.settings.reminderScanner.advanceNoticeDays = Number.isFinite(num) && num >= 0 ? num : 3;
        await this.plugin.saveSettings();
      })
    );
  }
  addApiKeySetting(containerEl, name, value, onChange) {
    new import_obsidian2.Setting(containerEl).setName(name).addText(
      (text) => text.setValue(value).onChange(async (nextValue) => {
        await onChange(nextValue.trim());
      }).inputEl.setAttribute("type", "password")
    );
  }
  addTextSetting(containerEl, name, value, onChange) {
    new import_obsidian2.Setting(containerEl).setName(name).addText(
      (text) => text.setValue(value).onChange(async (nextValue) => {
        await onChange(nextValue.trim());
      })
    );
  }
  addSkillToggle(containerEl, name, key) {
    new import_obsidian2.Setting(containerEl).setName(name).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.skills[key]).onChange(async (value) => {
        this.plugin.settings.skills[key] = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/services/finance-summary.ts
var import_obsidian4 = require("obsidian");

// src/services/budget-service.ts
var import_obsidian3 = require("obsidian");

// src/services/finance-summary.ts
var START = "<!-- SCH_FINANCE_SUMMARY_START -->";
var END = "<!-- SCH_FINANCE_SUMMARY_END -->";
async function updateFinanceSummary(vault, path) {
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof import_obsidian4.TFile)) return;
  const content = await vault.read(abstractFile);
  const totals = parseTotals(content);
  const summary = buildSummaryBlock(totals);
  const nextContent = replaceOrInsertSummary(content, summary);
  if (nextContent !== content) {
    await vault.modify(abstractFile, nextContent);
  }
}
function parseTotals(content) {
  const totals = {
    expense: 0,
    income: 0,
    entries: 0,
    currencies: /* @__PURE__ */ new Set(),
    categoryTotals: /* @__PURE__ */ new Map(),
    dailyTotals: /* @__PURE__ */ new Map()
  };
  const lines = content.split("\n");
  let entry = null;
  const commitEntry = () => {
    if (!entry || !entry.type || entry.amount === void 0 || !Number.isFinite(entry.amount)) {
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
function isEntryBoundary(line) {
  return /^\s*-\s+\[/.test(line) || /^\s*>\s+\[!/.test(line);
}
function parseEntryType(line) {
  const type = parseTypeToken(line);
  return type ? { type } : {};
}
function parseEntryTypeFromField(line) {
  const match = line.match(/^\s*(?:>\s*)?-\s*(分类|类型|交易类型):\s*(expense|income|收入|支出)\s*$/i);
  if (match) {
    const value = match[2].toLowerCase();
    return value === "income" || value === "\u6536\u5165" ? "income" : "expense";
  }
  return void 0;
}
function parseTypeToken(line) {
  const lowered = line.toLowerCase();
  if (/\[(expense|income)\/[^\]]+\]/.test(lowered)) {
    const match = lowered.match(/\[(expense|income)\//);
    return match ? match[1] : void 0;
  }
  if (/^\s*>\s+\[![^\]]+\]\s+(expense|income)\b/.test(lowered)) {
    const match = lowered.match(/^\s*>\s+\[![^\]]+\]\s+(expense|income)\b/);
    return match ? match[1] : void 0;
  }
  if (/^\s*>\s+\[![^\]]+\]\s+(收入|支出)\b/.test(line)) {
    const match = line.match(/^\s*>\s+\[![^\]]+\]\s+(收入|支出)\b/);
    return match ? match[1] === "\u6536\u5165" ? "income" : "expense" : void 0;
  }
  if (/^\s*-\s+\[(收入|支出)\//.test(line)) {
    const match = line.match(/^\s*-\s+\[(收入|支出)\//);
    return match ? match[1] === "\u6536\u5165" ? "income" : "expense" : void 0;
  }
  return void 0;
}
function buildSummaryBlock(totals) {
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
function replaceOrInsertSummary(content, summary) {
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

// src/services/mcp.ts
var import_obsidian5 = require("obsidian");
var McpService = class {
  constructor(endpoints) {
    this.endpoints = endpoints;
    this.id = 1;
    this.sseSessions = /* @__PURE__ */ new Map();
    this.initialized = /* @__PURE__ */ new Set();
  }
  getEnabledEndpoints() {
    return this.endpoints.filter((e) => e.enabled && e.urlOrCommand.trim().length > 0);
  }
  async pingEndpoint(endpoint) {
    try {
      if (endpoint.transport === "stdio") {
        if (!import_obsidian5.Platform.isDesktopApp) return false;
        await this.listTools(endpoint);
        return true;
      }
      const response = await (0, import_obsidian5.requestUrl)({
        url: endpoint.urlOrCommand,
        method: "GET",
        throw: false
      });
      return response.status >= 200 && response.status < 500;
    } catch {
      return false;
    }
  }
  async listTools(endpoint) {
    if (endpoint.transport === "stdio") {
      const result = await runStdioMcpCommand(endpoint.urlOrCommand, "tools/list", {});
      return toTools(result);
    }
    await this.ensureInitialized(endpoint);
    const response = await this.sendRpc(endpoint, "tools/list", {});
    return toTools(response?.result);
  }
  async callTool(endpoint, toolName, args) {
    if (endpoint.transport === "stdio") {
      const result = await runStdioMcpCommand(endpoint.urlOrCommand, "tools/call", {
        name: toolName,
        arguments: args
      });
      return stringifyToolResult(result);
    }
    await this.ensureInitialized(endpoint);
    const response = await this.sendRpc(endpoint, "tools/call", {
      name: toolName,
      arguments: args
    });
    return stringifyToolResult(response?.result);
  }
  async ensureInitialized(endpoint) {
    const key = endpointKey(endpoint);
    if (this.initialized.has(key)) return;
    try {
      await this.sendRpc(endpoint, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "intent-inbox", version: "0.1.0" }
      });
      await this.sendRpc(endpoint, "notifications/initialized", {}, false);
      this.initialized.add(key);
    } catch (error) {
      this.initialized.delete(key);
      throw error;
    }
  }
  async sendRpc(endpoint, method, params, expectResponse = true) {
    const request = {
      jsonrpc: "2.0",
      method,
      params
    };
    if (expectResponse) {
      request.id = this.id++;
    }
    if (endpoint.transport === "http") {
      return postJsonObsidian(endpoint.urlOrCommand, request, expectResponse, endpoint.authHeader);
    }
    const session = await this.getOrCreateSseSession(endpoint);
    return postJsonObsidian(session.postUrl, request, expectResponse, endpoint.authHeader);
  }
  async getOrCreateSseSession(endpoint) {
    const key = endpointKey(endpoint);
    const existing = this.sseSessions.get(key);
    if (existing) return existing;
    const session = await createSseSession(endpoint.urlOrCommand, endpoint.authHeader);
    this.sseSessions.set(key, session);
    return session;
  }
  dispose() {
    for (const session of this.sseSessions.values()) {
      session.controller?.abort();
    }
    this.sseSessions.clear();
    this.initialized.clear();
  }
};
function endpointKey(endpoint) {
  return `${endpoint.transport}:${endpoint.name}:${endpoint.urlOrCommand}`;
}
async function postJsonObsidian(url, body, expectResponse, authHeader) {
  const headers = {};
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  if (!expectResponse) {
    await (0, import_obsidian5.requestUrl)({
      url,
      method: "POST",
      contentType: "application/json",
      headers,
      body: JSON.stringify(body),
      throw: false
    });
    return null;
  }
  const response = await (0, import_obsidian5.requestUrl)({
    url,
    method: "POST",
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`MCP request failed: ${response.status}`);
  }
  return response.json;
}
async function createSseSession(sseUrl, authHeader) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1e4);
  const headers = { Accept: "text/event-stream" };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  try {
    const response = await fetch(sseUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`SSE handshake failed: ${response.status}`);
    }
    if (!response.body) {
      return { postUrl: sseUrl, controller };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/event:\s*endpoint\s*\ndata:\s*([^\n\r]+)/i);
      if (match) {
        const endpointPath = match[1].trim();
        const postUrl = endpointPath.startsWith("http") ? endpointPath : new URL(endpointPath, sseUrl).toString();
        return { postUrl, controller };
      }
      if (buffer.length > 16e3) {
        break;
      }
    }
    return { postUrl: sseUrl, controller };
  } finally {
    window.clearTimeout(timer);
  }
}
function toTools(result) {
  if (!result || typeof result !== "object") return [];
  const tools = result.tools;
  if (!Array.isArray(tools)) return [];
  return tools.filter((item) => typeof item === "object" && item !== null && "name" in item).map((item) => ({
    name: String(item.name),
    description: typeof item.description === "string" ? item.description : void 0,
    inputSchema: item.inputSchema
  }));
}
function stringifyToolResult(result) {
  if (!result || typeof result !== "object") {
    return JSON.stringify(result);
  }
  const content = result.content;
  if (!Array.isArray(content)) {
    return JSON.stringify(result, null, 2);
  }
  const chunks = content.map((item) => {
    if (!item || typeof item !== "object") return JSON.stringify(item);
    if (typeof item.text === "string") {
      return item.text;
    }
    return JSON.stringify(item);
  });
  return chunks.join("\n");
}
async function runStdioMcpCommand(command, method, params) {
  if (!import_obsidian5.Platform.isDesktopApp) {
    throw new Error("stdio MCP is only available on desktop.");
  }
  const { spawn } = await import("node:child_process");
  const [executable, ...args] = command.split(/\s+/).filter(Boolean);
  if (!executable) {
    throw new Error("MCP stdio command is empty.");
  }
  const child = spawn(executable, args, {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const parser = new StdioMessageParser();
  const pending = /* @__PURE__ */ new Map();
  let nextId = 1;
  child.stdout.on("data", (chunk) => {
    const messages = parser.push(chunk);
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      const id = message.id;
      if (typeof id !== "number") continue;
      const slot = pending.get(id);
      if (!slot) continue;
      pending.delete(id);
      slot.resolve(message);
    }
  });
  child.stderr.on("data", () => {
  });
  child.on("exit", (code) => {
    for (const slot of pending.values()) {
      slot.reject(new Error(`MCP stdio process exited: ${code ?? "unknown"}`));
    }
    pending.clear();
  });
  const sendRequest = async (rpcMethod, rpcParams) => {
    const id = nextId++;
    const req = {
      jsonrpc: "2.0",
      id,
      method: rpcMethod,
      params: rpcParams
    };
    writeStdioMessage(child.stdin, req);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      window.setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`MCP stdio timeout for method: ${rpcMethod}`));
        }
      }, 15e3);
    });
  };
  const sendNotification = (rpcMethod, rpcParams) => {
    const req = {
      jsonrpc: "2.0",
      method: rpcMethod,
      params: rpcParams
    };
    writeStdioMessage(child.stdin, req);
  };
  try {
    await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "intent-inbox", version: "0.1.0" }
    });
    sendNotification("notifications/initialized", {});
    const response = await sendRequest(method, params);
    if (response.error) {
      throw new Error(`MCP error ${response.error.code}: ${response.error.message}`);
    }
    return response.result;
  } finally {
    child.kill();
  }
}
var StdioMessageParser = class {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages = [];
    while (true) {
      const headerEnd = this.findHeaderEnd(this.buffer);
      if (headerEnd < 0) break;
      const headerText = this.buffer.slice(0, headerEnd).toString("utf8");
      const contentLength = this.extractContentLength(headerText);
      if (contentLength < 0) break;
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + contentLength) break;
      const body = this.buffer.slice(bodyStart, bodyStart + contentLength).toString("utf8");
      this.buffer = this.buffer.slice(bodyStart + contentLength);
      try {
        messages.push(JSON.parse(body));
      } catch {
      }
    }
    return messages;
  }
  findHeaderEnd(buffer) {
    for (let i = 0; i < buffer.length - 3; i++) {
      if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) {
        return i;
      }
    }
    return -1;
  }
  extractContentLength(headerText) {
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) return -1;
    return Number.parseInt(match[1], 10);
  }
};
function writeStdioMessage(stream, payload) {
  const content = JSON.stringify(payload);
  const bytes = Buffer.byteLength(content, "utf8");
  const message = `Content-Length: ${bytes}\r
\r
${content}`;
  stream.write(message);
}

// src/services/reminder-scanner.ts
var import_obsidian6 = require("obsidian");
var NOTIFIED_IDS = /* @__PURE__ */ new Set();
function scanReminders(vault, reminderFile) {
  const path = (0, import_obsidian6.normalizePath)(reminderFile);
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof import_obsidian6.TFile)) return;
  vault.read(abstractFile).then((content) => {
    const entries = parseReminderEntries(content);
    const now = /* @__PURE__ */ new Date();
    for (const entry of entries) {
      if (entry.status !== "scheduled") continue;
      if (NOTIFIED_IDS.has(entry.entryId)) continue;
      const due = parseDueDateTime(entry.dueDate);
      if (!due) continue;
      if (now >= due) {
        NOTIFIED_IDS.add(entry.entryId);
        new import_obsidian6.Notice(`\u23F0 \u63D0\u9192: ${entry.title}`, 1e4);
      }
    }
  }).catch(() => {
  });
}
function parseReminderEntries(content) {
  const entries = [];
  const lines = content.split("\n");
  let current = null;
  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      if (current?.entryId) entries.push(current);
      const titleMatch = line.match(/\|\s*(.+)$/);
      current = { title: titleMatch?.[1]?.trim() ?? "unknown" };
      continue;
    }
    if (!current) continue;
    const idMatch = line.match(/^\s*>\s*-\s*编号:\s*(.+)$/);
    if (idMatch) {
      current.entryId = idMatch[1].trim();
      continue;
    }
    const statusMatch = line.match(/^\s*>\s*-\s*状态:\s*(.+)$/);
    if (statusMatch) {
      current.status = statusMatch[1].trim();
      continue;
    }
    const dateMatch = line.match(/^\s*>\s*-\s*时间:\s*(.+)$/);
    if (dateMatch) {
      current.dueDate = dateMatch[1].trim();
      continue;
    }
  }
  if (current?.entryId) entries.push(current);
  return entries;
}
function parseDueDateTime(value) {
  if (!value || value === "unspecified") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// src/services/subscription-watcher.ts
var import_obsidian8 = require("obsidian");
init_render();

// src/services/vault-writer.ts
var import_obsidian7 = require("obsidian");
var writeLocks = /* @__PURE__ */ new Map();
function withFileLock(path, fn) {
  const existing = writeLocks.get(path) ?? Promise.resolve();
  const next = existing.then(fn, fn);
  const tracked = next.finally(() => {
    if (writeLocks.get(path) === next) {
      writeLocks.delete(path);
    }
  });
  writeLocks.set(path, next);
  return tracked;
}
async function appendToVaultFile(vault, path, content) {
  const normalizedPath = (0, import_obsidian7.normalizePath)(path);
  await ensureParentFolder(vault, normalizedPath);
  return withFileLock(normalizedPath, async () => {
    const file = vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof import_obsidian7.TFile) {
      await vault.append(file, content);
    } else {
      await vault.create(normalizedPath, content);
    }
  });
}
async function prependToVaultFile(vault, path, content) {
  const normalizedPath = (0, import_obsidian7.normalizePath)(path);
  await ensureParentFolder(vault, normalizedPath);
  return withFileLock(normalizedPath, async () => {
    const file = vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof import_obsidian7.TFile) {
      const current = await vault.read(file);
      await vault.modify(file, `${content}${current}`);
    } else {
      await vault.create(normalizedPath, content);
    }
  });
}
async function ensureParentFolder(vault, path) {
  const parts = path.split("/");
  parts.pop();
  if (parts.length === 0) return;
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      await vault.createFolder(current);
    }
  }
}

// src/services/subscription-watcher.ts
var NOTIFIED_SUBSCRIPTIONS = /* @__PURE__ */ new Set();
async function checkSubscriptionExpiry(vault, subscriptionFile, reminderFile, advanceNoticeDays, now = /* @__PURE__ */ new Date()) {
  const path = (0, import_obsidian8.normalizePath)(subscriptionFile);
  const abstractFile = vault.getAbstractFileByPath(path);
  if (!(abstractFile instanceof import_obsidian8.TFile)) return;
  const content = await vault.read(abstractFile);
  const entries = parseSubscriptionEntries(content);
  for (const entry of entries) {
    const key = `${entry.vendor}:${entry.dueDate}`;
    if (NOTIFIED_SUBSCRIPTIONS.has(key)) continue;
    const due = new Date(entry.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= advanceNoticeDays) {
      NOTIFIED_SUBSCRIPTIONS.add(key);
      const entryId = createEntryId("rem", now);
      const reminderContent = [
        `> [!warning] \u63D0\u9192 | \u8BA2\u9605\u5373\u5C06\u5230\u671F: ${entry.vendor}`,
        `> - \u7F16\u53F7: ${entryId}`,
        `> - \u72B6\u6001: scheduled`,
        `> - \u65F6\u95F4: ${formatDate(due)}`,
        `>`,
        `> \u6765\u6E90`,
        `> \u8BA2\u9605 ${entry.vendor} (${entry.amount}) \u5C06\u4E8E ${formatDate(due)} \u5230\u671F`,
        "",
        ""
      ].join("\n");
      await appendToVaultFile(vault, reminderFile, reminderContent);
    }
  }
}
function parseSubscriptionEntries(content) {
  const entries = [];
  const lines = content.split("\n");
  let current = null;
  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      if (current?.vendor && current?.dueDate) entries.push(current);
      const titleMatch = line.match(/\|\s*(.+)$/);
      current = { vendor: titleMatch?.[1]?.trim() ?? "unknown" };
      continue;
    }
    if (!current) continue;
    const dueMatch = line.match(/^\s*>\s*-\s*下次到期:\s*(.+)$/);
    if (dueMatch) {
      current.dueDate = dueMatch[1].trim();
      continue;
    }
    const amountMatch = line.match(/^\s*>\s*-\s*金额:\s*(.+)$/);
    if (amountMatch) {
      current.amount = amountMatch[1].trim();
      continue;
    }
  }
  if (current?.vendor && current?.dueDate) entries.push(current);
  return entries;
}

// src/services/undo-service.ts
var import_obsidian9 = require("obsidian");
var MAX_UNDO_DEPTH = 20;
var UndoService = class {
  constructor() {
    this.undoStack = [];
  }
  async push(vault, path) {
    const normalizedPath = (0, import_obsidian9.normalizePath)(path);
    const file = vault.getAbstractFileByPath(normalizedPath);
    let previousContent = null;
    if (file instanceof import_obsidian9.TFile) {
      previousContent = await vault.read(file);
    }
    this.undoStack.push({ path: normalizedPath, previousContent });
    if (this.undoStack.length > MAX_UNDO_DEPTH) {
      this.undoStack.shift();
    }
  }
  async undo(vault) {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    const file = vault.getAbstractFileByPath(entry.path);
    if (entry.previousContent === null) {
      if (file instanceof import_obsidian9.TFile) {
        await vault.delete(file);
      }
      return `Deleted ${entry.path}`;
    }
    if (file instanceof import_obsidian9.TFile) {
      await vault.modify(file, entry.previousContent);
    } else {
      await vault.create(entry.path, entry.previousContent);
    }
    return `Restored ${entry.path}`;
  }
  canUndo() {
    return this.undoStack.length > 0;
  }
};

// src/services/transcription.ts
var SttTranscriber = class {
  constructor(settings) {
    this.settings = settings;
  }
  isReady() {
    return this.settings.enabled && this.settings.baseUrl.trim().length > 0 && this.settings.apiKey.trim().length > 0 && this.settings.model.trim().length > 0;
  }
  async transcribeAudio(blob, filename = "speech.webm") {
    if (!this.isReady()) {
      throw new Error("STT is not configured.");
    }
    const endpoint = `${this.settings.baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("model", this.settings.model);
    if (this.settings.language) {
      formData.append("language", this.settings.language);
    }
    if (Number.isFinite(this.settings.temperature)) {
      formData.append("temperature", String(this.settings.temperature));
    }
    if (this.settings.prompt) {
      formData.append("prompt", this.settings.prompt);
    }
    const controller = new AbortController();
    const timeoutMs = Math.max(5e3, this.settings.timeoutMs);
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }
      const payload = await response.json();
      const text = payload.text?.trim();
      if (!text) {
        throw new Error("Transcription result is empty.");
      }
      return text;
    } finally {
      window.clearTimeout(timer);
    }
  }
};

// src/skills/accounting.ts
init_nlp();
init_render();
var AccountingSkill = class {
  constructor() {
    this.id = "accounting";
  }
  execute(intent, context) {
    const month = formatMonth(context.now);
    const path = `${context.settings.financeFolder}/${month}.md`;
    const entryId = createEntryId("fin", context.now);
    const amount = intent.amount ?? extractAmount(intent.text) ?? 0;
    const currency = normalizeCurrency(intent.currency) ?? "CNY";
    const method = intent.paymentMethod ?? "unspecified";
    const type = inferTransactionType(intent);
    const title = intent.title ?? intent.text;
    const category = intent.category ?? extractCategory(intent.text) ?? "\u5176\u4ED6";
    return {
      path,
      action: "append",
      content: buildRecordDocument({
        sectionTitle: formatDate(context.now),
        calloutType: type === "income" ? "tip" : "abstract",
        title: `${type === "income" ? "\u6536\u5165" : "\u652F\u51FA"} | ${title}`,
        fields: [
          { label: "\u7F16\u53F7", value: entryId },
          { label: "\u72B6\u6001", value: "logged" },
          { label: "\u8BB0\u5F55\u65F6\u95F4", value: formatDateTime(context.now) },
          { label: "\u4EA4\u6613\u7C7B\u578B", value: type },
          { label: "\u6D88\u8D39\u5206\u7C7B", value: category },
          { label: "\u91D1\u989D", value: `${amount.toFixed(2)} ${currency}` },
          { label: "\u652F\u4ED8\u65B9\u5F0F", value: method }
        ],
        sourceText: intent.text
      }),
      summary: `${type} entry saved to ${path}`
    };
  }
};
function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// src/skills/contact.ts
init_nlp();
init_render();
var ContactSkill = class {
  constructor() {
    this.id = "contact";
  }
  execute(intent, context) {
    const path = context.settings.contactFile;
    const personName = intent.personName ?? intent.title ?? extractPersonName(intent.text) ?? "unknown";
    const entryId = createEntryId("con", context.now);
    return {
      path,
      action: "append",
      content: buildRecordDocument({
        calloutType: "info",
        title: `\u8054\u7CFB\u4EBA | ${personName}`,
        fields: [
          { label: "\u7F16\u53F7", value: entryId },
          { label: "\u8BB0\u5F55\u65F6\u95F4", value: formatDateTime(context.now) },
          { label: "\u6807\u7B7E", value: renderTags(intent.tags) }
        ],
        sourceText: intent.text
      }),
      summary: `contact note saved to ${path}`,
      metadata: { personName }
    };
  }
};

// src/skills/habit.ts
init_nlp();
init_render();
var HabitSkill = class {
  constructor() {
    this.id = "habit";
  }
  execute(intent, context) {
    const month = formatMonth2(context.now);
    const path = `${context.settings.habitFolder}/${month}.md`;
    const habitName = intent.habitName ?? intent.title ?? extractHabitName(intent.text) ?? "habit";
    const entryId = createEntryId("hab", context.now);
    return {
      path,
      action: "append",
      content: buildRecordDocument({
        sectionTitle: formatDate(context.now),
        calloutType: "success",
        title: `\u4E60\u60EF\u6253\u5361 | ${habitName}`,
        fields: [
          { label: "\u7F16\u53F7", value: entryId },
          { label: "\u65E5\u671F", value: formatDate(context.now) },
          { label: "\u4E60\u60EF", value: habitName },
          { label: "\u6807\u7B7E", value: "#habit" }
        ],
        sourceText: intent.text
      }),
      summary: `habit "${habitName}" logged to ${path}`,
      metadata: { habitName }
    };
  }
};
function formatMonth2(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// src/skills/idea.ts
init_render();
var IdeaSkill = class {
  constructor() {
    this.id = "idea";
  }
  execute(intent, context) {
    const path = context.settings.ideaFile;
    const pinned = intent.pinned ?? false;
    const title = intent.title ?? intent.text;
    const entryId = createEntryId("ide", context.now);
    return {
      path,
      action: pinned ? "prepend" : "append",
      content: buildRecordDocument({
        calloutType: "quote",
        title: `\u7075\u611F | ${title}`,
        fields: [
          { label: "\u7F16\u53F7", value: entryId },
          { label: "\u65F6\u95F4", value: formatDateTime(context.now) },
          { label: "\u7F6E\u9876", value: pinned ? "\u662F" : "\u5426" },
          { label: "\u6807\u7B7E", value: renderTags(intent.tags) }
        ],
        sourceText: intent.text
      }),
      summary: `idea ${pinned ? "(pinned) " : ""}saved to ${path}`,
      metadata: { pinned }
    };
  }
};

// src/skills/memo.ts
init_render();
var MemoSkill = class {
  constructor() {
    this.id = "memo";
  }
  execute(intent, context) {
    const date = formatDate(context.now);
    const path = `${context.settings.memoFolder}/${date}.md`;
    return {
      path,
      action: "append",
      content: buildRecordDocument({
        sectionTitle: date,
        calloutType: "note",
        title: `\u5907\u5FD8 | ${formatTime(context.now)}`,
        fields: [
          { label: "\u72B6\u6001", value: "captured" },
          { label: "\u65F6\u95F4", value: formatTime(context.now) }
        ],
        sourceText: intent.text
      }),
      summary: `memo appended to ${path}`
    };
  }
};

// src/skills/quick-note.ts
init_render();
var QuickNoteSkill = class {
  constructor() {
    this.id = "quick-note";
  }
  execute(intent, context) {
    const date = formatDate(context.now);
    const time = formatTime(context.now);
    const path = `${context.settings.quickNoteFolder}/${date}.md`;
    return {
      path,
      action: "append",
      content: `### ${time}
${intent.text}

`,
      summary: `quick note appended to ${path}`
    };
  }
};

// src/skills/reminder.ts
init_render();
var ReminderSkill = class {
  constructor() {
    this.id = "reminder";
  }
  execute(intent, context) {
    const path = context.settings.reminderFile;
    const when = intent.dueDate ?? "unspecified";
    const title = intent.title ?? intent.text;
    const entryId = createEntryId("rem", context.now);
    return {
      path,
      action: "prepend",
      content: buildRecordDocument({
        calloutType: "warning",
        title: `\u63D0\u9192 | ${title}`,
        fields: [
          { label: "\u7F16\u53F7", value: entryId },
          { label: "\u72B6\u6001", value: "scheduled" },
          { label: "\u65F6\u95F4", value: when }
        ],
        sourceText: intent.text
      }),
      summary: `reminder captured in ${path}`,
      metadata: { entryId }
    };
  }
};

// src/skills/subscription.ts
init_nlp();
init_render();
var SubscriptionSkill = class {
  constructor() {
    this.id = "subscription";
  }
  execute(intent, context) {
    const path = context.settings.subscriptionFile;
    const vendor = intent.vendor ?? intent.title ?? extractVendor(intent.text) ?? "unknown-service";
    const amount = intent.amount ?? extractAmount(intent.text) ?? 0;
    const currency = normalizeCurrency(intent.currency) ?? "CNY";
    const cycle = normalizeCycle(intent.cycle ?? extractCycle(intent.text)) ?? "monthly";
    const dueDate = normalizeDate(intent.dueDate) ?? inferNextDateFromCycle(cycle, context.now);
    const startDate = formatDate(context.now);
    return {
      path,
      action: "append",
      content: buildRecordDocument({
        calloutType: "note",
        title: `\u8BA2\u9605 | ${vendor}`,
        fields: [
          { label: "\u72B6\u6001", value: "active" },
          { label: "\u91D1\u989D", value: `${amount.toFixed(2)} ${currency}` },
          { label: "\u5468\u671F", value: cycle },
          { label: "\u4E0B\u6B21\u5230\u671F", value: dueDate },
          { label: "\u5F00\u59CB\u65F6\u95F4", value: startDate }
        ],
        sourceText: intent.text
      }),
      summary: `subscription entry saved to ${path}`
    };
  }
};

// src/skills/todo.ts
init_render();
var TodoSkill = class {
  constructor() {
    this.id = "todo";
  }
  execute(intent, context) {
    const path = context.settings.taskFile;
    const title = intent.title ?? intent.text;
    const entryId = createEntryId("tod", context.now);
    const priority = intent.priority ?? "medium";
    return {
      path,
      action: "prepend",
      content: buildRecordDocument({
        calloutType: "todo",
        title: `\u5F85\u529E | ${title}`,
        fields: [
          { label: "\u7F16\u53F7", value: entryId },
          { label: "\u72B6\u6001", value: "open" },
          { label: "\u4F18\u5148\u7EA7", value: priority },
          { label: "\u622A\u6B62", value: intent.dueDate ?? "unspecified" },
          { label: "\u6807\u7B7E", value: renderTags(intent.tags) }
        ],
        sourceText: intent.text
      }),
      summary: `task captured in ${path}`,
      metadata: { entryId }
    };
  }
};

// src/ui/capture-modal.ts
var import_obsidian10 = require("obsidian");
init_render();
var CaptureModal = class extends import_obsidian10.Modal {
  constructor(plugin, forcedSkill) {
    super(plugin.app);
    this.inputValue = "";
    this.textAreaEl = null;
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.statusEl = null;
    this.previewBadgeEl = null;
    this.previewPathEl = null;
    this.previewSummaryEl = null;
    this.previewBodyEl = null;
    this.previewConfirmButton = null;
    this.preview = null;
    this.batchMode = false;
    this.batchPreviews = [];
    this.eventCleanups = [];
    this.plugin = plugin;
    this.forcedSkill = forcedSkill;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const shell = contentEl.createDiv({ cls: "sch-shell sch-capture-shell" });
    const hero = shell.createDiv({ cls: "sch-hero" });
    hero.createEl("p", { cls: "sch-kicker", text: this.forcedSkill ? `DIRECT: ${renderSkillBadge(this.forcedSkill)}` : "CAPTURE FLOW" });
    hero.createEl("h2", { text: this.forcedSkill ? `Capture: ${renderSkillBadge(this.forcedSkill)}` : "Smart Capture" });
    hero.createEl("p", {
      cls: "sch-hero-copy",
      text: this.forcedSkill ? "Input will be directly routed to this skill without analysis." : "Type or transcribe first, then inspect the routed preview before anything touches the vault."
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
    });
    const onInput = () => {
      this.inputValue = this.textAreaEl?.value ?? "";
      this.clearPreview(false);
    };
    this.textAreaEl.addEventListener("input", onInput);
    this.eventCleanups.push(() => this.textAreaEl?.removeEventListener("input", onInput));
    const voiceRow = inputCard.createDiv({ cls: "sch-action-row" });
    const startButton = voiceRow.createEl("button", { cls: "sch-secondary-button", text: "Start Recording" });
    const stopButton = voiceRow.createEl("button", { cls: "sch-secondary-button", text: "Stop + Transcribe" });
    const batchButton = voiceRow.createEl("button", { cls: "sch-secondary-button", text: "Batch Mode: OFF" });
    const previewButton = voiceRow.createEl("button", { cls: "sch-primary-button", text: "Preview" });
    const confirmButton = voiceRow.createEl("button", {
      cls: "sch-primary-button",
      text: "Write",
      attr: { disabled: "true" }
    });
    this.previewConfirmButton = confirmButton;
    const onStart = async () => {
      await this.startRecording();
    };
    const onStop = async () => {
      await this.stopRecordingAndTranscribe();
    };
    const onBatch = () => {
      this.batchMode = !this.batchMode;
      batchButton.textContent = `Batch Mode: ${this.batchMode ? "ON" : "OFF"}`;
    };
    const onPreview = async () => {
      await this.generatePreview();
    };
    const onConfirm = async () => {
      await this.commitPreview();
    };
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
  onClose() {
    this.cleanupRecordingResources();
    for (const cleanup of this.eventCleanups) cleanup();
    this.eventCleanups.length = 0;
    this.contentEl.empty();
  }
  async generatePreview() {
    const text = this.inputValue.trim();
    if (!text) {
      new import_obsidian10.Notice("Please enter some text.");
      return;
    }
    if (this.batchMode) {
      await this.generateBatchPreview(text);
    } else {
      await this.generateSinglePreview(text);
    }
  }
  async generateSinglePreview(text) {
    this.setStatus("Analyzing input...");
    try {
      const preview = this.forcedSkill ? await this.previewWithForcedSkill(text) : await this.plugin.previewInput(text);
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
      new import_obsidian10.Notice(error instanceof Error ? error.message : String(error));
    }
  }
  async generateBatchPreview(text) {
    this.setStatus("Analyzing batch input...");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const previews = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const preview = this.forcedSkill ? await this.previewWithForcedSkill(lines[i].trim()) : await this.plugin.previewInput(lines[i].trim());
        previews.push(preview);
        this.setStatus(`Analyzing... ${i + 1}/${lines.length}`);
      } catch (error) {
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
      this.previewBodyEl.textContent = previews.map((p, i) => `--- Entry ${i + 1} ---
${p.result.content.trimEnd()}`).join("\n\n");
    }
    this.setStatus(`Batch preview ready: ${previews.length} items`);
    if (this.previewConfirmButton) this.previewConfirmButton.disabled = previews.length > 0;
  }
  async commitPreview() {
    if (this.batchPreviews.length > 0) {
      await this.commitBatch();
    } else if (this.preview) {
      await this.commitSingle();
    } else {
      new import_obsidian10.Notice("Generate a preview first.");
    }
  }
  async commitSingle() {
    if (!this.preview) return;
    try {
      const summary = await this.plugin.commitPreview(this.preview);
      this.setStatus("Write complete.");
      new import_obsidian10.Notice(summary);
      this.close();
    } catch (error) {
      this.setStatus("Write failed.");
      new import_obsidian10.Notice(error instanceof Error ? error.message : String(error));
    }
  }
  async commitBatch() {
    let written = 0;
    for (const preview of this.batchPreviews) {
      try {
        await this.plugin.commitPreview(preview);
        written++;
        this.setStatus(`Writing... ${written}/${this.batchPreviews.length}`);
      } catch {
      }
    }
    this.setStatus(`Batch write complete: ${written}/${this.batchPreviews.length}`);
    new import_obsidian10.Notice(`Batch: ${written}/${this.batchPreviews.length} entries written.`);
    this.close();
  }
  async previewWithForcedSkill(text) {
    const router = await Promise.resolve().then(() => (init_router(), router_exports));
    const r = new router.IntentRouter(this.plugin.settings);
    const normalized = await r.route(text);
    normalized.skill = this.forcedSkill;
    const result = this.plugin.getSkill(this.forcedSkill).execute(normalized, {
      settings: this.plugin.settings,
      now: /* @__PURE__ */ new Date()
    });
    return { intent: normalized, result };
  }
  renderPreview(preview) {
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
  renderEmptyPreview() {
    if (this.previewBadgeEl) {
      this.previewBadgeEl.textContent = "Not analyzed";
    }
    if (this.previewPathEl) {
      this.previewPathEl.textContent = "Target path will appear here.";
    }
    if (this.previewSummaryEl) {
      this.previewSummaryEl.textContent = "Generate a preview to see the routed skill, the target file, and the final markdown payload.";
    }
    if (this.previewBodyEl) {
      this.previewBodyEl.textContent = "Preview content will appear here.";
    }
    if (this.previewConfirmButton) {
      this.previewConfirmButton.disabled = true;
    }
  }
  clearPreview(updateStatus = true) {
    this.preview = null;
    this.batchPreviews = [];
    this.renderEmptyPreview();
    if (updateStatus) {
      this.setStatus("Idle");
    }
  }
  async startRecording() {
    if (this.recorder && this.recorder.state === "recording") {
      new import_obsidian10.Notice("Recording already in progress.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      new import_obsidian10.Notice("MediaRecorder is not supported in this environment.");
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
      new import_obsidian10.Notice("Recording started.");
    } catch (error) {
      new import_obsidian10.Notice(error instanceof Error ? error.message : String(error));
      this.cleanupRecordingResources();
    }
  }
  async stopRecordingAndTranscribe() {
    if (!this.recorder || this.recorder.state !== "recording") {
      new import_obsidian10.Notice("No active recording.");
      return;
    }
    this.setStatus("Processing audio...");
    const recorder = this.recorder;
    const recordedBlob = await new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type: mimeType }));
      };
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.stop();
    });
    this.cleanupRecordingResources();
    if (recordedBlob.size === 0) {
      new import_obsidian10.Notice("Empty recording. Please try again.");
      this.setStatus("Idle");
      return;
    }
    try {
      const text = await this.plugin.transcribeAudio(recordedBlob);
      this.appendText(text);
      this.setStatus("Transcription complete.");
      new import_obsidian10.Notice("Transcription appended.");
    } catch (error) {
      this.setStatus("Transcription failed.");
      new import_obsidian10.Notice(error instanceof Error ? error.message : String(error));
    }
  }
  appendText(value) {
    const next = this.inputValue ? `${this.inputValue}
${value}` : value;
    this.inputValue = next;
    if (this.textAreaEl) {
      this.textAreaEl.value = next;
      this.textAreaEl.dispatchEvent(new Event("input"));
    }
    this.clearPreview(false);
  }
  cleanupRecordingResources() {
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
  setStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }
};

// src/ui/daily-review-modal.ts
var import_obsidian12 = require("obsidian");

// src/services/daily-review.ts
var import_obsidian11 = require("obsidian");
init_render();
async function generateDailyReview(vault, settings, date = /* @__PURE__ */ new Date()) {
  const dateStr = formatDate(date);
  const sections = [
    `# Daily Review \u2014 ${dateStr}`,
    ""
  ];
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const financePath = (0, import_obsidian11.normalizePath)(`${settings.financeFolder}/${month}.md`);
  const financeEntries = await collectEntriesForDate(vault, financePath, dateStr);
  if (financeEntries.length > 0) {
    sections.push("## \u{1F4B0} \u4ECA\u65E5\u8BB0\u8D26", "");
    sections.push(...financeEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  const todoEntries = await collectEntriesForDate(vault, (0, import_obsidian11.normalizePath)(settings.taskFile), dateStr);
  if (todoEntries.length > 0) {
    sections.push("## \u2705 \u5F85\u529E\u4E8B\u9879", "");
    sections.push(...todoEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  const reminderEntries = await collectEntriesForDate(vault, (0, import_obsidian11.normalizePath)(settings.reminderFile), dateStr);
  if (reminderEntries.length > 0) {
    sections.push("## \u23F0 \u63D0\u9192", "");
    sections.push(...reminderEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  const memoPath = (0, import_obsidian11.normalizePath)(`${settings.memoFolder}/${dateStr}.md`);
  const memoEntries = await collectAllEntries(vault, memoPath);
  if (memoEntries.length > 0) {
    sections.push("## \u{1F4DD} \u5907\u5FD8", "");
    sections.push(...memoEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  const habitPath = (0, import_obsidian11.normalizePath)(`${settings.habitFolder}/${month}.md`);
  const habitEntries = await collectEntriesForDate(vault, habitPath, dateStr);
  if (habitEntries.length > 0) {
    sections.push("## \u{1F3AF} \u4E60\u60EF\u6253\u5361", "");
    sections.push(...habitEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  const qnPath = (0, import_obsidian11.normalizePath)(`${settings.quickNoteFolder}/${dateStr}.md`);
  const qnEntries = await collectAllEntries(vault, qnPath);
  if (qnEntries.length > 0) {
    sections.push("## \u{1F4CC} \u5FEB\u901F\u7B14\u8BB0", "");
    sections.push(...qnEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  const ideaEntries = await collectEntriesForDate(vault, (0, import_obsidian11.normalizePath)(settings.ideaFile), dateStr);
  if (ideaEntries.length > 0) {
    sections.push("## \u{1F4A1} \u7075\u611F", "");
    sections.push(...ideaEntries.map((e) => `- ${e}`));
    sections.push("");
  }
  if (sections.length <= 2) {
    sections.push("\u4ECA\u5929\u6CA1\u6709\u8BB0\u5F55\u3002\u4FDD\u6301\u597D\u4E60\u60EF\uFF0C\u660E\u5929\u7EE7\u7EED\u52A0\u6CB9\uFF01", "");
  }
  return sections.join("\n");
}
async function saveDailyReview(vault, settings, content, date = /* @__PURE__ */ new Date()) {
  const dateStr = formatDate(date);
  const path = (0, import_obsidian11.normalizePath)(`${settings.dailyReviewFolder}/${dateStr}.md`);
  const file = vault.getAbstractFileByPath(path);
  if (file instanceof import_obsidian11.TFile) {
    await vault.modify(file, content);
  } else {
    const parts = path.split("/");
    parts.pop();
    if (parts.length > 0) {
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        if (!vault.getAbstractFileByPath(current)) {
          await vault.createFolder(current);
        }
      }
    }
    await vault.create(path, content);
  }
  return path;
}
async function collectEntriesForDate(vault, filePath, dateStr) {
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof import_obsidian11.TFile)) return [];
  const content = await vault.read(file);
  const lines = content.split("\n");
  const entries = [];
  let currentTitle = "";
  let currentDate = "";
  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      const titleMatch = line.match(/\|\s*(.+)$/);
      currentTitle = titleMatch?.[1]?.trim() ?? "";
      currentDate = "";
      continue;
    }
    const dateMatch = line.match(/^\s*>\s*-\s*(?:记录时间|时间|日期|开始时间):\s*(.+)$/);
    if (dateMatch) {
      currentDate = dateMatch[1].trim();
      if (currentDate.startsWith(dateStr) && currentTitle) {
        entries.push(currentTitle);
      }
      continue;
    }
  }
  return entries;
}
async function collectAllEntries(vault, filePath) {
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof import_obsidian11.TFile)) return [];
  const content = await vault.read(file);
  const lines = content.split("\n");
  const entries = [];
  for (const line of lines) {
    if (/^\s*>\s+\[!/.test(line)) {
      const titleMatch = line.match(/\|\s*(.+)$/);
      if (titleMatch) entries.push(titleMatch[1].trim());
    }
    if (/^###\s+\d{2}:\d{2}$/.test(line)) {
      entries.push(line.replace(/^###\s+/, ""));
    }
  }
  return entries;
}

// src/ui/daily-review-modal.ts
var DailyReviewModal = class extends import_obsidian12.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.previewEl = null;
    this.reviewContent = "";
  }
  onOpen() {
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
  onClose() {
    this.contentEl.empty();
  }
  async generate() {
    if (!this.previewEl) return;
    this.previewEl.textContent = "Generating...";
    try {
      this.reviewContent = await generateDailyReview(this.app.vault, this.plugin.settings);
      this.previewEl.textContent = this.reviewContent;
      const saveBtn = this.contentEl.querySelector(".sch-secondary-button");
      if (saveBtn) saveBtn.disabled = false;
    } catch (error) {
      this.previewEl.textContent = error instanceof Error ? error.message : String(error);
    }
  }
  async save(saveBtn) {
    if (!this.reviewContent) {
      new import_obsidian12.Notice("Generate a review first.");
      return;
    }
    try {
      const path = await saveDailyReview(this.app.vault, this.plugin.settings, this.reviewContent);
      new import_obsidian12.Notice(`Daily review saved to ${path}`);
      saveBtn.disabled = true;
      this.close();
    } catch (error) {
      new import_obsidian12.Notice(error instanceof Error ? error.message : String(error));
    }
  }
};

// src/ui/mcp-tool-modal.ts
var import_obsidian13 = require("obsidian");
var McpToolModal = class extends import_obsidian13.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.endpointIndex = 0;
    this.toolName = "";
    this.argsJson = "{}";
    this.outputEl = null;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "MCP Tool Runner" });
    const endpoints = this.plugin.getEnabledMcpEndpoints();
    if (endpoints.length === 0) {
      contentEl.createEl("p", { text: "No enabled MCP endpoints found in settings." });
      return;
    }
    new import_obsidian13.Setting(contentEl).setName("Endpoint").addDropdown((drop) => {
      endpoints.forEach((endpoint, idx) => {
        drop.addOption(String(idx), `${endpoint.name} (${endpoint.transport})`);
      });
      drop.setValue("0");
      drop.onChange((value) => {
        this.endpointIndex = Number.parseInt(value, 10) || 0;
      });
    });
    new import_obsidian13.Setting(contentEl).setName("Tool name").setDesc("Use List Tools first to see available names").addText((text) => {
      text.setValue(this.toolName).onChange((value) => {
        this.toolName = value.trim();
      });
    });
    new import_obsidian13.Setting(contentEl).setName("Tool args JSON").addTextArea((text) => {
      text.inputEl.rows = 8;
      text.inputEl.style.width = "100%";
      text.setValue(this.argsJson).onChange((value) => {
        this.argsJson = value;
      });
    });
    const actionWrap = contentEl.createDiv();
    const listButton = actionWrap.createEl("button", { text: "List Tools" });
    listButton.addEventListener("click", async () => {
      const endpoint = endpoints[this.endpointIndex];
      try {
        const tools = await this.plugin.listMcpTools(endpoint);
        if (tools.length === 0) {
          this.showOutput("No tools returned by endpoint.");
          return;
        }
        const text = tools.map((tool) => `- ${tool.name}${tool.description ? `: ${tool.description}` : ""}`).join("\n");
        this.showOutput(text);
      } catch (error) {
        this.showOutput(error instanceof Error ? error.message : String(error));
      }
    });
    const callButton = actionWrap.createEl("button", { text: "Call Tool" });
    callButton.addEventListener("click", async () => {
      if (!this.toolName) {
        new import_obsidian13.Notice("Please enter tool name.");
        return;
      }
      let args;
      try {
        args = JSON.parse(this.argsJson);
      } catch {
        new import_obsidian13.Notice("Args must be valid JSON.");
        return;
      }
      const endpoint = endpoints[this.endpointIndex];
      try {
        const result = await this.plugin.callMcpTool(endpoint, this.toolName, args);
        this.showOutput(result);
      } catch (error) {
        this.showOutput(error instanceof Error ? error.message : String(error));
      }
    });
    this.outputEl = contentEl.createEl("pre", { cls: "sch-result" });
  }
  onClose() {
    this.contentEl.empty();
  }
  showOutput(text) {
    if (!this.outputEl) return;
    this.outputEl.textContent = text;
  }
};

// src/ui/search-modal.ts
var import_obsidian15 = require("obsidian");

// src/services/search-service.ts
var import_obsidian14 = require("obsidian");
var SKILL_FILE_MAP = {
  accounting: (s) => [s.financeFolder],
  subscription: (s) => [s.subscriptionFile],
  todo: (s) => [s.taskFile],
  reminder: (s) => [s.reminderFile],
  memo: (s) => [s.memoFolder],
  habit: (s) => [s.habitFolder],
  "quick-note": (s) => [s.quickNoteFolder],
  contact: (s) => [s.contactFile],
  idea: (s) => [s.ideaFile]
};
var SearchService = class {
  constructor(settings) {
    this.settings = settings;
  }
  async searchAll(vault, query) {
    const results = [];
    const skillTypes = query.skillType ? [query.skillType] : this.getEnabledSkills();
    for (const skill of skillTypes) {
      const paths = this.getFilePaths(vault, skill);
      for (const filePath of paths) {
        const file = vault.getAbstractFileByPath((0, import_obsidian14.normalizePath)(filePath));
        if (!(file instanceof import_obsidian14.TFile)) continue;
        const content = await vault.read(file);
        const entries = this.parseEntries(content, skill, filePath);
        for (const entry of entries) {
          if (this.matchesQuery(entry, query)) {
            results.push(entry);
          }
        }
      }
    }
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }
  getEnabledSkills() {
    const toggles = this.settings.skills;
    return Object.keys(toggles).filter((k) => toggles[k]);
  }
  getFilePaths(vault, skill) {
    const bases = SKILL_FILE_MAP[skill](this.settings);
    const paths = [];
    for (const base of bases) {
      if (base.endsWith(".md")) {
        paths.push(base);
      } else {
        const folder = vault.getAbstractFileByPath((0, import_obsidian14.normalizePath)(base));
        if (folder) {
          this.collectMarkdownFiles(vault, (0, import_obsidian14.normalizePath)(base), paths);
        }
      }
    }
    return paths;
  }
  collectMarkdownFiles(vault, folderPath, paths) {
    const files = vault.getFiles();
    for (const file of files) {
      if (file.path.startsWith(folderPath) && file.path.endsWith(".md")) {
        paths.push(file.path);
      }
    }
  }
  parseEntries(content, skill, filePath) {
    const results = [];
    const lines = content.split("\n");
    let current = null;
    let snippetLines = [];
    const commit = () => {
      if (current?.entryId) {
        current.snippet = snippetLines.join("\n").slice(0, 200);
        results.push(current);
      }
      current = null;
      snippetLines = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*>\s+\[!/.test(line)) {
        commit();
        const titleMatch = line.match(/\|\s*(.+)$/);
        current = {
          file: filePath,
          skill,
          title: titleMatch?.[1]?.trim() ?? "",
          date: "",
          status: "",
          entryId: "",
          line: i + 1,
          snippet: ""
        };
        snippetLines = [line];
        continue;
      }
      if (!current) continue;
      snippetLines.push(line);
      const idMatch = line.match(/^\s*>\s*-\s*编号:\s*(.+)$/);
      if (idMatch) {
        current.entryId = idMatch[1].trim();
        continue;
      }
      const statusMatch = line.match(/^\s*>\s*-\s*状态:\s*(.+)$/);
      if (statusMatch) {
        current.status = statusMatch[1].trim();
        continue;
      }
      const dateMatch = line.match(/^\s*>\s*-\s*(?:记录时间|时间|日期|开始时间):\s*(.+)$/);
      if (dateMatch) {
        current.date = dateMatch[1].trim();
        continue;
      }
      if (/^###\s+\d{2}:\d{2}$/.test(line)) {
        commit();
        current = {
          file: filePath,
          skill: "quick-note",
          title: line.replace(/^###\s+/, ""),
          date: filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "",
          status: "captured",
          entryId: `qn-${i}`,
          line: i + 1,
          snippet: ""
        };
        snippetLines = [line];
      }
    }
    commit();
    return results;
  }
  matchesQuery(entry, query) {
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      const haystack = `${entry.title} ${entry.snippet}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    if (query.tag) {
      const tag = query.tag.startsWith("#") ? query.tag : `#${query.tag}`;
      if (!entry.snippet.includes(tag)) return false;
    }
    if (query.dateRange) {
      const entryDate = entry.date.slice(0, 10);
      if (query.dateRange.from && entryDate < query.dateRange.from) return false;
      if (query.dateRange.to && entryDate > query.dateRange.to) return false;
    }
    return true;
  }
};

// src/ui/search-modal.ts
init_render();
var SearchModal = class extends import_obsidian15.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.keyword = "";
    this.skillFilter = "";
    this.dateFrom = "";
    this.dateTo = "";
    this.tagFilter = "";
    this.resultsEl = null;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Search Entries" });
    new import_obsidian15.Setting(contentEl).setName("Keyword").addText((text) => {
      text.setPlaceholder("search keyword...").onChange((value) => {
        this.keyword = value;
      });
    });
    const skillOptions = { "": "All skills" };
    const allSkills = ["accounting", "subscription", "todo", "reminder", "memo", "habit", "quick-note", "contact", "idea"];
    for (const s of allSkills) {
      skillOptions[s] = renderSkillBadge(s);
    }
    new import_obsidian15.Setting(contentEl).setName("Skill type").addDropdown((drop) => {
      for (const [value, label] of Object.entries(skillOptions)) {
        drop.addOption(value, label);
      }
      drop.onChange((value) => {
        this.skillFilter = value;
      });
    });
    new import_obsidian15.Setting(contentEl).setName("Date from (YYYY-MM-DD)").addText((text) => {
      text.setPlaceholder("2026-01-01").onChange((value) => {
        this.dateFrom = value.trim();
      });
    });
    new import_obsidian15.Setting(contentEl).setName("Date to (YYYY-MM-DD)").addText((text) => {
      text.setPlaceholder("2026-12-31").onChange((value) => {
        this.dateTo = value.trim();
      });
    });
    new import_obsidian15.Setting(contentEl).setName("Tag").addText((text) => {
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
  onClose() {
    this.contentEl.empty();
  }
  async runSearch() {
    if (!this.resultsEl) return;
    this.resultsEl.empty();
    this.resultsEl.createEl("p", { text: "Searching..." });
    try {
      const service = new SearchService(this.plugin.settings);
      const results = await service.searchAll(this.app.vault, {
        keyword: this.keyword || void 0,
        skillType: this.skillFilter || void 0,
        dateRange: this.dateFrom || this.dateTo ? {
          from: this.dateFrom,
          to: this.dateTo
        } : void 0,
        tag: this.tagFilter || void 0
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
  renderResultItem(result) {
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
};

// src/ui/workspace-hub-modal.ts
var import_obsidian16 = require("obsidian");
var WorkspaceHubModal = class extends import_obsidian16.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  onOpen() {
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
      new import_obsidian16.Notice(`Updated finance summary: ${path}`);
    });
    this.renderActionCard(grid, "Storage", "Configured vault targets for every skill.", "View Targets", () => {
      new import_obsidian16.Notice(
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
    this.renderSubscriptionCard(grid);
  }
  onClose() {
    this.contentEl.empty();
  }
  enabledSkillCount() {
    return Object.values(this.plugin.settings.skills).filter(Boolean).length;
  }
  async loadAsyncStats(stats) {
    try {
      const financePath = (0, import_obsidian16.normalizePath)(this.plugin.getCurrentMonthFinancePath());
      const file = this.app.vault.getAbstractFileByPath(financePath);
      if (file instanceof import_obsidian16.TFile) {
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
      const taskFile = this.app.vault.getAbstractFileByPath((0, import_obsidian16.normalizePath)(this.plugin.settings.taskFile));
      if (taskFile instanceof import_obsidian16.TFile) {
        const content = await this.app.vault.read(taskFile);
        const openCount = (content.match(/状态:\s*open/g) || []).length;
        this.renderStat(stats, "Open Todos", String(openCount));
      }
      const budget = this.plugin.settings.budget.monthlyBudget;
      if (budget > 0) {
        const content = file instanceof import_obsidian16.TFile ? await this.app.vault.read(file) : "";
        const expenseMatch = content.match(/- Expense:\s*([\d.]+)/);
        const spent = expenseMatch ? Number.parseFloat(expenseMatch[1]) : 0;
        const pct = Math.min(100, spent / budget * 100);
        this.renderStat(stats, "Budget", `${pct.toFixed(0)}% used`);
      }
    } catch {
    }
  }
  renderSubscriptionCard(grid) {
    const card = grid.createDiv({ cls: "sch-card sch-hub-card" });
    card.createEl("h3", { text: "Subscriptions" });
    const subFile = this.app.vault.getAbstractFileByPath((0, import_obsidian16.normalizePath)(this.plugin.settings.subscriptionFile));
    if (!(subFile instanceof import_obsidian16.TFile)) {
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
        item.textContent = `${entry.vendor} \u2014 ${entry.dueDate} (${entry.amount})`;
      }
    }).catch(() => {
      card.createEl("p", { cls: "sch-card-copy", text: "Could not read subscriptions." });
    });
  }
  parseUpcomingSubscriptions(content) {
    const entries = [];
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
      if (dueMatch) {
        dueDate = dueMatch[1].trim();
        continue;
      }
      const amountMatch = line.match(/^\s*>\s*-\s*金额:\s*(.+)$/);
      if (amountMatch) {
        amount = amountMatch[1].trim();
        continue;
      }
    }
    if (vendor && dueDate) entries.push({ vendor, dueDate, amount });
    return entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  renderStat(parent, label, value) {
    const stat = parent.createDiv({ cls: "sch-stat" });
    stat.createEl("span", { cls: "sch-stat-label", text: label });
    stat.createEl("strong", { cls: "sch-stat-value", text: value });
  }
  renderActionCard(parent, title, description, buttonText, onClick) {
    const card = parent.createDiv({ cls: "sch-card sch-hub-card" });
    card.createEl("h3", { text: title });
    card.createEl("p", { cls: "sch-card-copy", text: description });
    const button = card.createEl("button", { cls: "sch-primary-button", text: buttonText });
    button.addEventListener("click", async () => {
      await onClick();
    });
  }
};

// src/main.ts
var SmartCapturePlugin = class extends import_obsidian17.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.skills = /* @__PURE__ */ new Map();
    this.mcpService = null;
    this.undoService = new UndoService();
  }
  async onload() {
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
      callback: () => {
        new WorkspaceHubModal(this).open();
      }
    });
    this.addCommand({
      id: "open-smart-capture-modal",
      name: "Open Smart Capture",
      callback: () => {
        new CaptureModal(this).open();
      }
    });
    this.addCommand({
      id: "open-mcp-tool-runner",
      name: "Open MCP Tool Runner",
      callback: () => {
        new McpToolModal(this).open();
      }
    });
    this.addCommand({
      id: "search-entries",
      name: "Search Entries",
      callback: () => {
        new SearchModal(this).open();
      }
    });
    this.addCommand({
      id: "undo-last-capture",
      name: "Undo Last Capture",
      callback: async () => {
        if (!this.undoService.canUndo()) {
          new import_obsidian17.Notice("Nothing to undo.");
          return;
        }
        const result = await this.undoService.undo(this.app.vault);
        new import_obsidian17.Notice(result ?? "Undo failed.");
      }
    });
    this.addCommand({
      id: "generate-daily-review",
      name: "Generate Daily Review",
      callback: () => {
        new DailyReviewModal(this).open();
      }
    });
    const directSkills = ["accounting", "subscription", "todo", "reminder", "memo", "habit", "quick-note", "contact", "idea"];
    for (const skill of directSkills) {
      this.addCommand({
        id: `capture-${skill}`,
        name: `Capture: ${skill}`,
        callback: () => {
          new CaptureModal(this, skill).open();
        }
      });
    }
    this.addCommand({
      id: "ping-enabled-mcp-endpoints",
      name: "Ping MCP endpoints",
      callback: async () => {
        const mcp = this.createMcpService();
        const endpoints = mcp.getEnabledEndpoints();
        if (endpoints.length === 0) {
          new import_obsidian17.Notice("No enabled MCP endpoints found.");
          return;
        }
        for (const endpoint of endpoints) {
          const ok = await mcp.pingEndpoint(endpoint);
          new import_obsidian17.Notice(`${endpoint.name}: ${ok ? "reachable" : "unreachable"}`);
        }
      }
    });
    this.addCommand({
      id: "refresh-current-month-finance-summary",
      name: "Refresh current month finance summary",
      callback: async () => {
        const path = await this.refreshCurrentMonthFinanceSummary();
        new import_obsidian17.Notice(`Updated finance summary: ${path}`);
      }
    });
    this.setupReminderScanner();
  }
  async captureInput(rawInput) {
    const preview = await this.previewInput(rawInput);
    return this.commitPreview(preview);
  }
  async previewInput(rawInput) {
    const router = new IntentRouter(this.settings);
    const intent = await router.route(rawInput);
    const skill = this.skills.get(intent.skill);
    if (!skill) {
      throw new Error(`No skill registered for ${intent.skill}`);
    }
    const result = skill.execute(intent, {
      settings: this.settings,
      now: /* @__PURE__ */ new Date()
    });
    return { intent, result };
  }
  async commitPreview(preview) {
    const { intent, result } = preview;
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
  async transcribeAudio(blob) {
    const transcriber = new SttTranscriber(this.settings.stt);
    return transcriber.transcribeAudio(blob);
  }
  async autoFillLlmModel() {
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
  async autoFillSttModel() {
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
  async refreshCurrentMonthFinanceSummary() {
    const path = this.getCurrentMonthFinancePath(/* @__PURE__ */ new Date());
    await updateFinanceSummary(this.app.vault, path);
    return path;
  }
  getEnabledMcpEndpoints() {
    return this.settings.mcpEndpoints.filter((e) => e.enabled && e.urlOrCommand.trim().length > 0);
  }
  async listMcpTools(endpoint) {
    const mcp = this.createMcpService();
    return mcp.listTools(endpoint);
  }
  async callMcpTool(endpoint, toolName, args) {
    const mcp = this.createMcpService();
    return mcp.callTool(endpoint, toolName, args);
  }
  getSkill(skillType) {
    return this.skills.get(skillType);
  }
  getUndoService() {
    return this.undoService;
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data,
      llm: { ...DEFAULT_SETTINGS.llm, ...data?.llm ?? {} },
      stt: { ...DEFAULT_SETTINGS.stt, ...data?.stt ?? {} },
      skills: { ...DEFAULT_SETTINGS.skills, ...data?.skills ?? {} },
      mcpEndpoints: Array.isArray(data?.mcpEndpoints) ? data.mcpEndpoints : DEFAULT_SETTINGS.mcpEndpoints,
      reminderMcp: { ...DEFAULT_SETTINGS.reminderMcp, ...data?.reminderMcp ?? {} },
      budget: { ...DEFAULT_SETTINGS.budget, ...data?.budget ?? {} },
      reminderScanner: { ...DEFAULT_SETTINGS.reminderScanner, ...data?.reminderScanner ?? {} },
      templates: { ...DEFAULT_SETTINGS.templates, ...data?.templates ?? {} }
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  registerSkills() {
    const entries = [
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
  createMcpService() {
    if (!this.mcpService) {
      this.mcpService = new McpService(this.settings.mcpEndpoints);
    }
    return this.mcpService;
  }
  setupReminderScanner() {
    if (!this.settings.reminderScanner.enabled) return;
    const intervalMs = Math.max(1, this.settings.reminderScanner.intervalMinutes) * 60 * 1e3;
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
    window.setTimeout(() => {
      scanReminders(this.app.vault, this.settings.reminderFile);
      checkSubscriptionExpiry(
        this.app.vault,
        this.settings.subscriptionFile,
        this.settings.reminderFile,
        this.settings.reminderScanner.advanceNoticeDays
      );
    }, 3e3);
  }
  async syncReminderToMcp(intent) {
    if (!this.settings.reminderMcp.enabled) return;
    const toolName = this.settings.reminderMcp.toolName.trim();
    if (!toolName) return;
    const endpoint = this.resolveReminderEndpoint();
    if (!endpoint) {
      new import_obsidian17.Notice("Reminder MCP sync skipped: no matching enabled endpoint.");
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
        new import_obsidian17.Notice(`Reminder synced via MCP: ${endpoint.name}`);
      }
    } catch (error) {
      new import_obsidian17.Notice(`Reminder MCP sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  resolveReminderEndpoint() {
    const enabled = this.getEnabledMcpEndpoints();
    if (enabled.length === 0) return null;
    const preferredName = this.settings.reminderMcp.endpointName.trim().toLowerCase();
    if (!preferredName) return enabled[0];
    return enabled.find((endpoint) => endpoint.name.trim().toLowerCase() === preferredName) ?? null;
  }
  async discoverModels(baseUrl, apiKey, timeoutMs) {
    const trimmedBaseUrl = baseUrl.trim().replace(/\/$/, "");
    if (!trimmedBaseUrl) {
      throw new Error("Base URL is required.");
    }
    if (!apiKey.trim()) {
      throw new Error("API key is required.");
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(timeoutMs, 5e3));
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
      const payload = await response.json();
      const ids = (payload.data ?? []).map((item) => typeof item.id === "string" ? item.id.trim() : "").filter((item) => item.length > 0);
      if (ids.length === 0) {
        throw new Error("No models found from this endpoint.");
      }
      return ids;
    } finally {
      window.clearTimeout(timer);
    }
  }
  getCurrentMonthFinancePath(date = /* @__PURE__ */ new Date()) {
    return `${this.settings.financeFolder}/${this.currentMonthString(date)}.md`;
  }
  currentMonthString(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }
  onunload() {
    this.mcpService?.dispose();
    this.mcpService = null;
  }
};
function pickPreferredModel(models, preferred) {
  const loweredMap = /* @__PURE__ */ new Map();
  for (const model of models) {
    loweredMap.set(model.toLowerCase(), model);
  }
  for (const expected of preferred) {
    const hit = loweredMap.get(expected.toLowerCase());
    if (hit) return hit;
  }
  return models[0];
}
