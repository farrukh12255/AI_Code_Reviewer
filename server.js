import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai"; // still used as Gemini wrapper
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

/* 🧠 Utility: Extract JSON safely from AI response */
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

/* 💾 Manage last reviewed PR commit */
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

/* 🧩 Extract added/removed lines from patch */
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

/* 🚀 Endpoint: POST /review */
app.post("/review", async (req, res) => {
  const { githubToken, googleKey, owner, repo } = req.body;

  if (!githubToken || !googleKey || !owner || !repo) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // 🔑 Initialize clients
  const octokit = new Octokit({ auth: githubToken });
  const openai = new OpenAI({
    apiKey: googleKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {
    /* 1️⃣ Get latest open PR */
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

    // 🕒 Skip duplicate reviews
    if (last.prNumber === pr.number && last.commitSha === latestSha) {
      console.log("⏸️ PR already reviewed — skipping duplicate run.");
      return res.json({ message: "PR already reviewed." });
    }

    /* 2️⃣ Identify if reviewer == PR author */
    const { data: me } = await octokit.rest.users.getAuthenticated();
    const isSelfReview = pr.user.login === me.login;

    /* 3️⃣ Collect changed files */
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    /* 4️⃣ Analyze each changed file */
    for (const file of files) {
      if (!file.patch) continue;

      const { added, removed } = extractChangedLines(file.patch);

      const reviewPrompt = `
You are a **strict senior code reviewer**.

### Review Guidelines:
- Focus on both added (right) and deleted (left) code.
- If a deleted line looks important, ask “Why was this removed?”
- For added code:
  - Disallow console.log, debugger, or commented-out code.
  - Check for unclear variable names.
  - Check missing async/await or try/catch.
  - Flag unused variables or functions.
  - Enforce good naming (camelCase, PascalCase).
  - Ensure modern and optimized implementation.
- Comment **only where necessary**, not on unchanged lines.

### Output strictly JSON:
[
  { "file": "filename.js", "line": 123, "comment": "Issue description" }
]

Patch:
${file.patch}
`;

      console.log(`🧠 Reviewing file: ${file.filename}...`);

      try {
        // 🔍 Call Gemini (via OpenAI wrapper)
        const response = await openai.chat.completions.create({
          model: "gemini-2.0-flash", // Gemini model via Google API
          messages: [{ role: "user", content: reviewPrompt }],
          temperature: 0.2,
        });

        const content = response.choices[0].message.content;
        const aiComments = extractJSON(content);

        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 3) continue;

          const target =
            added.find((l) => l.line === c.line) ||
            removed.find((l) => l.line === c.line);
          if (!target) continue;

          const side = added.includes(target) ? "RIGHT" : "LEFT";
          const body = `\`\`\`js
${target.code.trim()}
\`\`\`
💡 **AI Review:** ${c.comment.trim()}`;

          allComments.push({
            path: c.file || file.filename,
            line: target.line,
            side,
            body,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
      }
    }

    /* 5️⃣ Post comments or approval */
    if (allComments.length === 0) {
      // 🟢 If no issues found and reviewer ≠ PR author → approve
      if (!isSelfReview) {
        await octokit.pulls.createReview({
          owner,
          repo,
          pull_number: pr.number,
          body: "🤖 AI Review: No issues found — looks great!",
          event: "APPROVE",
        });
        console.log("✅ PR approved successfully!");
      } else {
        // 🟡 If self-review → just comment (cannot approve own PR)
        await octokit.pulls.createReview({
          owner,
          repo,
          pull_number: pr.number,
          body: "🤖 AI Review: No issues found. (Skipped approval — self-review)",
          event: "COMMENT",
        });
        console.log("🗨️ Self-review: Commented instead of approving.");
      }

      saveLastReviewedSha(pr.number, latestSha);
      return res.json({
        message: isSelfReview
          ? "🗨️ Self-review done — comment only."
          : "✅ PR approved — clean code!",
      });
    }

    // 📝 If there are issues, always comment
    console.log(`💬 Found ${allComments.length} issues — posting review...`);
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
      message: "✅ Review completed with comments.",
      totalComments: allComments.length,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* 🧭 Start server */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 AI Reviewer (Gemini + Strict Mode) running on port ${PORT}`)
);
