import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";

dotenv.config();

const app = express();
// Allow all origins (for dev only)
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase request body size if needed
app.set("timeout", 60000); // Set 1-minute timeout for long-running requests

// 🧩 Extract JSON safely from AI response
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");

  return JSON.parse(match[0]);
}

// 🧩 Save/retrieve last reviewed PR info
function getLastReviewedShas() {
  try {
    return JSON.parse(fs.readFileSync(".last_pr_sha.json", "utf-8"));
  } catch {
    return {};
  }
}

function saveLastReviewedSha(owner, repo, prNumber, commitSha) {
  const data = getLastReviewedShas();
  const key = `${owner}/${repo}#${prNumber}`;
  data[key] = commitSha;
  fs.writeFileSync(".last_pr_sha.json", JSON.stringify(data, null, 2));
}

function parseAddedLines(patch) {
  const lines = patch.split(/\r?\n/);
  const result = [];
  let currentLineNum = 0;

  for (const raw of lines) {
    const hunkMatch = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLineNum = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      const code = raw.slice(1);
      result.push({ line: currentLineNum, code });
      currentLineNum++;
    } else if (!raw.startsWith("-")) {
      currentLineNum++;
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

    // 🧩 Fetch PR
    if (pull_number) {
      const { data } = await octokit.pulls.get({ owner, repo, pull_number });
      pr = data;
    } else {
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

    // 🧩 Load & check last reviewed SHA per PR
    const lastShas = getLastReviewedShas();
    const key = `${owner}/${repo}#${pr.number}`;
    const lastReviewedSha = lastShas[key];

    if (lastReviewedSha === latestSha) {
      return res.json({ message: "No new commits to review — skipping." });
    }

    let files = [];
    let commitsSummary = [];

    // 🧩 If previously reviewed, compare commits from last reviewed SHA
    if (lastReviewedSha) {
      console.log(
        `🔍 Comparing commits from ${lastReviewedSha.slice(
          0,
          7
        )} → ${latestSha.slice(0, 7)}`
      );

      const { data: compare } = await octokit.repos.compareCommits({
        owner,
        repo,
        base: lastReviewedSha,
        head: latestSha,
      });

      files = compare.files || [];
      commitsSummary = compare.commits.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0],
      }));

      console.log(`📜 Found ${compare.commits.length} new commits:`);
      for (const c of commitsSummary) {
        console.log(`   • ${c.sha} — ${c.message}`);
      }

      console.log(`📂 ${files.length} files changed since last review`);
    } else {
      // 🆕 First-time review → review all files
      const { data: allFiles } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
      });
      files = allFiles;
      console.log(`🆕 First review — reviewing all ${files.length} PR files`);
    }

    // 🧩 No files changed
    if (!files.length) {
      saveLastReviewedSha(owner, repo, pr.number, latestSha);
      return res.json({ message: "✅ No changed files since last review." });
    }

    const allComments = [];

    // 🧠 Loop through changed files
    for (const file of files) {
      if (!file.patch) continue;
      console.log(`🧠 Reviewing file: ${file.filename}`);

      const prompt = `
      You are a professional code reviewer analyzing a GitHub pull request diff.

      You are reviewing a code patch in unified diff format.

      Your task:
        1. Parse the diff carefully.
        2. Identify every line that begins with '+'.
        3. Count each '+' line in order to determine line numbers for the new file.
        4. For each such line, produce a JSON object { file, line, comment }.
        5. Only include meaningful comments (no "looks good" filler).
        6. Use this function for reference:
        function parseAddedLines(patch) {
          const lines = patch.split(/\\r?\\n/);
          const result = [];
          let addedLineCount = 0;
          for (const raw of lines) {
            if (raw.startsWith("+") && !raw.startsWith("+++")) {
              const code = raw.slice(1);
              addedLineCount++;
              result.push({ line: addedLineCount, code });
            }
          }
          return result;
        }

      Respond strictly in JSON:
      [
        {
          "file": "${file.filename}",
          "line": <line number>,
          "comment": "Your feedback or suggestion"
        }
      ]

      Patch:
      ${file.patch}
      `;

      try {
        const response = await openai.chat.completions.create({
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        });
        const aiComments = extractJSON(response.choices[0].message.content);
        const addedLines = parseAddedLines(file.patch);

        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;

          let realLineEntry = addedLines[c.line - 1];
          if (!realLineEntry) {
            for (let offset = -3; offset <= 3; offset++) {
              const nearby = addedLines[c.line - 1 + offset];
              if (nearby) {
                realLineEntry = nearby;
                break;
              }
            }
          }

          if (!realLineEntry) continue;

          const contextStart = Math.max(0, c.line - 3);
          const contextEnd = Math.min(addedLines.length, c.line + 2);
          const context = addedLines
            .slice(contextStart, contextEnd)
            .map((l) => l.code)
            .join("\n");

          const body = `\`\`\`js
${context}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}`;

          allComments.push({
            path: file.filename,
            line: realLineEntry.line,
            side: "RIGHT",
            body,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
      }
    }

    // 🧩 If no AI comments → simple message instead of approval
    if (!allComments.length) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — PR looks good!",
        event: "APPROVE",
      });
      saveLastReviewedSha(owner, repo, pr.number, latestSha);
      return res.json({ message: "✅ No issues found." });
    }

    console.log(`💬 Found ${allComments.length} review comments — posting...`);

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      commit_id: latestSha,
      body: "🤖 AI Review completed — see inline comments below.",
      event: "COMMENT",
      comments: allComments,
    });

    // 🧩 Save latest reviewed SHA
    saveLastReviewedSha(owner, repo, pr.number, latestSha);

    res.json({
      message: "✅ AI Review completed.",
      comments: allComments.length,
      commitsReviewed: commitsSummary,
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 AI Reviewer running on port ${PORT}`));
