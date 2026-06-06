import { buildRecordDocument, createEntryId, renderTags } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class TodoSkill implements Skill {
  id: ParsedIntent["skill"] = "todo";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const path = context.settings.taskFile;
    const title = intent.title ?? intent.text;
    const entryId = createEntryId("tod", context.now);
    const priority = intent.priority ?? "medium";

    return {
      path,
      action: "prepend",
      content: buildRecordDocument({
        calloutType: "todo",
        title: `待办 | ${title}`,
        fields: [
          { label: "编号", value: entryId },
          { label: "状态", value: "open" },
          { label: "优先级", value: priority },
          { label: "截止", value: intent.dueDate ?? "unspecified" },
          { label: "标签", value: renderTags(intent.tags) }
        ],
        sourceText: intent.text
      }),
      summary: `task captured in ${path}`,
      metadata: { entryId }
    };
  }
}
