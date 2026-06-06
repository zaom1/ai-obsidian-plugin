import { extractAmount, extractCategory, inferTransactionType, normalizeCurrency } from "../services/nlp";
import { buildRecordDocument, createEntryId, formatDate, formatDateTime } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class AccountingSkill implements Skill {
  id: ParsedIntent["skill"] = "accounting";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const month = formatMonth(context.now);
    const path = `${context.settings.financeFolder}/${month}.md`;
    const entryId = createEntryId("fin", context.now);
    const amount = intent.amount ?? extractAmount(intent.text) ?? 0;
    const currency = normalizeCurrency(intent.currency) ?? "CNY";
    const method = intent.paymentMethod ?? "unspecified";
    const type = inferTransactionType(intent);
    const title = intent.title ?? intent.text;
    const category = intent.category ?? extractCategory(intent.text) ?? "其他";

    return {
      path,
      action: "append",
      content: buildRecordDocument({
        sectionTitle: formatDate(context.now),
        calloutType: type === "income" ? "tip" : "abstract",
        title: `${type === "income" ? "收入" : "支出"} | ${title}`,
        fields: [
          { label: "编号", value: entryId },
          { label: "状态", value: "logged" },
          { label: "记录时间", value: formatDateTime(context.now) },
          { label: "交易类型", value: type },
          { label: "消费分类", value: category },
          { label: "金额", value: `${amount.toFixed(2)} ${currency}` },
          { label: "支付方式", value: method }
        ],
        sourceText: intent.text
      }),
      summary: `${type} entry saved to ${path}`
    };
  }
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
