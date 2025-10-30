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
  debugger;
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

// 🧩 Extract added lines with correct real line numbers from patch
function extractAddedLines(patchText) {
  const lines = patchText.split("\n");
  const addedLines = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Parse diff header like: @@ -40,6 +50,8 @@
    const hunkMatch = line.match(/^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[3], 10);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("++")) {
      addedLines.push({ code: line.slice(1), line: newLine });
      newLine++;
    } else if (line.startsWith("-") && !line.startsWith("--")) {
      oldLine++;
    } else {
      oldLine++;
      newLine++;
    }
  }

  return addedLines;
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

    const latestSha = pr.head.sha;
    const last = getLastReviewedSha();

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
      - Focus only on ADDED (right-hand side) lines — those that start with "+".
      - When reporting "line", count only added lines, ignoring context and deleted ones.

      
      Respond strictly in JSON:
      [
        {
          "file": "${file.filename}",
          "line": <the Nth ADDED line that starts with '+' in the diff>,
          "comment": "Your feedback or question"
        }
      ]
      Only count lines starting with '+' when deciding line numbers.

      Patch:
      ${file.patch}
      `;

      try {
        const response = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: prompt }],
        });

        const aiComments = extractJSON(response.choices[0].message.content);
        // Gemini gives "line" = Nth added line (not real file line)
        const addedLines = extractAddedLines(file.patch);

        // 🧮 Match Gemini "line" index to actual file line number using diff hunks
        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;

          let realLineEntry = addedLines[c.line - 1];

          // Try to find a more accurate match if Gemini is off
          if (!realLineEntry) {
            for (let offset = -3; offset <= 3; offset++) {
              const nearby = addedLines[c.line - 1 + offset];
              if (nearby) {
                console.log(
                  `⚙️ Adjusted Gemini line ${c.line} → real line ${nearby.line}`
                );
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
            line: realLineEntry.line, // ✅ correct real line number now
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
