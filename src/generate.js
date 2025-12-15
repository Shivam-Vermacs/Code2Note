
import path from "path";
import { summarizeWithLLM, enhanceWithLLM } from "./llm.js";


function generateHeuristicNotes(code, filePath) {
  const lines = code.split("\n");
  const ext = path.extname(filePath).slice(1) || "txt";

  let problem = "Code Analysis";
  const firstFewLines = lines.slice(0, 10).join("\n");

  // Attempt to infer problem name from leading comments
  const problemMatch = firstFewLines.match(/\/\/\s*(.+?)(?:\n|$)/);
  if (problemMatch) {
    problem = problemMatch[1].trim();
  }

  let approach = "General algorithm implementation";
  let complexity = "Time: O(?), Space: O(?)";
  const edgeCases = [];

  const codeStr = code.toLowerCase();

  // Sorting algorithm detection
  if (codeStr.includes("sort") || /swap.*temp|temp.*swap/.test(codeStr)) {
    if (codeStr.includes("partition") || codeStr.includes("quicksort")) {
      approach =
        "Quick Sort: Divide and conquer sorting algorithm using partitioning";
      complexity =
        "Time: O(n log n) average, O(n²) worst case; Space: O(log n)";
    } else if (codeStr.includes("merge")) {
      approach = "Merge Sort: Divide and conquer sorting with merging";
      complexity = "Time: O(n log n); Space: O(n)";
    } else {
      approach =
        "Selection Sort: Find minimum element and swap to correct position";
      complexity = "Time: O(n²); Space: O(1)";
    }

    edgeCases.push(
      "Empty array",
      "Single element",
      "Already sorted array",
      "Reverse sorted array"
    );
  }

  // Binary search detection
  if (
    codeStr.includes("binary") ||
    /mid\s*=.*\/\s*2|left.*right.*mid/.test(codeStr)
  ) {
    approach = "Binary Search: Divide and conquer search on sorted data";
    complexity = "Time: O(log n); Space: O(1)";

    edgeCases.push(
      "Element not found",
      "Element at boundaries",
      "Single element",
      "Empty array"
    );
  }

  // Dynamic programming detection
  if (codeStr.includes("dp") || codeStr.includes("memo")) {
    approach =
      "Dynamic Programming: Breaking problem into overlapping subproblems";
    complexity = "Time: O(n*m) typically; Space: O(n*m) for memoization";

    edgeCases.push("Base cases", "Zero values", "Maximum constraints");
  }

  // Graph traversal detection
  if (
    codeStr.includes("graph") ||
    codeStr.includes("dfs") ||
    codeStr.includes("bfs")
  ) {
    approach = "Graph Traversal: Exploring vertices and edges";
    complexity = "Time: O(V + E); Space: O(V)";

    edgeCases.push("Disconnected graph", "Cycles", "Single node", "Self-loops");
  }

  // Two-pointer technique detection
  if (/left.*right|i.*j.*while|two.*pointer/i.test(codeStr)) {
    approach = "Two Pointers: Using two indices to traverse data structure";
    complexity = "Time: O(n); Space: O(1)";

    edgeCases.push("Empty input", "Single element", "All same elements");
  }

  // Sliding window detection
  if (/window|substr|subarray/i.test(codeStr)) {
    approach = "Sliding Window: Maintaining a window over array/string";
    complexity = "Time: O(n); Space: O(1) or O(k)";

    edgeCases.push(
      "Window larger than array",
      "Minimum window size",
      "No valid window"
    );
  }

  const pseudocode = `1. Read input
2. Process using ${approach.split(":")[0]}
3. Return result`;

  // Extract example-related comments if present
  const examples = [];
  const exampleRegex = /(?:example|input|output)[\s:]*(.+)/gi;
  let match;

  while ((match = exampleRegex.exec(firstFewLines)) !== null) {
    examples.push({
      input: match[1].trim(),
      output: "See code output",
      note: "Extracted from comments",
    });
  }

  return {
    title: path.basename(filePath).replace(/\.[^/.]+$/, ""),
    language: ext,
    problem,
    approach,
    pseudocode,
    complexity,
    edgeCases,
    examples: examples.length > 0 ? examples : [],
    explanation: `This code implements ${approach.toLowerCase()}. ${complexity}`,
    code,
  };
}

/**
 * Main entry point for generating structured notes.
 * Supports heuristic-only, LLM-only, and hybrid modes.
 */
export async function generateApproach(code, filePath, mode = "llm") {
  try {
    let note;

    switch (mode) {
      case "heuristic":
        console.log("Using heuristic pattern matching...");
        note = generateHeuristicNotes(code, filePath);
        break;

      case "llm":
        console.log("Using multi-stage LLM analysis...");
        console.log("This may take 15–25 seconds for higher quality output.");
        note = await summarizeWithLLM(code, filePath);
        break;

      case "hybrid": {
        console.log("Step 1: Heuristic analysis...");
        const heuristicNote = generateHeuristicNotes(code, filePath);

        console.log("Step 2: Enhancing with LLM...");
        note = await enhanceWithLLM(heuristicNote, code);
        break;
      }

      default:
        console.warn("Unknown mode. Falling back to heuristic.");
        note = generateHeuristicNotes(code, filePath);
    }

    // Normalize required fields defensively
    note.title = (note.title || path.basename(filePath || "unknown")).replace(
      /\.[^/.]+$/,
      ""
    );

    note.language =
      note.language || path.extname(filePath || "").slice(1) || "plain";

    note.problem = note.problem || "not inferred";
    note.approach = note.approach || "";
    note.pseudocode = note.pseudocode || "";
    note.complexity = note.complexity || "";
    note.edgeCases = Array.isArray(note.edgeCases) ? note.edgeCases : [];
    note.examples = Array.isArray(note.examples) ? note.examples : [];
    note.explanation = note.explanation || "";
    note.code = note.code || code;

    return note;
  } catch (err) {
    console.error(
      "Note generation failed:",
      err && err.message ? err.message : err
    );

    if (mode !== "heuristic") {
      console.log("Falling back to heuristic generation...");
      return generateHeuristicNotes(code, filePath);
    }

    return {
      title: path.basename(filePath || "unknown").replace(/\.[^/.]+$/, ""),
      language: path.extname(filePath || "").slice(1) || "plain",
      problem: "not inferred",
      approach: "",
      pseudocode: "",
      complexity: "",
      edgeCases: [],
      examples: [],
      explanation: "",
      code,
    };
  }
}
