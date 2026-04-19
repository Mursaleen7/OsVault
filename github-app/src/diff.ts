/**
 * Parse added dependencies from a git diff of dependency manifest files.
 *
 * Supported ecosystems:
 *   • npm       — package.json
 *   • PyPI      — requirements.txt
 *   • Go        — go.mod
 *   • Maven     — pom.xml
 *   • Gradle    — build.gradle / build.gradle.kts
 *   • Rust      — Cargo.toml
 */

export interface ParsedDep {
  name: string;
  version: string;
  ecosystem: "npm" | "PyPI" | "Go" | "Maven" | "Cargo";
}

/** Extract added lines from a unified diff string */
function addedLines(diff: string): string[] {
  return diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1).trim());
}

/** Parse added deps from a package.json diff */
function parsePackageJsonDiff(diff: string): ParsedDep[] {
  const lines = addedLines(diff);
  const deps: ParsedDep[] = [];

  for (const line of lines) {
    // Match lines like: "lodash": "^4.17.21",
    const match = line.match(/^"([^"]+)"\s*:\s*"([^"]+)"/);
    if (match) {
      deps.push({ name: match[1], version: match[2], ecosystem: "npm" });
    }
  }

  return deps;
}

/** Parse added deps from a requirements.txt diff */
function parseRequirementsDiff(diff: string): ParsedDep[] {
  const lines = addedLines(diff);
  const deps: ParsedDep[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    const match = line.match(/^([A-Za-z0-9_\-\.]+)\s*([><!=~].+)?$/);
    if (match) {
      deps.push({
        name: match[1],
        version: match[2]?.trim() ?? "*",
        ecosystem: "PyPI",
      });
    }
  }

  return deps;
}

/** Parse added deps from a go.mod diff */
function parseGoModDiff(diff: string): ParsedDep[] {
  const lines = addedLines(diff);
  const deps: ParsedDep[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("//") || line.startsWith("module ") || line.startsWith("go ")) continue;
    // Match lines like: github.com/gin-gonic/gin v1.9.1
    const match = line.match(/^\s*([a-zA-Z0-9._\-/]+)\s+(v[0-9][^\s]*)/);
    if (match) {
      deps.push({
        name: match[1],
        version: match[2],
        ecosystem: "Go",
      });
    }
  }

  return deps;
}

/** Parse added deps from a pom.xml diff (Maven) */
function parsePomXmlDiff(diff: string): ParsedDep[] {
  const lines = addedLines(diff);
  const deps: ParsedDep[] = [];

  // Simple heuristic: look for <groupId> and <artifactId> / <version> tags
  let groupId = "";
  let artifactId = "";

  for (const line of lines) {
    const gMatch = line.match(/<groupId>([^<]+)<\/groupId>/);
    if (gMatch) { groupId = gMatch[1]; continue; }

    const aMatch = line.match(/<artifactId>([^<]+)<\/artifactId>/);
    if (aMatch) { artifactId = aMatch[1]; continue; }

    const vMatch = line.match(/<version>([^<]+)<\/version>/);
    if (vMatch && groupId && artifactId) {
      deps.push({
        name: `${groupId}:${artifactId}`,
        version: vMatch[1],
        ecosystem: "Maven",
      });
      groupId = "";
      artifactId = "";
    }
  }

  return deps;
}

/** Parse added deps from a build.gradle or build.gradle.kts diff */
function parseGradleDiff(diff: string): ParsedDep[] {
  const lines = addedLines(diff);
  const deps: ParsedDep[] = [];

  for (const line of lines) {
    // Match: implementation 'com.google.guava:guava:31.1-jre'
    // or:    implementation("com.google.guava:guava:31.1-jre")
    const match = line.match(
      /(?:implementation|api|compile|runtimeOnly|testImplementation)\s*[\('"]\s*['"]?([^:'"]+):([^:'"]+):([^'")\s]+)/
    );
    if (match) {
      deps.push({
        name: `${match[1]}:${match[2]}`,
        version: match[3],
        ecosystem: "Maven",
      });
    }
  }

  return deps;
}

/** Parse added deps from a Cargo.toml diff (Rust) */
function parseCargoTomlDiff(diff: string): ParsedDep[] {
  const lines = addedLines(diff);
  const deps: ParsedDep[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#") || line.startsWith("[")) continue;

    // Match: serde = "1.0"  or  serde = { version = "1.0", features = [...] }
    const simpleMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*=\s*"([^"]+)"/);
    if (simpleMatch) {
      deps.push({
        name: simpleMatch[1],
        version: simpleMatch[2],
        ecosystem: "Cargo",
      });
      continue;
    }

    // Match: serde = { version = "1.0" }
    const tableMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
    if (tableMatch) {
      deps.push({
        name: tableMatch[1],
        version: tableMatch[2],
        ecosystem: "Cargo",
      });
    }
  }

  return deps;
}

export function parseDiff(filename: string, diff: string): ParsedDep[] {
  if (filename === "package.json") return parsePackageJsonDiff(diff);
  if (filename === "requirements.txt") return parseRequirementsDiff(diff);
  if (filename === "go.mod") return parseGoModDiff(diff);
  if (filename === "pom.xml") return parsePomXmlDiff(diff);
  if (filename === "build.gradle" || filename === "build.gradle.kts") return parseGradleDiff(diff);
  if (filename === "Cargo.toml") return parseCargoTomlDiff(diff);
  return [];
}

export const DEP_FILES = [
  "package.json",
  "requirements.txt",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Cargo.toml",
];
