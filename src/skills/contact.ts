import { extractPersonName } from "../services/nlp";
import { buildRecordDocument, createEntryId, formatDateTime, renderTags } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class ContactSkill implements Skill {
  id: ParsedIntent["skill"] = "contact";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const path = context.settings.contactFile;
    const personName = intent.personName ?? intent.title ?? extractPersonName(intent.text) ?? "unknown";
    const entryId = createEntryId("con", context.now);

    return {
      path,
      action: "append",
      content: buildRecordDocument({
        calloutType: "info",
        title: `联系人 | ${personName}`,
        fields: [
          { label: "编号", value: entryId },
          { label: "记录时间", value: formatDateTime(context.now) },
          { label: "标签", value: renderTags(intent.tags) }
        ],
        sourceText: intent.text
      }),
      summary: `contact note saved to ${path}`,
      metadata: { personName }
    };
  }
}
