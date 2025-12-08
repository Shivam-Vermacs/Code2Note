// src/generate.js
import path from "path";

const MAX_CODE_CHARS = 20000;

/**
 * Helper: test regexes quickly
 */
function rx(re, s) {
  return re.test(s);
}

/**
 * Clean top comment: ignore lines that are preprocessor includes (#include <...>)
 * and trim common comment markers.
 */
function cleanTopComment(raw) {
  if (!raw) return "";
  // if looks like include / pragma / define -> ignore
  const first = raw.split(/\r?\n/)[0].trim();
  if (/^#\s*include\b/i.test(first) || /^#\s*(pragma|define)\b/i.test(first))
    return "";
  // remove leading comment tokens
  return raw.replace(/^\/\*+|^\*+|^\/\/+|^#+\s*/gm, "").trim();
}

/**
 * Build a user-friendly problem title from detected hints.
 */
function inferProblemTitle(hints, topComment) {
  // if topComment (clean) exists, prefer first short sentence
  if (topComment) {
    const s = topComment.split(/\r?\n/)[0].trim();
    if (s.length > 5 && s.length < 200 && !/^author:?\b/i.test(s)) {
      return s;
    }
  }

  // Map combinations -> friendly titles
  const h = hints.join(" ").toLowerCase();

  if (/sorting/.test(h) && /in-place swap/.test(h) && /nested loops/.test(h)) {
    return "Selection Sort (likely)";
  }
  if (/sorting/.test(h) && !/nested loops/.test(h)) {
    return "Sorting problem (library or efficient sort)";
  }
  if (/dfs/.test(h) || /bfs/.test(h) || /graph traversal/.test(h)) {
    return "Graph traversal (DFS/BFS)";
  }
  if (/dynamic programming|\bdp\b/.test(h)) {
    return "Dynamic Programming problem (DP)";
  }
  if (/union-find|dsu/.test(h)) {
    return "Disjoint Set / Union-Find usage";
  }
  if (/priority_queue|heap/.test(h)) {
    return "Heap / Priority Queue problem";
  }
  if (/recursive/.test(h)) {
    return "Recursive / Divide-and-Conquer problem";
  }
  if (/nested loops/.test(h)) {
    return "Quadratic-time pattern (nested loops)";
  }

  // generic fallback using first hint
  if (hints.length) {
    return `${
      hints[0][0].toUpperCase() + hints[0].slice(1)
    } problem (inferred)`;
  }

  return "Problem (not confidently inferred)";
}

/**
 * Produce a short but useful pseudocode snippet based on hints.
 * Keep it readable and short.
 */
function buildPseudocode(hints) {
  const h = hints.join(" ").toLowerCase();

  if (
    /selection sort/i.test(h) ||
    (/sorting/.test(h) && /in-place swap/.test(h) && /nested loops/.test(h))
  ) {
    return [
      "for i from 0 to n-2:",
      "    minIndex = i",
      "    for j from i+1 to n-1:",
      "        if arr[j] < arr[minIndex]:",
      "            minIndex = j",
      "    swap(arr[i], arr[minIndex])",
    ].join("\n");
  }

  if (/sorting/i.test(h)) {
    return "Use built-in sort or an efficient sort (e.g., quicksort/mergesort) on the array.";
  }

  if (/dfs/i.test(h)) {
    return [
      "function dfs(node):",
      "    mark node visited",
      "    for neighbor in node.neighbors:",
      "        if not visited(neighbor):",
      "            dfs(neighbor)",
    ].join("\n");
  }

  if (/bfs/i.test(h)) {
    return [
      "initialize queue with start node",
      "while queue not empty:",
      "    node = queue.pop()",
      "    for neighbor in node.neighbors:",
      "        if not visited(neighbor):",
      "            visited(neighbor) = true",
      "            queue.push(neighbor)",
    ].join("\n");
  }

  if (/dynamic programming|dp/i.test(h)) {
    return [
      "Define state DP[i] representing ...",
      "Initialize base cases",
      "For each state in order:",
      "    compute DP[state] using recurrence and previous states",
      "Return DP[target]",
    ].join("\n");
  }

  if (/union-find|dsu/i.test(h)) {
    return [
      "Initialize parent[] and rank[]",
      "for each union operation:",
      "    rootA = find(a); rootB = find(b)",
      "    if rootA != rootB: union by rank",
    ].join("\n");
  }

  if (/priority_queue|heap/i.test(h)) {
    return [
      "Use a heap/priority queue to store candidates",
      "Repeat until done: pop best candidate, process, and push neighbors if needed",
    ].join("\n");
  }

  if (/recursive|divide-and-conquer/i.test(h)) {
    return [
      "function solve(args):",
      "    if base case: return",
      "    split problem into subproblems",
      "    combine results from subproblems",
    ].join("\n");
  }

  // fallback generic pseudocode
  return [
    "Parse input",
    "Apply the main algorithmic idea inferred from the code",
    "Output the result",
  ].join("\n");
}

/**
 * Infer complexity conservatively from detected patterns.
 */
function inferComplexity(nestedLoop, hints) {
  if (nestedLoop)
    return "Time: O(n^2) (heuristic). Space: O(1) or as used in code.";
  if (hints.some((s) => /dynamic programming|dp/.test(s)))
    return "Time: depends on DP states (heuristic). Space: depends on DP storage.";
  if (hints.some((s) => /priority_queue|heap/.test(s)))
    return "Time: O(n log n) typical when using a heap (heuristic).";
  if (hints.some((s) => /recursive/.test(s)))
    return "Time: depends on recursion branching (heuristic).";
  return "Time: unknown (heuristic). Space: unknown (heuristic).";
}

/**
 * Collect edge-cases using small heuristics and patterns.
 */
function collectEdgeCases(snippet) {
  const cases = new Set(["empty input", "single element", "duplicates"]);
  // explicit zero-length checks
  if (
    /\bif\s*\(\s*n\s*==\s*0\s*\)/i.test(snippet) ||
    /\bif\s*\(\s*len\(/i.test(snippet)
  ) {
    cases.add("zero-length input / n == 0");
  }
  // negative values
  if (
    /\b<\s*0\b/.test(snippet) ||
    (/\bif\s*\(\s*arr\[/.test(snippet) && /\b<\s*0\b/.test(snippet))
  ) {
    cases.add("negative numbers present or handled");
  }
  // null / None / nullptr
  if (/\bnull\b|\bnullptr\b|\bNone\b/.test(snippet))
    cases.add("null / None handling");
  // recursion -> stack depth
  if (
    /\brecurs(e|ion)\b|function\s+\w+\(.*\)\s*{[\s\S]*\breturn\s+\w+\(/i.test(
      snippet
    ) ||
    /\breturn .* \w+\(.*\).*;/i.test(snippet)
  ) {
    cases.add("recursion -> watch stack depth / base cases");
  }
  // maps / unordered_map -> missing-key handling
  if (/\bunordered_map\b|\bmap<|std::map\b|\bdict\b/.test(snippet))
    cases.add("missing-key / map lookup handling");
  // integer overflow checks (small)
  if (/\bINT_MAX\b|\bLONG_MAX\b|overflow/i.test(snippet))
    cases.add("overflow risk (large values)");
  return Array.from(cases);
}

/**
 * Main exported function
 */
export async function generateApproach(code, filePath) {
  const snippet = typeof code === "string" ? code.slice(0, MAX_CODE_CHARS) : "";
  const ext = path
    .extname(filePath || "")
    .slice(1)
    .toLowerCase();
  const language = ext || "unknown";

  // top-of-file small sample for comment detection
  const topSample = snippet.split(/\r?\n/).slice(0, 40).join("\n");
  const topCommentRaw =
    (topSample.match(/(\/\*[\s\S]*?\*\/)|(^\/\/.*(\n\/\/.*){0,10})/m) || [
      null,
    ])[0] || "";
  const topComment = cleanTopComment(topCommentRaw);

  // hints
  const hints = [];
  if (rx(/\bsort\b|std::sort|Arrays\.sort|Collections\.sort/i, snippet))
    hints.push("sorting");
  if (rx(/\bswap\b|std::swap|\btemp\b|\btmp\b/i, snippet))
    hints.push("in-place swap");
  if (rx(/\bdfs\b|\bdepth-?first\b/i, snippet)) hints.push("DFS");
  if (rx(/\bbfs\b|\bbreadth-?first\b/i, snippet)) hints.push("BFS");
  if (rx(/\bdp\b|\bdynamic programming\b|memo/i, snippet))
    hints.push("dynamic programming");
  if (rx(/\bunion-?find\b|disjoint set|dsu\b/i, snippet))
    hints.push("union-find");
  if (rx(/\bpriority_queue\b|\bheap\b/i, snippet))
    hints.push("priority_queue / heap");
  if (rx(/\brecurs(e|ion)\b|\breturn .* \w+\(/i, snippet))
    hints.push("recursive");

  // nested loop detection (conservative)
  const nestedLoop =
    rx(/for\s*\(.*\)\s*{[^}]*for\s*\(.*\)\s*{/s, snippet) ||
    rx(/for .* in .*:\s*\n\s+for .* in .*:/, snippet);
  if (nestedLoop) hints.push("nested loops");

  // Infer a human-friendly title
  const problem = inferProblemTitle(hints, topComment);

  // Approach: combine top comment + heuristic summary
  const approachParts = [];
  if (topComment) approachParts.push(`Notes from file header:\n${topComment}`);
  const hintSummary = hints.length
    ? `Heuristic hints: ${hints.join(", ")}.`
    : "No strong heuristic hints found.";
  approachParts.push(hintSummary);
  if (nestedLoop)
    approachParts.push("Detected nested loops — main pass may be quadratic.");
  const approach = approachParts.join("\n\n");

  // Pseudocode
  const pseudocode = buildPseudocode(hints);

  // Complexity
  const complexity = inferComplexity(nestedLoop, hints);

  // Edge cases
  const edgeCases = collectEdgeCases(snippet);
  // Build examples (simple demonstration based on detected hints)
  let examples = [];

  if (hints.includes("sorting")) {
    examples = [
      {
        input: "5\n4 1 3 9 7",
        output: "1 3 4 7 9",
        note: "Demonstrates sorting ascending using the inferred algorithm.",
      },
    ];
  } else if (hints.includes("DFS")) {
    examples = [
      {
        input: "Graph: 1-2, 1-3, 2-4",
        output: "DFS order: 1 2 4 3",
        note: "Typical DFS traversal output.",
      },
    ];
  } else if (hints.includes("dynamic programming")) {
    examples = [
      {
        input: "n = 5 (Fibonacci)",
        output: "5",
        note: "DP example demonstrating bottom-up computation.",
      },
    ];
  }
  // Explanation Block ( Human Friendly )
  let explanation = "";

  if (
    /selection sort/i.test(problem) ||
    (hints.includes("sorting") &&
      hints.includes("in-place swap") &&
      hints.includes("nested loops"))
  ) {
    explanation = [
      "Selection Sort works by repeatedly picking the smallest element from the unsorted portion and placing it at the front.",
      "",
      "● **Why it does n−1 swaps:**",
      "   Only one swap happens per outer loop iteration — putting the chosen minimum into its correct place.",
      "   Even if the element is already in the right place, that's still at most 1 swap per iteration → worst case n−1 swaps.",
      "",
      "● **Why comparisons are O(n²):**",
      "   For each index i, you scan the remaining part of the array to find the minimum.",
      "   That means:",
      "      (n−1) + (n−2) + (n−3) + ... + 1 comparisons.",
      "   This forms an arithmetic series equal to n(n−1)/2 → O(n²).",
      "",
      "● **Key intuition:**",
      "   Selection Sort minimizes swaps but does a full scan for every position, making it consistently quadratic.",
    ].join("\n");
  } else if (hints.includes("DFS")) {
    explanation =
      "DFS explores as deep as possible along each branch before backtracking. Useful for tree/graph traversal, component detection, and path exploration.";
  } else if (hints.includes("dynamic programming")) {
    explanation =
      "Dynamic Programming solves problems by breaking them into overlapping subproblems and storing results to avoid recomputation.";
  }

  // Code output safe
  const codeOut =
    code.length > MAX_CODE_CHARS
      ? code.slice(0, MAX_CODE_CHARS) + "\n/* TRUNCATED */"
      : code;

  // Final result matching spec (title has no extension)
  const title = path.basename(filePath || "unknown").replace(/\.[^/.]+$/, "");

  return {
    title,
    language,
    problem,
    approach,
    pseudocode,
    complexity,
    edgeCases,
    examples,
    explanation,
    code: codeOut,
  };
}
