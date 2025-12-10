// src/index.js
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import "dotenv/config";
import { generateApproach } from "./generate.js";

function usageAndExit() {
  console.log(
    "Usage: node src/index.js <path-to-solution> [--no-save] [--json-out=path]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { noSave: false, jsonOut: null, filePath: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-save") {
      opts.noSave = true;
    } else if (a.startsWith("--json-out=")) {
      opts.jsonOut = a.split("=")[1];
    } else if (a.startsWith("--")) {
      console.warn("Unknown flag:", a);
    } else if (!opts.filePath) {
      opts.filePath = a;
    } else {
      // ignore extra non-flag args
    }
  }
  return opts;
}

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

function safeBasenameNoExt(filePath) {
  const base = path.basename(filePath);
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(0, idx) : base;
}

function previewLine(result) {
  const problem =
    result && result.problem
      ? result.problem.replace(/\s+/g, " ").trim()
      : "not inferred";
  return problem.length > 120 ? problem.slice(0, 120) + "..." : problem;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.filePath) usageAndExit();

  // Read file
  let code;
  try {
    code = await fs.readFile(opts.filePath, "utf8");
  } catch (err) {
    console.error("Error reading file:", err.message);
    process.exit(1);
  }

  // Call generator
  let result;
  try {
    result = await generateApproach(code, opts.filePath);
  } catch (err) {
    console.error("Error in generator:", err.message || err);
    process.exit(1);
  }

  // Normalize result
  result = result || {};
  result.title = result.title || safeBasenameNoExt(opts.filePath);
  result.language =
    result.language || path.extname(opts.filePath).slice(1) || "unknown";
  result.problem = result.problem || "not inferred";
  result.approach = result.approach || "";
  result.pseudocode = result.pseudocode || "";
  result.complexity = result.complexity || "";
  result.edgeCases = Array.isArray(result.edgeCases)
    ? result.edgeCases
    : result.edgeCases
    ? [result.edgeCases]
    : [];
  result.code =
    result.code ||
    (code.length > 20000 ? code.slice(0, 20000) + "\n/* TRUNCATED */" : code);

  // Determine output path
  let outPath;
  if (opts.jsonOut) {
    if (opts.jsonOut.toLowerCase().endsWith(".json")) {
      outPath = path.resolve(opts.jsonOut);
      await ensureDir(path.dirname(outPath));
    } else {
      await ensureDir(opts.jsonOut);
      outPath = path.join(opts.jsonOut, `${result.title}.json`);
    }
  } else {
    await ensureDir("fixtures");
    outPath = path.join("fixtures", `${result.title}.json`);
  }

  // Write or preview
  // Write or preview
  if (!opts.noSave) {
    try {
      await fs.writeFile(outPath, JSON.stringify(result, null, 2), "utf8");
      console.log(`Created fixture: ${outPath}`);
    } catch (err) {
      console.error("Failed to write fixture:", err.message || err);
      console.log("Falling back to printing JSON to console...");
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } else {
    console.log("Preview only (no file saved)");
  }

  console.log("Problem (preview):", previewLine(result));

  // Optional: if Notion env set, post automatically and print page id/url
  try {
    const { NOTION_TOKEN, NOTION_PARENT_PAGE_ID } = process.env;
    if (NOTION_TOKEN && NOTION_PARENT_PAGE_ID) {
      // dynamic import to avoid requiring in non-notion flows
      const { postFixtureToNotion } = await import("./notion.js");
      const page = await postFixtureToNotion(result);
      console.log("Posted to Notion. Page id:", page.id);
    }
  } catch (err) {
    console.warn("Notion post failed:", err && err.message ? err.message : err);
  }
}

// run
main();
