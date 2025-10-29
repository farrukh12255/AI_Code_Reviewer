import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import { execSync } from "child_process";

dotenv.config();

const app = express();
app.use(express.json());

// 🧩 Helper: Extract JSON safely from AI response
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

// 🧩 Save and read last reviewed PR
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

// 🧩 Extract added lines from patch
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

// 🚀 API endpoint: /review
app.post("/review", async (req, res) => {
  const { githubToken, googleKey, owner, repo } = req.body;

  if (!githubToken || !googleKey || !repo || !owner) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const octokit = new Octokit({ auth: githubToken });
  const openai = new OpenAI({
    apiKey: googleKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {
    // 🔍 Get latest PR
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
    const latestRemoteSha = pr.head.sha;
    const last = getLastReviewedSha();

    if (last.prNumber === pr.number && last.commitSha === latestRemoteSha) {
      console.log("🕒 PR already reviewed — skipping duplicate run.");
      return res.json({ message: "PR already reviewed." });
    }

    // Get changed files
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    // Loop over changed files
    for (const file of files) {
      if (!file.patch) continue;

      const reviewPrompt = `
You are a strict code reviewer. Analyze ONLY the added lines in this patch.

Focus on:
- Potential bugs or inefficiencies
- Unnecessary console.log/debugger statements
- Async or missing error handling
- Code smell or redundant logic
- Try to use latest version of code implementaion

Output JSON only:
[
  { "file": "${file.filename}", "line": 12, "comment": "Example issue" }
]

Patch:
${file.patch}
`;

      console.log(`🧠 Analyzing ${file.filename}...`);

      try {
        const response = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: reviewPrompt }],
        });

        const content = response.choices[0].message.content;
        const aiComments = extractJSON(content);
        const addedLines = extractAddedLines(file.patch);
        console.log("addedLines: ", addedLines);

        // Merge AI comments with actual line content
        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;
          const match = addedLines.find((l) => l.line === c.line);
          if (!match) continue;

          const body = `\`\`\`js
${match.code.trim()}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}`;

          allComments.push({
            path: c.file || file.filename,
            line: match.line,
            side: "RIGHT",
            body,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
      }
    }

    if (!allComments.length) {
      console.log("✅ No issues found — approving PR.");
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — PR looks clean!",
        event: "APPROVE",
      });
      saveLastReviewedSha(pr.number, latestRemoteSha);
      return res.json({ message: "✅ PR approved — no issues found." });
    }

    console.log(`💬 Found ${allComments.length} issues — posting review...`);

    // Post all comments
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      commit_id: latestRemoteSha,
      body: "🤖 AI Review completed — see inline comments below.",
      event: "COMMENT",
      comments: allComments,
    });

    saveLastReviewedSha(pr.number, latestRemoteSha);
    console.log("✅ Review completed successfully!");
    res.json({
      message: "✅ AI review completed.",
      totalComments: allComments.length,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🧭 Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 AI Reviewer running on port ${PORT}`));
