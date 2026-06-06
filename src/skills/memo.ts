import { buildRecordDocument, formatDate, formatTime } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class MemoSkill implements Skill {
  id: ParsedIntent["skill"] = "memo";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const date = formatDate(context.now);
    const path = `${context.settings.memoFolder}/${date}.md`;

    return {
      path,
      action: "append",
      content: buildRecordDocument({
        sectionTitle: date,
        calloutType: "note",
        title: `备忘 | ${formatTime(context.now)}`,
        fields: [
          { label: "状态", value: "captured" },
          { label: "时间", value: formatTime(context.now) }
        ],
        sourceText: intent.text
      }),
      summary: `memo appended to ${path}`
    };
  }
}
