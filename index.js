import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const openai = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

function getRepoInfo() {
  const remoteUrl = execSync("git config --get remote.origin.url")
    .toString()
    .trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  if (!match)
    throw new Error("Could not parse repository info from remote URL");
  //   const owner = match[1];
  const owner = "farrukh12255";
  const repo = match[2];
  return { owner, repo };
}

function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

async function getLatestOpenPR(owner, repo) {
  const { data } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "created",
    direction: "desc",
    per_page: 1,
  });
  if (!data || data.length === 0) return null;
  return data[0];
}

async function run() {
  try {
    const diff = execSync("git diff HEAD~1").toString();
    const { owner, repo } = getRepoInfo();
    const pr = await getLatestOpenPR(owner, repo);
    if (!pr) throw new Error("No open pull requests found.");

    const reviewPrompt = `
You are a code reviewer. Review the following git diff and return JSON comments only for the changed lines of code. 
Your job is to focus on what the developer is pushing in their change and identify possible bugs, 
poor coding practices, or performance issues. Pay attention to the use of debugger, console.log, 
unnecessary commented-out code, and inefficient code that affects time complexity. Capture only the specific 
code snippet or line where a comment is needed; do not include or output the full file. When you see commented-out code,
just mention clearly to remove it, saying that either it should be used or deleted if forgotten. Write your comments 
in a way that is easy for the developer to understand and act upon. Do not add unnecessary 
admiration or praise — stay focused on reviewing the code and explaining the reasoning behind your comments. 
If you find code that can be optimized, explain why and provide a short, simple example of how it can be improved. 
Your output must be in JSON format, where each object contains the line number, a clear comment describing the issue, 
and if applicable, a short suggestion or example showing how to fix it

Each object must include:
- "file" (path in repo)
- "line" (the line number in the diff)
- "comment" (your suggestion)

Example:
[
  { "file": "src/index.js", "line": 12, "comment": "Consider using const instead of let." }
]

Diff:
${diff}
`;

    console.log("🧠 Sending diff to Gemini...");
    const res = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: reviewPrompt }],
    });

    const rawContent = res.choices[0].message.content;
    const comments = extractJSON(rawContent);

    const latestCommitSha = pr.head.sha;
    console.log(`🔗 PR #${pr.number} commit: ${latestCommitSha}`);

    const reviewComments = comments.map((c) => ({
      path: c.file,
      position: c.line, // position in diff, not full file line number
      body: c.comment,
    }));

    console.log("💬 Posting inline review comments...");

    await octokit.pulls.createReview({
      owner: "farrukh12255",
      repo,
      pull_number: pr.number,
      commit_id: latestCommitSha,
      body: "🤖 Automated review comments from AI Code Reviewer:",
      event: "COMMENT",
      comments: reviewComments,
    });

    console.log("✅ Inline review comments successfully posted!");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

run();
