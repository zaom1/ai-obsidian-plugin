import { extractHabitName } from "../services/nlp";
import { buildRecordDocument, createEntryId, formatDate } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class HabitSkill implements Skill {
  id: ParsedIntent["skill"] = "habit";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const month = formatMonth(context.now);
    const path = `${context.settings.habitFolder}/${month}.md`;
    const habitName = intent.habitName ?? intent.title ?? extractHabitName(intent.text) ?? "habit";
    const entryId = createEntryId("hab", context.now);

    return {
      path,
      action: "append",
      content: buildRecordDocument({
        sectionTitle: formatDate(context.now),
        calloutType: "success",
        title: `习惯打卡 | ${habitName}`,
        fields: [
          { label: "编号", value: entryId },
          { label: "日期", value: formatDate(context.now) },
          { label: "习惯", value: habitName },
          { label: "标签", value: "#habit" }
        ],
        sourceText: intent.text
      }),
      summary: `habit "${habitName}" logged to ${path}`,
      metadata: { habitName }
    };
  }
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
