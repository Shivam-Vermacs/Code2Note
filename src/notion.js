
import { Client } from "@notionhq/client";

function mapToNotionLanguage(langHint) {
  if (!langHint || typeof langHint !== "string") return "plain text";

  const s = langHint.toLowerCase().trim();

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

  if (s.includes("c++") || s.includes("cpp")) return "c++";
  if (s.includes("c#") || s.includes("csharp")) return "c#";
  if (s.includes("python") || s === "py") return "python";
  if (s.includes("js") || s.includes("javascript")) return "javascript";
  if (s.includes("ts") || s.includes("typescript")) return "typescript";
  if (s.includes("java")) return "java";

  return "plain text";
}

// Splits text into paragraph units based on blank lines.

function splitIntoParagraphs(text) {
  if (!text) return [];

  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Converts text into Notion paragraph blocks.

function createTextBlock(text) {
  if (!text) return [];

  return splitIntoParagraphs(text).map((para) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: para } }],
    },
  }));
}

// Converts a generated fixture into Notion-compatible blocks.
 
function fixtureToBlocks(fx) {
  const blocks = [];
  const notionLang = mapToNotionLanguage(fx.language);

 

  if (fx.metadata || fx.problem) {
    let metaText = "";

    if (fx.metadata) {
      const date = new Date(fx.metadata.generatedAt).toLocaleString();
      metaText = `Generated: ${date} | Mode: ${fx.metadata.mode} | Source: ${fx.metadata.sourceFile}`;
    }

    if (fx.problem && fx.problem !== "not inferred") {
      if (metaText) metaText += "\n\n";
      metaText += `Problem: ${fx.problem}`;
    }

    if (metaText) {
      blocks.push({
        object: "block",
        type: "callout",
        callout: {
          rich_text: [{ type: "text", text: { content: metaText } }],
          color: "blue_background",
        },
      });
    }
  }

  if (fx.approach) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Approach" } }],
      },
    });

    blocks.push(...createTextBlock(fx.approach));
  }

  if (fx.pseudocode) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Pseudocode" } }],
      },
    });

    const pseudocode = fx.pseudocode
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");

    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: pseudocode } }],
        language: "plain text",
      },
    });
  }

  if (fx.complexity) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Complexity" } }],
      },
    });

    blocks.push(...createTextBlock(fx.complexity));
  }

  if (Array.isArray(fx.edgeCases) && fx.edgeCases.length) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Edge Cases" } }],
      },
    });

    fx.edgeCases.forEach((ec) => {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: ec.trim() } }],
        },
      });
    });
  }

  if (Array.isArray(fx.examples) && fx.examples.length) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Examples" } }],
      },
    });

    fx.examples.forEach((ex, idx) => {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [
            { type: "text", text: { content: `Example ${idx + 1} — Input` } },
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

      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [
            { type: "text", text: { content: `Example ${idx + 1} — Output` } },
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

  if (fx.explanation) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [
          { type: "text", text: { content: "Detailed Explanation" } },
        ],
      },
    });

    blocks.push(...createTextBlock(fx.explanation));
  }

  if (fx.code) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Solution Code" } }],
      },
    });

    const maxCodeLength = 2000;
    if (fx.code.length > maxCodeLength) {
      const lines = fx.code.split("\n");
      let currentChunk = "";

      lines.forEach((line) => {
        if ((currentChunk + line + "\n").length > maxCodeLength) {
          blocks.push({
            object: "block",
            type: "code",
            code: {
              rich_text: [{ type: "text", text: { content: currentChunk } }],
              language: notionLang,
            },
          });
          currentChunk = `${line}\n`;
        } else {
          currentChunk += `${line}\n`;
        }
      });

      if (currentChunk.trim()) {
        blocks.push({
          object: "block",
          type: "code",
          code: {
            rich_text: [{ type: "text", text: { content: currentChunk } }],
            language: notionLang,
          },
        });
      }
    } else {
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: fx.code } }],
          language: notionLang,
        },
      });
    }
  }

  return blocks;
}

/**
 * Posts a fixture to Notion as a new page.
 */
export async function postFixtureToNotion(fixture) {
  const token = process.env.NOTION_TOKEN;
  const parent = process.env.NOTION_PARENT_PAGE_ID;

  if (!token || !parent) {
    throw new Error(
      "Set NOTION_TOKEN and NOTION_PARENT_PAGE_ID environment variables."
    );
  }

  const notion = new Client({ auth: token });
  const children = fixtureToBlocks(fixture);

  return notion.pages.create({
    parent: { page_id: parent },
    properties: {
      title: {
        title: [
          {
            type: "text",
            text: { content: fixture.title || "Code Note" },
          },
        ],
      },
    },
    children,
  });
}
