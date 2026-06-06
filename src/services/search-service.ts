import { TFile, normalizePath, type Vault } from "obsidian";
import type { SkillType, SmartCaptureSettings } from "../types";

export interface SearchQuery {
  keyword?: string;
  dateRange?: { from: string; to: string };
  skillType?: SkillType;
  tag?: string;
}

export interface SearchResult {
  file: string;
  skill: SkillType;
  title: string;
  date: string;
  status: string;
  entryId: string;
  line: number;
  snippet: string;
}

const SKILL_FILE_MAP: Record<SkillType, (s: SmartCaptureSettings) => string[]> = {
  accounting: (s) => [s.financeFolder],
  subscription: (s) => [s.subscriptionFile],
  todo: (s) => [s.taskFile],
  reminder: (s) => [s.reminderFile],
  memo: (s) => [s.memoFolder],
  habit: (s) => [s.habitFolder],
  "quick-note": (s) => [s.quickNoteFolder],
  contact: (s) => [s.contactFile],
  idea: (s) => [s.ideaFile]
};

export class SearchService {
  constructor(private readonly settings: SmartCaptureSettings) {}

  async searchAll(vault: Vault, query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const skillTypes = query.skillType ? [query.skillType] : this.getEnabledSkills();

    for (const skill of skillTypes) {
      const paths = this.getFilePaths(vault, skill);
      for (const filePath of paths) {
        const file = vault.getAbstractFileByPath(normalizePath(filePath));
        if (!(file instanceof TFile)) continue;

        const content = await vault.read(file);
        const entries = this.parseEntries(content, skill, filePath);

        for (const entry of entries) {
          if (this.matchesQuery(entry, query)) {
            results.push(entry);
          }
        }
      }
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }

  private getEnabledSkills(): SkillType[] {
    const toggles = this.settings.skills;
    return (Object.keys(toggles) as SkillType[]).filter((k) => toggles[k]);
  }

  private getFilePaths(vault: Vault, skill: SkillType): string[] {
    const bases = SKILL_FILE_MAP[skill](this.settings);
    const paths: string[] = [];

    for (const base of bases) {
      if (base.endsWith(".md")) {
        paths.push(base);
      } else {
        // folder - find all .md files
        const folder = vault.getAbstractFileByPath(normalizePath(base));
        if (folder) {
          this.collectMarkdownFiles(vault, normalizePath(base), paths);
        }
      }
    }

    return paths;
  }

  private collectMarkdownFiles(vault: Vault, folderPath: string, paths: string[]): void {
    const files = vault.getFiles();
    for (const file of files) {
      if (file.path.startsWith(folderPath) && file.path.endsWith(".md")) {
        paths.push(file.path);
      }
    }
  }

  private parseEntries(content: string, skill: SkillType, filePath: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = content.split("\n");
    let current: Partial<SearchResult> | null = null;
    let snippetLines: string[] = [];

    const commit = () => {
      if (current?.entryId) {
        current.snippet = snippetLines.join("\n").slice(0, 200);
        results.push(current as SearchResult);
      }
      current = null;
      snippetLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^\s*>\s+\[!/.test(line)) {
        commit();
        const titleMatch = line.match(/\|\s*(.+)$/);
        current = {
          file: filePath,
          skill,
          title: titleMatch?.[1]?.trim() ?? "",
          date: "",
          status: "",
          entryId: "",
          line: i + 1,
          snippet: ""
        };
        snippetLines = [line];
        continue;
      }

      if (!current) continue;
      snippetLines.push(line);

      const idMatch = line.match(/^\s*>\s*-\s*编号:\s*(.+)$/);
      if (idMatch) { current.entryId = idMatch[1].trim(); continue; }

      const statusMatch = line.match(/^\s*>\s*-\s*状态:\s*(.+)$/);
      if (statusMatch) { current.status = statusMatch[1].trim(); continue; }

      const dateMatch = line.match(/^\s*>\s*-\s*(?:记录时间|时间|日期|开始时间):\s*(.+)$/);
      if (dateMatch) { current.date = dateMatch[1].trim(); continue; }

      // quick-note format
      if (/^###\s+\d{2}:\d{2}$/.test(line)) {
        commit();
        current = {
          file: filePath,
          skill: "quick-note",
          title: line.replace(/^###\s+/, ""),
          date: filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "",
          status: "captured",
          entryId: `qn-${i}`,
          line: i + 1,
          snippet: ""
        };
        snippetLines = [line];
      }
    }

    commit();
    return results;
  }

  private matchesQuery(entry: SearchResult, query: SearchQuery): boolean {
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      const haystack = `${entry.title} ${entry.snippet}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }

    if (query.tag) {
      const tag = query.tag.startsWith("#") ? query.tag : `#${query.tag}`;
      if (!entry.snippet.includes(tag)) return false;
    }

    if (query.dateRange) {
      const entryDate = entry.date.slice(0, 10);
      if (query.dateRange.from && entryDate < query.dateRange.from) return false;
      if (query.dateRange.to && entryDate > query.dateRange.to) return false;
    }

    return true;
  }
}
