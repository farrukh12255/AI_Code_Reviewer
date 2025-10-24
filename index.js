// import { Octokit } from "@octokit/rest";
// import OpenAI from "openai";
// import { execSync } from "child_process";
// import dotenv from "dotenv";

// dotenv.config();

// const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// const openai = new OpenAI({
//   apiKey: process.env.GOOGLE_API_KEY,
//   baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
// });

// // async function run() {
// //   const diff = execSync("git diff HEAD~1").toString();

// //   const reviewPrompt = `
// //   You are a code reviewer. Provide clear, concise review comments for the following diff and do comment on this line and tell me where is the file line:

// //   ${diff}

// //   Return a JSON with:
// //   [
// //     { "file": "path/to/file.js", "line": 42, "comment": "Consider using const instead of let." }
// //   ]
// //   `;

// //   const res = await openai.chat.completions.create({
// //     model: "gemini-2.0-flash",
// //     messages: [{ role: "user", content: reviewPrompt }],
// //   });

// //   console.log("res: ", res);
// //   const comments = JSON.parse(res.choices[0].message.content);
// //   console.log("comments: =====================", comments);

// //   for (const c of comments) {
// //     console.log("c: ", c);
// //     await octokit.pulls.createReviewComment({
// //       owner: "farrukh12255",
// //       repo: "AI_Code_Reviewer",
// //       pull_number: process.env.PR_NUMBER,
// //       body: c.comment,
// //       path: c.file,
// //       line: c.line,
// //     });
// //   }
// // }
// async function getLatestOpenPR(owner, repo) {
//   try {
//     const { data } = await octokit.pulls.list({
//       owner,
//       repo,
//       state: "open",
//       sort: "created",
//       direction: "desc",
//       per_page: 1,
//     });

//     if (!data || data.length === 0) {
//       console.log("❌ No open pull requests found.");
//       return null;
//     }

//     const pr = data[0];
//     console.log(`✅ Found open PR #${pr.number}: ${pr.title}`);
//     return pr.number;
//   } catch (error) {
//     console.error("❌ Error fetching pull requests:", error);
//     return null;
//   }
// }

// function getRepoInfo() {
//   const remoteUrl = execSync("git config --get remote.origin.url")
//     .toString()
//     .trim();

//   // Handle both SSH (git@github.com:user/repo.git) and HTTPS (https://github.com/user/repo.git)
//   const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);

//   if (!match) {
//     throw new Error("Could not parse repository info from remote URL");
//   }

//   //   const owner = match[1];
//   const owner = "farrukh12255";
//   const repo = match[2];
//   return { owner, repo };
// }

// function extractJSON(text) {
//   const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
//   if (!match) throw new Error("No JSON found in response");
//   return JSON.parse(match[0]);
// }

// async function run() {
//   const diff = execSync("git diff HEAD~1").toString();
//   const { owner, repo } = getRepoInfo();
//   console.log(`Detected repo: ${owner}/${repo}`);

//   // 🔥 Auto-detect latest open PR number
//   const prNumber = await getLatestOpenPR(owner, repo);

//   const reviewPrompt = `
//     You are a strict JSON generator. Review the following git diff and return ONLY valid JSON.
//     Do not include any text before or after the JSON.

//     Diff:
//     ${diff}

//     Output format (JSON array):
//     [
//       { "file": "path/to/file.js", "line": 42, "comment": "Consider using const instead of let." }
//     ]
//     `;

//   const res = await openai.chat.completions.create({
//     model: "gemini-2.0-flash",
//     messages: [{ role: "user", content: reviewPrompt }],
//   });

//   const rawContent = res.choices[0].message.content;
//   console.log("Raw model output:", rawContent);

//   const comments = extractJSON(rawContent);
//   console.log("Parsed comments:", comments);

//   for (const c of comments) {
//     await octokit.pulls.createReviewComment({
//       owner: "farrukh12255",
//       repo,
//       pull_number: prNumber,
//       body: c.comment,
//       path: c.file,
//       line: c.line,
//     });
//   }

//   console.log("✅ All comments added successfully!");
// }

// run();

import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

// === Initialize clients ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const openai = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// === Helper: detect repo info from local git ===
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

// === Helper: extract JSON safely from model output ===
function extractJSON(text) {
  const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

// === Helper: find latest open PR or fallback ===
async function getLatestOpenPR(owner, repo) {
  console.log("🔍 Checking for open PRs in:", owner, repo);
  const { data } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "created",
    direction: "desc",
    per_page: 1,
  });

  if (!data || data.length === 0) {
    console.log("❌ No open pull requests found for this repository.");
    return null;
  }

  const pr = data[0];
  console.log(`✅ Found open PR #${pr.number}: ${pr.title}`);
  return pr.number;
}

// === Main runner ===
async function run() {
  try {
    const diff = execSync("git diff HEAD~1").toString();
    const { owner, repo } = getRepoInfo();
    console.log(`Detected repo: ${owner}/${repo}`);

    // Auto detect PR
    const prNumber = await getLatestOpenPR(owner, repo);
    if (!prNumber) {
      console.log("⚠️  No PR found. Please open one first.");
      return;
    }

    const reviewPrompt = `
You are a strict JSON generator. Review the following git diff and return ONLY valid JSON.
Do not include any text before or after the JSON.

Diff:
${diff}

Output format (JSON array):
[
  { "file": "path/to/file.js", "line": 42, "comment": "Consider using const instead of let." }
]
`;

    console.log("🧠 Sending diff to Gemini for review...");

    const res = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: reviewPrompt }],
    });

    const rawContent = res.choices[0].message.content;
    console.log("Raw model output:", rawContent);

    const comments = extractJSON(rawContent);
    console.log("Parsed comments:", comments);

    for (const c of comments) {
      await octokit.issues.createComment({
        owner: "farrukh12255",
        repo,
        issue_number: prNumber,
        body: `💬 **${c.file} (line ${c.line})**\n${c.comment}`,
      });
    }

    console.log("✅ All comments successfully posted to PR!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

run();
