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
    You are an AI Code Reviewer.
    Your task is to review the provided git diff and return JSON comments for only the lines that were changed.
    
    🎯 Your goals:
    Comment only on changed or newly added code lines — do not include the full file or unchanged code.
    Identify and explain bugs, bad coding practices, and inefficiencies.
    Flag usage of:
    console.log, console.error, debugger
    Poor naming conventions or confusing logic
    Unused/commented-out code — say clearly:
    "Remove commented-out code. Either use it or delete it if forgotten."
    Mention time complexity issues if nested loops or inefficient logic are detected.
    Provide clear, concise, developer-friendly comments — focus on reviewing and reasoning, not admiration or compliments.
    If necessary, include short code snippets or examples to show how to fix or improve the code.

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
