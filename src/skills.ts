import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import {
  loadSkills,
  type Skill,
  type LoadSkillsResult,
} from "@earendil-works/pi-coding-agent";
import type { ServerConfig } from "./config.js";
import { expandHomePath, isPathInsideRoot } from "./roots.js";

export interface LoadedSkills {
  skills: Skill[];
  diagnostics: LoadSkillsResult["diagnostics"];
}

export interface SkillReadResolution {
  absolutePath: string;
  skill: Skill;
  isSkillFile: boolean;
}

export function loadWorkspaceSkills(config: ServerConfig, cwd: string): LoadedSkills {
  if (!config.skillsEnabled) return { skills: [], diagnostics: [] };

  const loaded = loadSkills({
    cwd,
    agentDir: config.agentDir,
    skillPaths: config.skillPaths,
    includeDefaults: true,
  });

  return filterSkillsToAllowedRoots(loaded, config);
}

/**
 * Filter out any skill whose baseDir or filePath falls outside the configured
 * allowedRoots or the explicitly configured skillPaths. A skill declaring a
 * baseDir outside the allowlist would otherwise become a path-traversal pivot
 * through the read tool.
 */
function filterSkillsToAllowedRoots(
  loaded: LoadSkillsResult,
  config: ServerConfig,
): LoadedSkills {
  // A skill is acceptable if its baseDir AND filePath each fall inside at
  // least one of: the workspace allowlist, the configured skill paths, or the
  // agent directory. Without this guard a skill declaring an out-of-tree
  // baseDir becomes a path-traversal pivot for the read tool.
  const acceptedDirs = [...config.allowedRoots, ...config.skillPaths, config.agentDir];
  const insideAny = (path: string) => acceptedDirs.some((root) => isPathInsideRoot(path, root));

  const kept: Skill[] = [];
  const droppedNames: string[] = [];

  for (const skill of loaded.skills) {
    if (insideAny(skill.baseDir) && insideAny(skill.filePath)) {
      kept.push(skill);
    } else {
      droppedNames.push(skill.name);
    }
  }

  const diagnostics = [...loaded.diagnostics];
  if (droppedNames.length > 0) {
    diagnostics.push({
      type: "skill_path_outside_root",
      skills: droppedNames,
      message: `Dropped ${droppedNames.length} skill(s) whose baseDir/filePath is outside allowedRoots or skillPaths: ${droppedNames.join(", ")}`,
    } as unknown as LoadSkillsResult["diagnostics"][number]);
  }

  return { skills: kept, diagnostics };
}

export function resolveSkillReadPath(
  skills: Skill[],
  activatedSkillDirs: Set<string>,
  inputPath: string,
): SkillReadResolution | undefined {
  const absolutePath = resolve(expandHomePath(inputPath));

  for (const skill of skills) {
    const skillFilePath = resolve(skill.filePath);
    if (absolutePath === skillFilePath) {
      return { absolutePath, skill, isSkillFile: true };
    }
  }

  for (const skill of skills) {
    const baseDir = resolve(skill.baseDir);
    if (!activatedSkillDirs.has(baseDir)) continue;
    if (!isPathInsideRoot(absolutePath, baseDir)) continue;

    return { absolutePath, skill, isSkillFile: false };
  }

  return undefined;
}

export function markSkillActivated(
  activatedSkillDirs: Set<string>,
  skill: Skill,
): void {
  activatedSkillDirs.add(resolve(skill.baseDir));
}

export function formatPathForPrompt(path: string): string {
  const home = resolve(homedir());
  const resolvedPath = resolve(path);

  if (resolvedPath === home) return "~";
  if (resolvedPath.startsWith(`${home}${sep}`)) {
    return `~/${resolvedPath.slice(home.length + 1).split(sep).join("/")}`;
  }

  return resolvedPath.split(sep).join("/");
}
