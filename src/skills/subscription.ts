import {
  extractAmount,
  extractCycle,
  extractVendor,
  inferNextDateFromCycle,
  normalizeCurrency,
  normalizeCycle,
  normalizeDate
} from "../services/nlp";
import { buildRecordDocument, formatDate } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class SubscriptionSkill implements Skill {
  id: ParsedIntent["skill"] = "subscription";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
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
        title: `订阅 | ${vendor}`,
        fields: [
          { label: "状态", value: "active" },
          { label: "金额", value: `${amount.toFixed(2)} ${currency}` },
          { label: "周期", value: cycle },
          { label: "下次到期", value: dueDate },
          { label: "开始时间", value: startDate }
        ],
        sourceText: intent.text
      }),
      summary: `subscription entry saved to ${path}`
    };
  }
}
