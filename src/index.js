
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import "dotenv/config";

import { generateApproach } from "./generate.js";

function usageAndExit() {
  console.log(`
Usage: node src/index.js <path-to-solution> [options]

Options:
  --no-save              Do not save JSON output (preview only)
  --json-out=<path>      Custom output path for JSON file
  --mode=<mode>          Generation mode: heuristic|llm|hybrid (default: llm)
  --no-notion            Skip Notion posting even if credentials are set

Examples:
  node src/index.js examples/solution.cpp
  node src/index.js examples/solution.cpp --mode=heuristic
  node src/index.js examples/solution.cpp --mode=hybrid --json-out=output/
  node src/index.js examples/solution.cpp --no-save --no-notion

Modes:
  heuristic - Fast, pattern-based analysis (no API required)
  llm       - AI-powered deep analysis (requires GROQ_API_KEY)
  hybrid    - Combines both approaches
  `);

  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    noSave: false,
    jsonOut: null,
    filePath: null,
    mode: "llm",
    noNotion: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--no-save") {
      opts.noSave = true;
    } else if (arg === "--no-notion") {
      opts.noNotion = true;
    } else if (arg.startsWith("--json-out=")) {
      opts.jsonOut = arg.split("=")[1];
    } else if (arg.startsWith("--mode=")) {
      const mode = arg.split("=")[1].toLowerCase();
      if (["heuristic", "llm", "hybrid"].includes(mode)) {
        opts.mode = mode;
      } else {
        console.warn("Unknown mode:", mode, "- using 'llm' instead");
      }
    } else if (arg.startsWith("--")) {
      console.warn("Unknown flag:", arg);
    } else if (!opts.filePath) {
      opts.filePath = arg;
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

  return problem.length > 120 ? `${problem.slice(0, 120)}...` : problem;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.filePath) {
    usageAndExit();
  }

  // Validate API requirements for LLM-based modes
  if (
    (opts.mode === "llm" || opts.mode === "hybrid") &&
    !process.env.GROQ_API_KEY
  ) {
    console.error(`
Error: GROQ_API_KEY not found in environment

Mode '${opts.mode}' requires a Groq API key.
Options:
1. Obtain a key from https://console.groq.com
2. Add GROQ_API_KEY=your_key to the .env file
3. Or run with --mode=heuristic
    `);
    process.exit(1);
  }

  console.log(`\nMode: ${opts.mode.toUpperCase()}`);

  if (opts.mode === "llm") {
    console.log("Using AI-powered analysis");
  } else if (opts.mode === "hybrid") {
    console.log("Using hybrid analysis (heuristic + AI)");
  } else {
    console.log("Using heuristic pattern-based analysis");
  }

  let code;
  try {
    console.log(`Reading file: ${opts.filePath}`);
    code = await fs.readFile(opts.filePath, "utf8");
  } catch (err) {
    console.error("Failed to read file:", err.message);
    process.exit(1);
  }

  let result;
  try {
    console.log("Generating notes...");
    result = await generateApproach(code, opts.filePath, opts.mode);
    console.log("Notes generated successfully");
  } catch (err) {
    console.error("Generation failed:", err.message || err);
    process.exit(1);
  }

  // Normalize result defensively
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
    (code.length > 20000 ? `${code.slice(0, 20000)}\n/* TRUNCATED */` : code);

  result.metadata = {
    generatedAt: new Date().toISOString(),
    mode: opts.mode,
    sourceFile: opts.filePath,
  };

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

  if (!opts.noSave) {
    try {
      await fs.writeFile(outPath, JSON.stringify(result, null, 2), "utf8");
      console.log(`Saved to: ${outPath}`);
    } catch (err) {
      console.error("Failed to write output:", err.message || err);
      console.log("Printing JSON to console instead:\n");
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } else {
    console.log("Preview only (no file saved)");
  }

  console.log("\n" + "=".repeat(60));
  console.log("NOTES PREVIEW");
  console.log("=".repeat(60));
  console.log("Title:", result.title);
  console.log("Language:", result.language);
  console.log("Problem:", previewLine(result));

  if (result.complexity) {
    console.log(
      "Complexity:",
      result.complexity.length > 100
        ? `${result.complexity.slice(0, 100)}...`
        : result.complexity
    );
  }

  console.log("=".repeat(60) + "\n");

  if (!opts.noNotion) {
    try {
      const { NOTION_TOKEN, NOTION_PARENT_PAGE_ID } = process.env;
      if (NOTION_TOKEN && NOTION_PARENT_PAGE_ID) {
        console.log("Posting to Notion...");
        const { postFixtureToNotion } = await import("./notion.js");
        const page = await postFixtureToNotion(result);

        console.log("Posted to Notion");
        console.log("Page ID:", page.id);
        console.log("URL:", `https://notion.so/${page.id.replace(/-/g, "")}`);
      }
    } catch (err) {
      console.warn(
        "Notion post failed:",
        err && err.message ? err.message : err
      );
    }
  }
}

main();
