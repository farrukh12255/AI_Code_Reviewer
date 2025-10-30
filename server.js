import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

// 🧩 Extract JSON safely from AI response
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

// 🧩 Extract added lines and line numbers
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

// 🧩 Fetch file content from GitHub
async function getFileLines(octokit, owner, repo, path, ref) {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return content.split("\n");
}

// 🧩 Extract added lines with line numbers
function extractAddedLinesWithContext(patch) {
  const lines = patch.split("\n");
  const result = [];
  let oldLine = 0,
    newLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = /@@ -(\d+),?\d* \+(\d+),?\d* @@/.exec(line);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
    } else if (line.startsWith("+") && !line.startsWith("++")) {
      result.push({ code: line.substring(1), line: newLine });
      newLine++;
    } else if (!line.startsWith("-")) {
      oldLine++;
      newLine++;
    }
  }

  return result;
}

// 🚀 Main review endpoint
app.post("/review", async (req, res) => {
  const { githubToken, googleKey, owner, repo, pull_number } = req.body;
  if (!githubToken || !googleKey || !owner || !repo)
    return res.status(400).json({ error: "Missing required parameters" });

  const octokit = new Octokit({ auth: githubToken });
  const openai = new OpenAI({
    apiKey: googleKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  try {
    let pr;

    if (pull_number) {
      // ✅ Use provided PR number
      const { data } = await octokit.pulls.get({ owner, repo, pull_number });
      pr = data;
    } else {
      // 🧩 Fallback: get latest open PR
      const { data: prs } = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
        sort: "created",
        direction: "desc",
        per_page: 1,
      });
      if (!prs.length) throw new Error("No open pull requests found.");
      pr = prs[0];
    }

    const latestSha = pr.head.sha;
    const last = getLastReviewedSha();

    // Uncomment to skip already reviewed PRs
    // if (last.prNumber === pr.number && last.commitSha === latestSha)
    //   return res.json({ message: "PR already reviewed." });

    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    for (const file of files) {
      if (!file.patch) continue;

      console.log(`🧠 Reviewing file: ${file.filename}`);

      const prompt = `
      You are a professional code reviewer analyzing a GitHub pull request diff.

      Rules:
      - Focus only on ADDED (right-hand side) lines.
      - If code was REMOVED without a replacement, ask why.
      - Identify logic gaps, missing error handling, or potential bugs.
      - Avoid trivial comments (like formatting or naming).
      
      Respond strictly in JSON:
      [
        { "file": "${file.filename}", "line": <added line number>, "comment": "Your feedback" }
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
        const addedLines = extractAddedLinesWithContext(file.patch);

        const fileLines = await getFileLines(
          octokit,
          owner,
          repo,
          file.filename,
          latestSha
        );

        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;
          const match = addedLines.find((l) => l.line === c.line);
          if (!match) continue;

          // Grab 4 lines of context around comment
          const idx = addedLines.indexOf(match);
          const contextStart = Math.max(0, idx - 4);
          const contextEnd = Math.min(addedLines.length, idx + 5);
          const contextLines = addedLines
            .slice(contextStart, contextEnd)
            .map((l) => l.code.trim())
            .join("\n");

          const body = `\`\`\`js
${contextLines}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}`;

          allComments.push({
            path: file.filename,
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
