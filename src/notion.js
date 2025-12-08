// src/notion.js
import { Client } from "@notionhq/client";
import path from "path";

/**
 * Minimal Notion poster that creates a page under a parent page id.
 * Expects env: NOTION_TOKEN and NOTION_PARENT_PAGE_ID
 * Input: title string and markdown string OR children blocks array.
 */
export async function postToNotionFromMarkdown(title, markdown) {
  const token = process.env.NOTION_TOKEN;
  const parent = process.env.NOTION_PARENT_PAGE_ID;
  if (!token || !parent)
    throw new Error(
      "Set NOTION_TOKEN and NOTION_PARENT_PAGE_ID env vars to post to Notion."
    );

  const notion = new Client({ auth: token });

  // Very small markdown -> blocks converter could be added here.
  // For MVP keep markdown as a single paragraph block + a code block with the full code.
  const blocks = [
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        text: [{ type: "text", text: { content: markdown.slice(0, 2000) } }],
      },
    },
  ];

  const res = await notion.pages.create({
    parent: { page_id: parent },
    properties: {
      title: { title: [{ text: { content: title } }] },
    },
    children: blocks,
  });

  return res;
}
