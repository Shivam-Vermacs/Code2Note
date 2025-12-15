
import Groq from "groq-sdk";
import path from "path";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function summarizeWithLLM(code, filePath) {
  const language = path.extname(filePath).slice(1) || "cpp";

  console.log("Stage 1: Analyzing algorithm");
  const analysis = await analyzeAlgorithm(code, language);

  console.log("Stage 2: Generating approach");
  const approach = await generateApproach(code, language, analysis);

  console.log("Stage 3: Computing complexity");
  const complexity = await analyzeComplexity(code, language, analysis);

  console.log("Stage 4: Generating explanation");
  const explanation = await generateExplanation(code, language, analysis);

  console.log("Stage 5: Finding edge cases");
  const edgeCases = await findEdgeCases(code, language, analysis);

  console.log("Stage 6: Generating examples");
  const examples = await generateExamples(code, language, analysis);

  const notes = {
    title: analysis.title,
    language,
    problem: analysis.problem,
    approach,
    pseudocode: analysis.pseudocode,
    complexity,
    edgeCases,
    examples,
    explanation,
    code,
  };

  return cleanupNotes(notes);
}

/**
 * Stage 1: Algorithm identification and problem understanding.
 * Produces structured reasoning, pseudocode, and a concise problem statement.
 */
async function analyzeAlgorithm(code, language) {
  const prompt = `You are a Computer Science Professor analyzing code.

CODE:
\`\`\`${language}
${code}
\`\`\`

Think step-by-step:
1. What algorithm/pattern do I see? (sorting, searching, DP, etc.)
2. What is the core problem being solved?
3. What are the main steps in pseudocode form?

Respond in JSON format:
{
  "reasoning": "Step-by-step analysis of what you observe",
  "algorithmType": "e.g., Binary Search, Selection Sort, Dynamic Programming",
  "title": "Short name (2-4 words)",
  "problem": "One sentence problem statement (max 100 chars)",
  "pseudocode": "1. Step one\\n2. Step two\\n3. Step three"
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are a CS professor analyzing algorithms. Think step-by-step. Use \\n for line breaks in JSON strings.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  return JSON.parse(completion.choices[0].message.content);
}

/**
 * Stage 2: Concise explanation of the algorithmic approach.
 * Optimized for clarity without repetition or tutorial-style verbosity.
 */
async function generateApproach(code, language, analysis) {
  const prompt = `You are a technical writer creating CONCISE algorithm explanations.

ALGORITHM TYPE: ${analysis.algorithmType}
PROBLEM: ${analysis.problem}

CODE:
\`\`\`${language}
${code}
\`\`\`

Write a BRIEF explanation of the approach in 2-3 SHORT paragraphs:
- Paragraph 1: What the algorithm does and key insight
- Paragraph 2: How it works step-by-step
- Paragraph 3: Why it's effective

CRITICAL RULES:
- Be concise, no repetition
- Use \\n\\n to separate paragraphs
- Focus on key ideas only

Return ONLY the approach text.`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are a technical writer. Be concise. Short paragraphs only.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 800,
  });

  return completion.choices[0].message.content.trim();
}

/**
 * Stage 3: Time and space complexity analysis.
 * Returns a compact summary without explanatory prose.
 */
async function analyzeComplexity(code, language, analysis) {
  const prompt = `You are an algorithm analyst computing time and space complexity.

ALGORITHM: ${analysis.algorithmType}

CODE:
\`\`\`${language}
${code}
\`\`\`

Respond in JSON:
{
  "reasoning": "Brief analysis",
  "timeComplexity": "O(?)",
  "spaceComplexity": "O(?)"
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are an algorithm analyst. Be precise and brief.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content);
  return `Time: ${result.timeComplexity}, Space: ${result.spaceComplexity}`;
}

/**
 * Stage 4: High-level walkthrough of the code.
 * Focuses on intent and structure rather than syntax.
 */
async function generateExplanation(code, language, analysis) {
  const prompt = `You are a code reviewer providing a brief walkthrough.

ALGORITHM: ${analysis.algorithmType}

CODE:
\`\`\`${language}
${code}
\`\`\`

Provide 2-3 short paragraphs:
- Setup
- Main logic flow
- Key implementation details

Use \\n\\n to separate paragraphs.
Return ONLY the explanation text.`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a code reviewer. Be brief. Skip obvious details.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 600,
  });

  return completion.choices[0].message.content.trim();
}

/**
 * Stage 5: Identification of realistic edge cases.
 */
async function findEdgeCases(code, language, analysis) {
  const prompt = `You are a QA tester identifying edge cases.

ALGORITHM: ${analysis.algorithmType}
PROBLEM: ${analysis.problem}

List 4-6 edge cases in JSON:
{
  "edgeCases": ["Case 1", "Case 2"]
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a QA tester. Be specific and concise.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.6,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content);
  return result.edgeCases || [];
}

/**
 * Stage 6: Example generation for illustration purposes.
 */
async function generateExamples(code, language, analysis) {
  const prompt = `You are a technical writer creating concrete examples.

ALGORITHM: ${analysis.algorithmType}
PROBLEM: ${analysis.problem}

Respond in JSON:
{
  "examples": [
    {
      "input": "Example input",
      "output": "Expected output",
      "note": "Brief note"
    }
  ]
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Create clear, concrete examples.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.5,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content);
  return result.examples || [];
}

/**
 * Enhances heuristic notes using focused LLM passes.
 * Only fields that benefit from prose generation are replaced.
 */
export async function enhanceWithLLM(heuristicNotes, code) {
  const language = heuristicNotes.language || "cpp";

  console.log("Enhancing heuristic notes with LLM");

  const analysis = {
    algorithmType: heuristicNotes.title,
    problem: heuristicNotes.problem,
    pseudocode: heuristicNotes.pseudocode,
  };

  const approach = await generateApproach(code, language, analysis);
  const explanation = await generateExplanation(code, language, analysis);
  const edgeCases = await findEdgeCases(code, language, analysis);

  return {
    ...heuristicNotes,
    approach,
    explanation,
    edgeCases: [...(heuristicNotes.edgeCases || []), ...edgeCases].slice(0, 6),
    code,
  };
}

/**
 * Normalizes whitespace and ensures structural consistency.
 */
function cleanupNotes(notes) {
  const normalizeText = (text) =>
    text ? text.replace(/\n{3,}/g, "\n\n").trim() : text;

  notes.title = notes.title?.trim();
  notes.problem = normalizeText(notes.problem);
  notes.approach = normalizeText(notes.approach);
  notes.pseudocode = normalizeText(notes.pseudocode);
  notes.complexity = normalizeText(notes.complexity);
  notes.explanation = normalizeText(notes.explanation);

  notes.edgeCases = Array.isArray(notes.edgeCases)
    ? notes.edgeCases.map(normalizeText).filter(Boolean)
    : [];

  notes.examples = Array.isArray(notes.examples)
    ? notes.examples
        .map((ex) => ({
          input: normalizeText(ex.input || ""),
          output: normalizeText(ex.output || ""),
          note: normalizeText(ex.note || ""),
        }))
        .filter((ex) => ex.input || ex.output)
    : [];

  return notes;
}

/**
 * Verifies basic LLM connectivity.
 */
export async function testLLMConnection() {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content:
            'Respond with JSON: {"status": "ok", "message": "Connected"}',
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response.status === "ok";
  } catch (error) {
    console.error("LLM connection test failed:", error.message);
    return false;
  }
}
