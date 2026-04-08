"use strict";
/**
 * Parse added dependencies from a git diff of package.json or requirements.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEP_FILES = void 0;
exports.parseDiff = parseDiff;
/** Extract added lines from a unified diff string */
function addedLines(diff) {
    return diff
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1).trim());
}
/** Parse added deps from a package.json diff */
function parsePackageJsonDiff(diff) {
    const lines = addedLines(diff);
    const deps = [];
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
function parseRequirementsDiff(diff) {
    const lines = addedLines(diff);
    const deps = [];
    for (const line of lines) {
        if (!line || line.startsWith("#") || line.startsWith("-"))
            continue;
        const match = line.match(/^([A-Za-z0-9_\-\.]+)\s*([><=!~].+)?$/);
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
function parseDiff(filename, diff) {
    if (filename === "package.json")
        return parsePackageJsonDiff(diff);
    if (filename === "requirements.txt")
        return parseRequirementsDiff(diff);
    return [];
}
exports.DEP_FILES = ["package.json", "requirements.txt"];
