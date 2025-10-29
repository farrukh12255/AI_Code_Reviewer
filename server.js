import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

// 🧠 Utility: Safe JSON extraction from AI
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

// 🧩 Save/retrieve last reviewed SHA
function getLastReviewedSha() {
  try {
    return JSON.parse(fs.readFileSync(".last_pr_sha.json", "utf-8"));
  } catch {
    return {};
  }
}
function saveLastReviewedSha(prNumber, commitSha) {
  fs.writeFileSync(
    ".last_pr_sha.json",
    JSON.stringify({ prNumber, commitSha }, null, 2)
  );
}

// 🧩 Extract changed lines from patch
function extractChangedLines(patch) {
  const added = [];
  const removed = [];
  const lines = patch.split("\n");

  let currentLine = 0;
  let inHunk = false;

  for (const l of lines) {
    if (l.startsWith("@@")) {
      const match = l.match(/\+(\d+)(?:,(\d+))?/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
        inHunk = true;
      }
      continue;
    }
    if (!inHunk) continue;

    if (l.startsWith("+") && !l.startsWith("+++")) {
      currentLine++;
      added.push({ line: currentLine, code: l.slice(1) });
    } else if (l.startsWith("-") && !l.startsWith("---")) {
      removed.push({ line: currentLine, code: l.slice(1) });
    } else {
      currentLine++;
    }
  }
  return { added, removed };
}

// 🚀 Main review endpoint
app.post("/review", async (req, res) => {
  const { githubToken, openaiKey, owner, repo } = req.body;

  if (!githubToken || !openaiKey || !owner || !repo) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const octokit = new Octokit({ auth: githubToken });
  const openai = new OpenAI({ apiKey: openaiKey });

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
    const latestSha = pr.head.sha;
    const last = getLastReviewedSha();

    if (last.prNumber === pr.number && last.commitSha === latestSha) {
      console.log("⏸️ PR already reviewed — skipping duplicate run.");
      return res.json({ message: "PR already reviewed." });
    }

    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    for (const file of files) {
      if (!file.patch) continue;

      const { added, removed } = extractChangedLines(file.patch);

      const reviewPrompt = `
You are a **strict senior code reviewer**.

### Review Guidelines:
- Focus on new (right) and deleted (left) lines.
- If deleted code seems useful or functional, ask: “Why was this removed?”
- For added lines:
  - Ban: console.log, debugger, alert, commented-out code
  - Flag unclear variable/function names
  - Check for missing async/await or try/catch
  - Flag security risks or unused variables
  - Check naming conventions (camelCase, PascalCase)
- Comment precisely on the changed line.

### Output strictly JSON array:
[
  { "file": "filename.js", "line": 123, "comment": "Issue description" }
]

Here’s the patch:
${file.patch}
`;

      console.log(`🔍 Reviewing ${file.filename}...`);

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: reviewPrompt }],
          temperature: 0.2,
        });

        const content = response.choices[0].message.content;
        const aiComments = extractJSON(content);

        // match comments to actual added lines
        for (const c of aiComments) {
          const target =
            added.find((l) => l.line === c.line) ||
            removed.find((l) => l.line === c.line);
          if (!c.comment || !target) continue;

          const body = `\`\`\`js
${target.code.trim()}
\`\`\`
💡 **AI Review:** ${c.comment.trim()}`;

          allComments.push({
            path: c.file || file.filename,
            line: target.line,
            side: added.includes(target) ? "RIGHT" : "LEFT",
            body,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
      }
    }

    // ✅ Post review
    if (allComments.length === 0) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — looks great!",
        event: "APPROVE",
      });
      saveLastReviewedSha(pr.number, latestSha);
      return res.json({ message: "✅ PR approved — clean code!" });
    }

    console.log(`💬 Posting ${allComments.length} comments...`);
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      commit_id: latestSha,
      body: "🤖 **Strict AI Review Completed** — see inline comments below.",
      event: "COMMENT",
      comments: allComments,
    });

    saveLastReviewedSha(pr.number, latestSha);
    console.log("✅ Review posted successfully!");
    res.json({
      message: "✅ Review completed.",
      totalComments: allComments.length,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 AI Reviewer (Strict Mode) running on port ${PORT}`)
);
