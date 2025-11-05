import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { execSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// 🔐 Setup clients
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const openai = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// 🧩 Helper: Extract GitHub owner/repo from git remote URL
function getRepoInfo() {
  const remoteUrl = execSync("git config --get remote.origin.url")
    .toString()
    .trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  if (!match)
    throw new Error("Could not parse repository info from remote URL");

  const owner = "farrukh12255"; // keep your username
  const repo = match[2];
  return { owner, repo };
}

// 🧩 Helper: Extract JSON array from AI response
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

// 🧩 Helper: Get latest open PR
async function getLatestOpenPR(owner, repo) {
  const { data } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "created",
    direction: "desc",
    per_page: 1,
  });
  return data.length ? data[0] : null;
}

// 🧩 Track last reviewed PR
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

// 🧩 Helper: Extract added lines context from patch
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

// 🚀 Main
async function run() {
  try {
    const { owner, repo } = getRepoInfo();
    const pr = await getLatestOpenPR(owner, repo);
    if (!pr) throw new Error("No open pull requests found.");

    const latestRemoteSha = pr.head.sha;
    const last = getLastReviewedSha();

    if (last.prNumber === pr.number && last.commitSha === latestRemoteSha) {
      console.log("🕒 PR commit already reviewed — skipping duplicate run.");
      return;
    }

    console.log(`✅ Reviewing PR #${pr.number} (${latestRemoteSha})...`);

    // Fetch changed files
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const allComments = [];

    for (const file of files) {
      if (!file.patch) continue;

      const reviewPrompt = `
You are a strict code reviewer. Analyze ONLY the added lines in this patch.

Focus on:
- Potential bugs or inefficiencies
- Unnecessary console.log/debugger statements
- Async or missing error handling
- Code smell or redundant logic
- Try to use latest js code implementaion

Output JSON only:
[
  { "file": "${file.filename}", "line": 12, "comment": "Example issue" }
]

Patch:
${file.patch}
`;

      console.log(`🧠 Analyzing ${file.filename}...`);

      try {
        const res = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: reviewPrompt }],
        });

        const raw = res.choices[0].message.content;
        const aiComments = extractJSON(raw);
        const addedLines = extractAddedLines(file.patch);

        for (const c of aiComments) {
          if (!c.comment || c.comment.length < 5) continue;

          // find closest added line
          const match = addedLines.find((l) => l.line === c.line);
          if (!match) continue;

          const bodyWithContext = `\`\`\`js
${match.code.trim()}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}`;

          // avoid duplicates
          const duplicate = allComments.some(
            (x) =>
              x.path === (c.file || file.filename) &&
              x.line === match.line &&
              x.body === bodyWithContext
          );
          if (duplicate) continue;

          allComments.push({
            path: c.file || file.filename,
            line: match.line,
            side: "RIGHT",
            body: bodyWithContext,
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
      return;
    }

    console.log(`💬 Found ${allComments.length} issues — posting review...`);

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
    console.log("✅ AI review completed successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

run();
