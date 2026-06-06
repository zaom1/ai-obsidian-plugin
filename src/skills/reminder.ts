import { buildRecordDocument, createEntryId } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class ReminderSkill implements Skill {
  id: ParsedIntent["skill"] = "reminder";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const path = context.settings.reminderFile;
    const when = intent.dueDate ?? "unspecified";
    const title = intent.title ?? intent.text;
    const entryId = createEntryId("rem", context.now);

    return {
      path,
      action: "prepend",
      content: buildRecordDocument({
        calloutType: "warning",
        title: `提醒 | ${title}`,
        fields: [
          { label: "编号", value: entryId },
          { label: "状态", value: "scheduled" },
          { label: "时间", value: when }
        ],
        sourceText: intent.text
      }),
      summary: `reminder captured in ${path}`,
      metadata: { entryId }
    };
  }
}
