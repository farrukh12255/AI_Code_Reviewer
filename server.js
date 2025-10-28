import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import { execSync } from "child_process";

dotenv.config();
const app = express();
app.use(express.json());

// 🎯 Endpoint: POST /review
app.post("/review", async (req, res) => {
  const { githubToken, googleKey, repo, owner } = req.body;

  if (!githubToken || !googleKey || !repo || !owner) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const octokit = new Octokit({ auth: githubToken });
  const openai = new OpenAI({
    apiKey: googleKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  function extractJSON(text) {
    const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
    if (!match) throw new Error("No JSON found in AI response");
    return JSON.parse(match[0]);
  }

  function extractAddedLines(patch) {
    const added = [];
    const lines = patch.split("\n");
    let lineNumber = 0;
    for (const l of lines) {
      if (l.startsWith("@@")) {
        const match = l.match(/\+(\d+)/);
        lineNumber = match ? parseInt(match[1], 10) - 1 : lineNumber;
      } else if (l.startsWith("+") && !l.startsWith("+++")) {
        lineNumber++;
        added.push({ line: lineNumber, code: l.replace(/^\+/, "") });
      } else if (!l.startsWith("-")) {
        lineNumber++;
      }
    }
    return added;
  }

  try {
    // 🔍 Get latest open PR
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      sort: "created",
      direction: "desc",
      per_page: 1,
    });
    if (!prs.length) throw new Error("No open pull requests found.");

    const pr = prs[0];
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    for (const file of files) {
      if (!file.patch) continue;
      const prompt = `
You are a strict code reviewer. Analyze ONLY the added lines.

Focus on:
- Potential bugs or inefficiencies
- Missing async/error handling
- Code smell or redundant logic
- Modern JS improvements

Output JSON only:
[
  { "file": "${file.filename}", "line": 12, "comment": "Example issue" }
]

Patch:
${file.patch}`;

      const resAI = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: prompt }],
      });

      const aiComments = extractJSON(resAI.choices[0].message.content);
      const addedLines = extractAddedLines(file.patch);

      for (const c of aiComments) {
        const match = addedLines.find((l) => l.line === c.line);
        if (!match || !c.comment) continue;

        allComments.push({
          path: c.file || file.filename,
          line: match.line,
          side: "RIGHT",
          body: `\`\`\`js
${match.code.trim()}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}`,
        });
      }
    }

    if (!allComments.length) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — PR looks clean!",
        event: "APPROVE",
      });
      return res.json({ message: "✅ PR approved — no issues found." });
    }

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      body: "🤖 AI Review completed — see inline comments below.",
      event: "COMMENT",
      comments: allComments,
    });

    res.json({
      message: "✅ AI review completed.",
      issues: allComments.length,
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 AI Reviewer running on port ${PORT}`));
