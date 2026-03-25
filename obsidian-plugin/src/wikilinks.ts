import { App, TFile } from "obsidian";
import { slugFromPath } from "./utils";

export interface WikilinkData {
  raw: string[];
  resolved: string[];
  broken: string[];
}

export function extractWikilinks(app: App, file: TFile): WikilinkData {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.links) return { raw: [], resolved: [], broken: [] };

  const rawSet = new Set<string>();
  const resolvedSet = new Set<string>();
  const brokenSet = new Set<string>();

  for (const link of cache.links) {
    const target = link.link;
    rawSet.add(target);

    const dest = app.metadataCache.getFirstLinkpathDest(target, file.path);
    if (dest) {
      resolvedSet.add(slugFromPath(dest.path));
    } else {
      brokenSet.add(target);
    }
  }

  return {
    raw: [...rawSet],
    resolved: [...resolvedSet],
    broken: [...brokenSet],
  };
}
