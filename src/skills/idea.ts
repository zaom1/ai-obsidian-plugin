import { buildRecordDocument, createEntryId, formatDateTime, renderTags } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class IdeaSkill implements Skill {
  id: ParsedIntent["skill"] = "idea";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const path = context.settings.ideaFile;
    const pinned = intent.pinned ?? false;
    const title = intent.title ?? intent.text;
    const entryId = createEntryId("ide", context.now);

    return {
      path,
      action: pinned ? "prepend" : "append",
      content: buildRecordDocument({
        calloutType: "quote",
        title: `灵感 | ${title}`,
        fields: [
          { label: "编号", value: entryId },
          { label: "时间", value: formatDateTime(context.now) },
          { label: "置顶", value: pinned ? "是" : "否" },
          { label: "标签", value: renderTags(intent.tags) }
        ],
        sourceText: intent.text
      }),
      summary: `idea ${pinned ? "(pinned) " : ""}saved to ${path}`,
      metadata: { pinned }
    };
  }
}
