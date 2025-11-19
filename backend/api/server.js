import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

// ⬇️ NEW: Upstash Redis
import { Redis } from "@upstash/redis";

dotenv.config();

// ⬇️ Redis from environment (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
const redis = Redis.fromEnv();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// 🧩 Extract JSON safely from AI response
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

// 🧩 Redis: Load last reviewed SHA for a PR
async function getLastReviewedSha(owner, repo, prNumber) {
  const key = `pr-sha:${owner}/${repo}`;
  return await redis.hget(key, String(prNumber));
}

// 🧩 Redis: Save last reviewed SHA
async function saveLastReviewedSha(owner, repo, prNumber, sha) {
  const key = `pr-sha:${owner}/${repo}`;
  await redis.hset(key, { [String(prNumber)]: sha });
}

// Parse added lines from diff
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
    // Fetch PR
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
      if (!prs.length) throw new Error("No open PR found.");
      pr = prs[0];
    }

    const latestSha = pr.head.sha;

    // ⬇️ NEW: Redis load
    const lastReviewedSha = await getLastReviewedSha(owner, repo, pr.number);

    // Skip if same SHA
    if (lastReviewedSha === latestSha) {
      return res.json({ message: "No new commits — skipping review." });
    }

    let files = [];
    let commitsSummary = [];

    // Compare commits
    if (lastReviewedSha) {
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
    } else {
      // First review → list all PR files
      const { data: allFiles } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
      });
      files = allFiles;
    }

    if (!files.length) {
      await saveLastReviewedSha(owner, repo, pr.number, latestSha);
      return res.json({ message: "No changed files since last review." });
    }

    const allComments = [];
    let Quality = [];

    // Review changed files
    for (const file of files) {
      if (!file.patch) continue;

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

        let deduction = 0;
        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;

          let realLineEntry = addedLines[c.line - 1];
          if (!realLineEntry) continue;

          const severityWeights = { high: 10, medium: 5, low: 2 };
          deduction += severityWeights[c.severity] || 5;

          const body = `\`\`\`js
${realLineEntry.code}
\`\`\`
💡 **AI Review:** ${c.comment}`;

          allComments.push({
            path: file.filename,
            line: realLineEntry.line,
            side: "RIGHT",
            body,
          });
        }

        Quality.push({
          file: file.filename,
          quality: Math.max(100 - deduction, 0),
        });
      } catch (err) {
        console.warn(`Skipped ${file.filename}: ${err.message}`);
      }
    }

    if (!allComments.length) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found!",
        event: "COMMENT",
      });
      await saveLastReviewedSha(owner, repo, pr.number, latestSha);
      return res.json({ message: "No issues found." });
    }

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      commit_id: latestSha,
      body: "🤖 AI Review — see inline comments.",
      event: "COMMENT",
      comments: allComments,
    });

    // ⬇️ NEW: Save SHA to Redis
    await saveLastReviewedSha(owner, repo, pr.number, latestSha);

    res.json({
      message: "AI review completed.",
      comments: allComments.length,
      commitsReviewed: commitsSummary,
      Quality,
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
