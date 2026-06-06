import { formatDate, formatTime } from "../services/render";
import type { ParsedIntent, SkillResult } from "../types";
import type { Skill, SkillContext } from "./base";

export class QuickNoteSkill implements Skill {
  id: ParsedIntent["skill"] = "quick-note";

  execute(intent: ParsedIntent, context: SkillContext): SkillResult {
    const date = formatDate(context.now);
    const time = formatTime(context.now);
    const path = `${context.settings.quickNoteFolder}/${date}.md`;

    return {
      path,
      action: "append",
      content: `### ${time}\n${intent.text}\n\n`,
      summary: `quick note appended to ${path}`
    };
  }
}
