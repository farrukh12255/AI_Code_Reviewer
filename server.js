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

function parseAddedLines(patch) {
  const lines = patch.split(/\r?\n/);
  const result = [];
  let currentLineNum = 0;

  for (const raw of lines) {
    // detect hunk header, e.g. @@ -23,7 +23,8 @@
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
      // context line, advance counter
      currentLineNum++;
    }
  }

  return result;
}

// 🧩 Fetch file content from GitHub
async function getFileLines(octokit, owner, repo, path, ref) {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return content.split("\n");
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

    // 🧩 Compare current PR head with last reviewed commit
    const latestSha = pr.head.sha;
    const last = getLastReviewedSha();

    // 🧩 If PR was already reviewed and no new commit, skip review
    if (last.prNumber === pr.number && last.commitSha === latestSha) {
      return res.json({ message: "✅ No new commits to review — skipping." });
    }

    let files = [];

    // 🧩 If we have a previous commit, compare commits to find changed files
    if (last.prNumber === pr.number && last.commitSha) {
      const { data: compare } = await octokit.repos.compareCommits({
        owner,
        repo,
        base: last.commitSha,
        head: latestSha,
      });
      files = compare.files || [];
      console.log(`📂 Found ${files.length} changed files since last review`);
    } else {
      // 🧩 First review — review all PR files
      const { data: allFiles } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
      });
      files = allFiles;
      console.log(`📂 Reviewing all ${files.length} PR files (first review)`);
    }

    // 🧩 Skip if no files changed
    if (!files.length) {
      saveLastReviewedSha(pr.number, latestSha);
      return res.json({ message: "✅ No changed files since last review." });
    }

    const allComments = [];

    for (const file of files) {
      if (!file.patch) continue;

      console.log(`🧠 Reviewing file: ${file.filename}`);

      const prompt = `
      You are a professional code reviewer analyzing a GitHub pull request diff.

      You are reviewing a code patch in unified diff format.

      Your task:
        1. Parse the diff carefully.
        2. Identify every line in the diff that begins with a '+'.
        3. Count each '+' line in the order it appears to determine the line numbers for the new file.
        4. For every such line, produce a JSON object with file, line, and comment.
        5. Use this helper to reason about added lines:
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
        6. Only include comments for lines that need feedback.

      Respond strictly in JSON:
      [
        {
          "file": "${file.filename}",
          "line": <line number in new file>,
          "comment": "Your feedback or question"
        }
      ]
      Only count lines starting with '+' when deciding line numbers.

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
