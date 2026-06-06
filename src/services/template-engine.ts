export interface TemplateContext {
  title: string;
  entryId: string;
  dateTime: string;
  date: string;
  time: string;
  sourceText: string;
  calloutType: string;
  fields: Array<{ label: string; value: string }>;
  tags: string;
  [key: string]: string | Array<{ label: string; value: string }> | undefined;
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  if (!template.trim()) return "";

  let result = template;

  // replace simple placeholders {{key}}
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value === "string") {
      result = result.replace(new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "g"), value);
    }
  }

  // replace {{#each fields}} ... {{/each}} blocks
  result = result.replace(
    /\{\{#each\s+fields\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, inner: string) => {
      if (!Array.isArray(ctx.fields)) return "";
      return ctx.fields
        .map((field) => {
          return inner
            .replace(/\{\{\s*label\s*\}\}/g, field.label)
            .replace(/\{\{\s*value\s*\}\}/g, field.value);
        })
        .join("\n");
    }
  );

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
