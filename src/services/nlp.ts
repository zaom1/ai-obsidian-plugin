import type { ParsedIntent, SkillType } from "../types";
import { formatDate } from "./render";

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "¥": "CNY",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "￥": "CNY"
};

const ACCOUNTING_CATEGORIES: Record<string, RegExp> = {
  "餐饮": /吃饭|午餐|晚餐|早餐|外卖|饭|餐|奶茶|咖啡|美团|饿了么|火锅|烧烤|快餐|饮料|水果|零食|夜宵|小吃|面馆|饭店|餐厅|早饭|午饭|晚饭/i,
  "交通": /打车|地铁|公交|滴滴|加油|停车|高铁|火车|机票|飞机|出租车|共享单车|骑行|高速|过路费|洗车|保养|维修|uber|taxi/i,
  "购物": /淘宝|京东|购物|衣服|鞋|包|超市|日用|拼多多|天猫|商城|百货|服装|裤子|帽子|外套|裙子|化妆品|护肤/i,
  "娱乐": /电影|游戏|KTV|旅游|门票|演出|剧本杀|密室|演唱会|音乐节|展览|网吧|电竞|充值/i,
  "居住": /房租|水电|物业|燃气|暖气|房贷|装修|家具|家电|维修|宽带|网费/i,
  "医疗": /医院|药|体检|看病|挂号|门诊|手术|牙科|眼科|配镜|保险|医疗/i,
  "教育": /书|课程|培训|学费|考试|报名|教材|网课|会员|学习/i,
  "工资": /工资|薪资|奖金|年终奖|绩效|提成|补贴|报销到账|income|salary|refund/i,
  "通讯": /话费|流量|手机|充值|月租|宽带费/i,
  "社交": /红包|份子钱|礼物|送礼|请客|聚餐|AA/i
};

export function normalizeIntent(intent: ParsedIntent, now = new Date()): ParsedIntent {
  const normalized: ParsedIntent = { ...intent };

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

export function inferSkillByRules(input: string, isEnabled: (skill: SkillType) => boolean): SkillType {
  const lowered = input.toLowerCase();
  const candidates: SkillType[] = [];

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

function firstEnabledSkill(isEnabled: (skill: SkillType) => boolean): SkillType {
  const keys: SkillType[] = ["accounting", "subscription", "todo", "reminder", "habit", "contact", "idea", "memo", "quick-note"];
  for (const key of keys) {
    if (isEnabled(key)) return key;
  }
  return "memo";
}

export function extractAmount(text: string): number | undefined {
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/(?:^|\s)(\d+(?:\.\d{1,2})?)(?:\s|$)/);
  if (!match) return undefined;
  const amount = Number.parseFloat(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

export function detectCurrency(text: string): string | undefined {
  const symbolMatch = text.match(/[¥$€£￥]/);
  if (symbolMatch) {
    return CURRENCY_SYMBOL_MAP[symbolMatch[0]];
  }
  const codeMatch = text.match(/\b(cny|rmb|usd|eur|gbp|jpy|hkd)\b/i);
  if (!codeMatch) return undefined;
  const code = codeMatch[1].toUpperCase();
  return code === "RMB" ? "CNY" : code;
}

export function normalizeCurrency(currency?: string): string | undefined {
  if (!currency) return undefined;
  const upper = currency.toUpperCase();
  if (upper === "RMB") return "CNY";
  return upper;
}

export function extractCycle(text: string): string | undefined {
  const lowered = text.toLowerCase();
  if (/(daily|每天|每日)/.test(lowered)) return "daily";
  if (/(weekly|每周|每星期)/.test(lowered)) return "weekly";
  if (/(quarterly|每季|季度)/.test(lowered)) return "quarterly";
  if (/(yearly|annual|每年|年费)/.test(lowered)) return "yearly";
  if (/(monthly|每月|月费)/.test(lowered)) return "monthly";
  return undefined;
}

export function normalizeCycle(cycle?: string): string | undefined {
  if (!cycle) return undefined;
  const lowered = cycle.toLowerCase();
  if (lowered.startsWith("day")) return "daily";
  if (lowered.startsWith("week")) return "weekly";
  if (lowered.startsWith("month")) return "monthly";
  if (lowered.startsWith("quarter")) return "quarterly";
  if (lowered.startsWith("year") || lowered.startsWith("annual")) return "yearly";
  return lowered;
}

export function extractNaturalDueDate(text: string, now = new Date()): string | undefined {
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

  return undefined;
}

export function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return value;
  const yyyy = match[1];
  const mm = match[2].padStart(2, "0");
  const dd = match[3].padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function inferNextDateFromCycle(cycle: string, now: Date): string {
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

export function extractPaymentMethod(text: string): string | undefined {
  const lowered = text.toLowerCase();
  if (/(wechat|微信)/.test(lowered)) return "wechat";
  if (/(alipay|支付宝)/.test(lowered)) return "alipay";
  if (/(cash|现金)/.test(lowered)) return "cash";
  if (/(visa|master|credit|信用卡)/.test(lowered)) return "card";
  if (/(bank|transfer|转账)/.test(lowered)) return "bank-transfer";
  return undefined;
}

export function inferTransactionType(intent: ParsedIntent): "expense" | "income" {
  const lowered = intent.text.toLowerCase();
  if (intent.transactionType === "expense" || intent.transactionType === "income") return intent.transactionType;
  if (/(收入|工资|报销到账|refund|income|salary|received|赚了)/i.test(lowered)) {
    return "income";
  }
  return "expense";
}

export function extractVendor(text: string): string | undefined {
  const trimmed = text.trim();
  const cleaned = trimmed
    .replace(/subscription|订阅|续费|monthly|yearly|每月|每年/gi, "")
    .replace(/\d+(?:\.\d{1,2})?/g, "")
    .replace(/[¥$€£￥]/g, "")
    .replace(/\b(cny|rmb|usd|eur|gbp|jpy|hkd)\b/gi, "")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function extractShortTitle(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export function extractCategory(text: string): string | undefined {
  for (const [category, pattern] of Object.entries(ACCOUNTING_CATEGORIES)) {
    if (pattern.test(text)) return category;
  }
  return undefined;
}

export function extractHabitName(text: string): string | undefined {
  const cleaned = text
    .replace(/打卡|习惯|habit|签到|完成|做了|today|今天|每日|每天/gi, "")
    .replace(/[！!。.，,、]/g, "")
    .trim();
  return cleaned.length > 0 && cleaned.length <= 20 ? cleaned : undefined;
}

export function extractPersonName(text: string): string | undefined {
  // match Chinese name patterns: 和/跟/见/找 + 2-4 char Chinese name
  const cnMatch = text.match(/(?:和|跟|见了|找了|约了|拜访了?|联系了?|认识了?|@)([\u4e00-\u9fa5]{2,4})/);
  if (cnMatch) return cnMatch[1];

  // match "call/meeting with Name" patterns
  const enMatch = text.match(/(?:call|meeting|chat)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (enMatch) return enMatch[1];

  // match @Name pattern
  const atMatch = text.match(/@(\S{2,20})/);
  if (atMatch) return atMatch[1];

  return undefined;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}
