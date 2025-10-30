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

// 🧩 Extract added line blocks + line numbers
function extractAddedBlocks(patch) {
  const blocks = [];
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
        currentBlock = { start: newLine, lines: [], lineNumbers: [] };
      }
      currentBlock.lines.push(l.replace(/^\+/, ""));
      currentBlock.lineNumbers.push(newLine);
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

// 🧩 Map AI line number to diff position
function findDiffLinePosition(patch, targetLine) {
  const lines = patch.split("\n");
  let newLine = 0;

  for (const l of lines) {
    if (l.startsWith("@@")) {
      const match = l.match(/\+(\d+)/);
      newLine = match ? parseInt(match[1], 10) - 1 : newLine;
    } else if (l.startsWith("+") && !l.startsWith("+++")) {
      newLine++;
      if (newLine === targetLine) return newLine;
    } else if (!l.startsWith("-")) {
      newLine++;
    }
  }
  return null;
}

// 🧩 Fetch actual file content from GitHub
async function getFileLines(octokit, owner, repo, path, ref) {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return content.split("\n");
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
    // Get latest open PR
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
    // if (last.prNumber === pr.number && last.commitSha === latestSha)
    //   return res.json({ message: "PR already reviewed." });

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
      You are a professional code reviewer analyzing a GitHub pull request diff.
      
      Rules:
      - Focus only on the ADDED (right-hand side) lines of code — ignore removed ones.
      - If you notice that some code was REMOVED without replacement or improvement, ask: 
        "Why was this code removed? It seems necessary or has no alternative added."
      - Point out logic gaps, missing error handling, potential bugs, or removed validations.
      - Avoid trivial comments (e.g., formatting, naming unless confusing).
      
      Respond strictly in JSON:
      [
        { "file": "${file.filename}", "line": <EXACT added or removed line number>, "comment": "Your feedback or question" }
      ]
      
      Patch:
      ${file.patch}
      `;

      try {
        const response = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: prompt }],
        });

        const aiComments = extractJSON(response.choices[0].message.content);
        const addedBlocks = extractAddedBlocks(file.patch);
        const patchLines = file.patch.split("\n");

        // 🧠 Fetch actual file content
        const fileLines = await getFileLines(
          octokit,
          owner,
          repo,
          file.filename,
          latestSha
        );

        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;

          const block = addedBlocks.find(
            (b) => c.line >= b.start && c.line <= b.end
          );
          if (!block) continue;

          const commentLine =
            c.line >= block.start && c.line <= block.end
              ? c.line
              : block.lineNumbers?.[0] || block.start;

          // 🧩 Real code snippet from actual file
          const start = Math.max(0, commentLine - 3);
          const end = Math.min(fileLines.length, commentLine + 3);
          const snippet = fileLines.slice(start, end).join("\n");

          const body = `
\`\`\`js
${snippet}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}
`;

          allComments.push({
            path: c.file || file.filename,
            line: commentLine,
            side: "RIGHT",
            body,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
      }
    }

    // 🟩 Post review
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
      body: "🤖 AI Review completed — see inline comments below.",
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
