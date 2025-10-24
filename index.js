import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { execSync } from "child_process";
import dotenv from "dotenv";

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

  // const owner = match[1]; // auto-detect username/org
  const owner = "farrukh12255"; // force your username
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

// 🚀 Main
async function run() {
  try {
    const diff = execSync("git diff HEAD~1").toString();
    const localSha = execSync("git rev-parse HEAD").toString().trim();
    const { owner, repo } = getRepoInfo();

    const pr = await getLatestOpenPR(owner, repo);
    if (!pr) throw new Error("No open pull requests found.");

    const latestRemoteSha = pr.head.sha;

    // 🧠 Check commit sync
    if (localSha !== latestRemoteSha) {
      console.log(`
🚫 Your local changes are not pushed yet.
Local commit:  ${localSha}
Remote commit: ${latestRemoteSha}

👉 Please push your latest commit first:
   git push origin <branch-name>

Then rerun this script.
`);
      return;
    }

    console.log("✅ Local and remote commits match. Proceeding with review...");

    // 🧠 Send diff to Gemini
    const reviewPrompt = `
You are a senior code reviewer. Review this git diff carefully and provide comments only for changed lines.
Focus on:
- Bugs or potential logic errors
- Inefficient code
- Unused or commented-out code
- Debug or console.log statements left behind

Output JSON only in this format:
[
  { "file": "src/App.js", "line": 42, "comment": "Consider removing console.log in production." }
]

Diff:
${diff}
`;

    console.log("🧠 Sending diff to Gemini for review...");
    const res = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: reviewPrompt }],
    });

    const rawContent = res.choices[0].message.content;
    const comments = extractJSON(rawContent);

    if (!comments.length) {
      console.log("✅ No issues found — clean PR!");
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — PR looks good!",
        event: "APPROVE",
      });
      return;
    }

    console.log(
      `💬 Found ${comments.length} issues, posting inline comments...`
    );

    // 💬 Post each comment individually
    for (const c of comments) {
      try {
        await octokit.pulls.createReviewComment({
          owner,
          repo,
          pull_number: pr.number,
          commit_id: latestRemoteSha,
          path: c.file,
          body: c.comment,
          line: c.line,
          side: "RIGHT",
        });
        console.log(`✅ Comment added: ${c.file}:${c.line}`);
      } catch (err) {
        console.warn(`⚠️ Skipped ${c.file}:${c.line}: ${err.message}`);
      }
    }

    // 🧾 Add summary comment
    await octokit.pulls.createReview({
      owner: "farrukh12255",
      repo,
      pull_number: pr.number,
      commit_id: latestRemoteSha,
      body: "🤖 AI Review completed — please check inline comments above.",
      event: "COMMENT",
    });

    console.log("✅ AI review completed successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

run();
