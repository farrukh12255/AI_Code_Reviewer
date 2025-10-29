import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

// 🧩 Extract JSON safely from Gemini response
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

// 🧩 Save/retrieve last reviewed PR info
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

// 🧩 Extract changed (added/deleted) lines with exact line references
// 🧩 Extract added line *blocks* for better context

function extractAddedBlocks(patch) {
  const blocks = [];
  console.log("blocks: ", blocks);
  const lines = patch.split("\n");
  let newLine = 0;
  let currentBlock = null;

  for (const l of lines) {
    if (l.startsWith("@@")) {
      const match = l.match(/\+(\d+)/);
      newLine = match ? parseInt(match[1], 10) - 1 : newLine;
    } else if (l.startsWith("+") && !l.startsWith("+++")) {
      newLine++;
      if (!currentBlock) {
        currentBlock = { start: newLine, lines: [] };
      }
      currentBlock.lines.push(l.replace(/^\+/, ""));
    } else {
      if (currentBlock) {
        blocks.push({ ...currentBlock, end: newLine });
        currentBlock = null;
      }
      if (!l.startsWith("-")) newLine++;
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

// 🚀 Main review endpoint
app.post("/review", async (req, res) => {
  const { githubToken, googleKey, owner, repo } = req.body;
  if (!githubToken || !googleKey || !owner || !repo)
    return res.status(400).json({ error: "Missing required parameters" });

  const octokit = new Octokit({ auth: githubToken });
  const openai = new OpenAI({
    apiKey: googleKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {
    // 🧩 Get latest open PR
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

    // 🧩 Check if PR already reviewed
    const last = getLastReviewedSha();
    if (last.prNumber === pr.number && last.commitSha === latestSha)
      return res.json({ message: "PR already reviewed." });

    // 🧩 Get changed files in PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    // 🧠 Loop through changed files
    for (const file of files) {
      if (!file.patch) continue;

      console.log(`🧠 Reviewing file: ${file.filename}`);

      const prompt = `
  You are a strict code reviewer.
  Analyze ONLY the added and deleted lines.
  Focus on:
  - Debug/console left in code
  - Poor variable names
  - Redundant logic
  - Async or missing error handling
  - Potential bugs or bad patterns
  
  Return JSON only:
  [
    { "file": "${file.filename}", "line": 10, "comment": "Your suggestion" }
  ]
  
  Patch:
  ${file.patch}
  `;

      try {
        // 🧠 Ask AI to review the patch
        const response = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: prompt }],
        });

        const aiComments = extractJSON(response.choices[0].message.content);
        const addedBlocks = extractAddedBlocks(file.patch);
        const patchLines = file.patch.split("\n");

        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;

          // Find block that matches this comment
          const block = addedBlocks.find(
            (b) => c.line >= b.start && c.line <= b.end
          );
          if (!block) continue;

          // 🧠 Capture all relevant changed lines (fix console.log missing issue)
          const blockStartIndex = patchLines.findIndex(
            (l) =>
              l.trim().startsWith("+") &&
              l.replace(/^\+/, "").trim() === block.lines[0].trim()
          );

          const blockEndIndex = patchLines.findLastIndex(
            (l) =>
              l.trim().startsWith("+") &&
              block.lines.some(
                (line) => l.replace(/^\+/, "").trim() === line.trim()
              )
          );

          const startIndex = Math.max(0, blockStartIndex - 4);
          const endIndex = Math.min(patchLines.length, blockEndIndex + 5);

          const context = patchLines.slice(startIndex, endIndex);

          // Only include +/- lines for diff clarity
          const diffBlock = context.filter((l) => /^[\+\-]/.test(l)).join("\n");

          // 🧩 Build the comment body
          const body = `
  \`\`\`diff
  ${diffBlock}
  \`\`\`
  
  💡 **AI Review:** ${c.comment.trim()}
  `;

          allComments.push({
            path: c.file || file.filename,
            line: block.start,
            side: "RIGHT",
            body,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
      }
    }

    // 🟩 Post the review
    if (!allComments.length) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — PR looks good!",
        event: "APPROVE",
      });
      saveLastReviewedSha(pr.number, latestSha);
      return res.json({ message: "✅ No issues found." });
    }

    console.log(`💬 Found ${allComments.length} issues — posting...`);

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      commit_id: latestSha,
      body: "🤖 AI Review completed — see inline comments.",
      event: "COMMENT",
      comments: allComments,
    });

    saveLastReviewedSha(pr.number, latestSha);
    res.json({
      message: "✅ AI Review completed.",
      comments: allComments.length,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 AI Reviewer running on port ${PORT}`));
