// src/notion.js
import { Client } from "@notionhq/client";

/**
 * Map file extension / language hints to Notion code block language names.
 * Add mappings here as needed.
 */
function mapToNotionLanguage(langHint) {
  if (!langHint || typeof langHint !== "string") return "plain text";
  const s = langHint.toLowerCase().trim();

  // common mappings
  const map = {
    js: "javascript",
    javascript: "javascript",
    ts: "typescript",
    typescript: "typescript",
    py: "python",
    python: "python",
    cpp: "c++",
    "c++": "c++",
    c: "c",
    java: "java",
    "c#": "c#",
    cs: "c#",
    php: "php",
    rb: "ruby",
    ruby: "ruby",
    go: "go",
    golang: "go",
    rs: "rust",
    rust: "rust",
    sql: "sql",
    sh: "shell",
    bash: "bash",
    ps1: "powershell",
    powershell: "powershell",
    html: "html",
    css: "css",
    json: "json",
    xml: "xml",
    md: "markdown",
    markdown: "markdown",
    plain: "plain text",
    text: "plain text",
    txt: "plain text",
    swift: "swift",
    kotlin: "kotlin",
    scala: "scala",
    r: "r",
    dart: "dart",
    makefile: "makefile",
    dockerfile: "docker",
  };

  if (map[s]) return map[s];

  // Some fuzzier matches
  if (s.includes("c++") || s.includes("cpp")) return "c++";
  if (s.includes("c#") || s.includes("csharp")) return "c#";
  if (s.includes("python") || s === "py") return "python";
  if (s.includes("js") || s.includes("javascript")) return "javascript";
  if (s.includes("ts") || s.includes("typescript")) return "typescript";
  if (s.includes("java")) return "java";
  if (s.includes("html")) return "html";
  if (s.includes("json")) return "json";
  if (s.includes("xml")) return "xml";
  if (s.includes("sql")) return "sql";

  // fallback
  return "plain text";
}

/**
 * Convert fixture object to Notion child blocks.
 * Uses correct Notion API shapes:
 * - heading/paragraph/bulleted_list_item use `rich_text`
 * - code blocks use `rich_text` inside `code` and valid `language` names
 */
function fixtureToBlocks(fx) {
  const blocks = [];
  const notionLang = mapToNotionLanguage(fx.language);

  // Problem title as H1
  blocks.push({
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: [
        {
          type: "text",
          text: { content: fx.problem || fx.title || "Code Note" },
        },
      ],
    },
  });

  // Short approach line (first paragraph)
  if (fx.approach) {
    const firstLine = (fx.approach.split("\n")[0] || "").slice(0, 200);
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: firstLine } }],
      },
    });
  }

  // Approach full
  if (fx.approach) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Approach" } }],
      },
    });
    const paras = fx.approach.split(/\n\s*\n/);
    paras.forEach((p) => {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: p } }] },
      });
    });
  }

  // Pseudocode
  if (fx.pseudocode) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Pseudocode" } }],
      },
    });
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: fx.pseudocode } }],
        language: notionLang, // use mapped language for pseudocode; usually plain text or code language
      },
    });
  }

  // Complexity
  if (fx.complexity) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Complexity" } }],
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: fx.complexity } }],
      },
    });
  }

  // Edge cases as bullets
  if (Array.isArray(fx.edgeCases) && fx.edgeCases.length) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Edge cases" } }],
      },
    });
    fx.edgeCases.forEach((ec) => {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: ec } }],
        },
      });
    });
  }

  // Examples
  if (Array.isArray(fx.examples) && fx.examples.length) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Examples" } }],
      },
    });

    fx.examples.forEach((ex, idx) => {
      // Example input
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [
            { type: "text", text: { content: `Example ${idx + 1} — input` } },
          ],
        },
      });
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: ex.input || "" } }],
          language: notionLang,
        },
      });

      // Example output
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [
            { type: "text", text: { content: `Example ${idx + 1} — output` } },
          ],
        },
      });
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: ex.output || "" } }],
          language: "plain text",
        },
      });

      if (ex.note) {
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: ex.note } }],
          },
        });
      }
    });
  }

  // Explanation (split into paragraphs)
  if (fx.explanation) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Explanation" } }],
      },
    });
    const paras = fx.explanation.split(/\n\s*\n/);
    paras.forEach((p) => {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: p } }] },
      });
    });
  }

  // Full solution code
  if (fx.code) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Solution (code)" } }],
      },
    });
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: fx.code } }],
        language: notionLang,
      },
    });
  }

  return blocks;
}

/**
 * Post a fixture object to Notion as a child page.
 * Returns the created page object (as returned by Notion).
 */
export async function postFixtureToNotion(fixture) {
  const token = process.env.NOTION_TOKEN;
  const parent = process.env.NOTION_PARENT_PAGE_ID;
  if (!token || !parent) {
    throw new Error(
      "Set NOTION_TOKEN and NOTION_PARENT_PAGE_ID env vars to post to Notion."
    );
  }

  const notion = new Client({ auth: token });
  const children = fixtureToBlocks(fixture);

  const res = await notion.pages.create({
    parent: { page_id: parent },
    properties: {
      title: {
        title: [
          {
            type: "text",
            text: { content: fixture.title || fixture.problem || "Code Note" },
          },
        ],
      },
    },
    children,
  });

  return res;
}
