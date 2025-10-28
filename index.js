// import { Octokit } from "@octokit/rest";
// import OpenAI from "openai";
// import { execSync } from "child_process";
// import dotenv from "dotenv";
// import fs from "fs";

// dotenv.config();

// // 🔐 Setup clients
// const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// const openai = new OpenAI({
//   apiKey: process.env.GOOGLE_API_KEY,
//   baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
// });

// // 🧩 Helper: Extract GitHub owner/repo from git remote URL
// function getRepoInfo() {
//   const remoteUrl = execSync("git config --get remote.origin.url")
//     .toString()
//     .trim();
//   const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
//   if (!match)
//     throw new Error("Could not parse repository info from remote URL");

//   // const owner = match[1]; // auto-detect username/org
//   const owner = "farrukh12255"; // force your username
//   const repo = match[2];
//   return { owner, repo };
// }

// // 🧩 Helper: Extract JSON array from AI response
// function extractJSON(text) {
//   const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
//   if (!match) throw new Error("No JSON found in AI response");
//   return JSON.parse(match[0]);
// }

// // 🧩 Helper: Get latest open PR
// async function getLatestOpenPR(owner, repo) {
//   const { data } = await octokit.pulls.list({
//     owner,
//     repo,
//     state: "open",
//     sort: "created",
//     direction: "desc",
//     per_page: 1,
//   });
//   return data.length ? data[0] : null;
// }

// // 🧩 Helper: State file (track last reviewed PR/commit)
// function getLastReviewedSha() {
//   try {
//     return JSON.parse(fs.readFileSync(".last_pr_sha.json", "utf-8"));
//   } catch {
//     return {};
//   }
// }

// function saveLastReviewedSha(prNumber, commitSha) {
//   fs.writeFileSync(
//     ".last_pr_sha.json",
//     JSON.stringify({ prNumber, commitSha }, null, 2)
//   );
// }

// // 🚀 Main
// async function run() {
//   try {
//     const diff = execSync("git diff HEAD~1").toString();
//     const localSha = execSync("git rev-parse HEAD").toString().trim();
//     const { owner, repo } = getRepoInfo();

//     const pr = await getLatestOpenPR(owner, repo);
//     if (!pr) throw new Error("No open pull requests found.");

//     const latestRemoteSha = pr.head.sha;

//     // 🧠 Check commit sync
//     if (localSha !== latestRemoteSha) {
//       console.log(`
// 🚫 Your local changes are not pushed yet.
// Local commit:  ${localSha}
// Remote commit: ${latestRemoteSha}

// 👉 Please push your latest commit first:
//    git push origin <branch-name>

// Then rerun this script.
// `);
//       return;
//     }

//     const last = getLastReviewedSha();
//     if (last.prNumber !== pr.number || last.commitSha !== latestRemoteSha) {
//       console.log(
//         "🕒 PR just created or updated — skipping initial review run."
//       );
//       saveLastReviewedSha(pr.number, latestRemoteSha);
//       return;
//     }

//     console.log("✅ Local and remote commits match. Proceeding with review...");

//     // 🧠 Improved Gemini review prompt
//     const reviewPrompt = `
// You are a strict code reviewer. Review ONLY the lines of code that changed in the provided git diff.
// Ignore commit messages, metadata, and unchanged code.

// Focus on:
// - Bugs, performance issues, poor practices.
// - Use of console.log, debugger, commented-out code.
// - Inefficient code or possible optimizations.

// Ignore:
// - Non-code files (package-lock.json, config files, etc.)
// - General opinions, praise, or unrelated feedback.

// Output JSON only, like:
// [
//   { "file": "src/index.js", "line": 12, "comment": "Remove console.log before committing." }
// ]

// Diff:
// ${diff}
// `;

//     console.log("🧠 Sending diff to Gemini for review...");
//     const res = await openai.chat.completions.create({
//       model: "gemini-2.0-flash",
//       messages: [{ role: "user", content: reviewPrompt }],
//     });

//     const rawContent = res.choices[0].message.content;
//     const comments = extractJSON(rawContent);

//     // 🧩 Filter irrelevant comments
//     const relevantComments = comments.filter(
//       (c) =>
//         c.comment &&
//         c.comment.length > 5 &&
//         !c.comment.match(/looks good|nice work|great/i)
//     );

//     if (!relevantComments.length) {
//       console.log(
//         "✅ No relevant code issues found — skipping review comments."
//       );
//       await octokit.pulls.createReview({
//         owner,
//         repo,
//         pull_number: pr.number,
//         body: "🤖 AI Review: No issues found — PR looks clean!",
//         event: "APPROVE",
//       });
//       return;
//     }

//     console.log(
//       `💬 Found ${relevantComments.length} issues, posting comments...`
//     );

//     // 💬 Post each comment individually
//     for (const c of relevantComments) {
//       try {
//         await octokit.pulls.createReviewComment({
//           owner,
//           repo,
//           pull_number: pr.number,
//           commit_id: latestRemoteSha,
//           path: c.file,
//           body: c.comment,
//           line: c.line,
//           side: "RIGHT",
//         });
//         console.log(`✅ Comment added: ${c.file}:${c.line}`);
//       } catch (err) {
//         console.warn(`⚠️ Skipped ${c.file}:${c.line}: ${err.message}`);
//       }
//     }

//     // 🧾 Add summary comment
//     await octokit.pulls.createReview({
//       owner,
//       repo,
//       pull_number: pr.number,
//       commit_id: latestRemoteSha,
//       body: "🤖 AI Review completed — please check inline comments above.",
//       event: "COMMENT",
//     });

//     console.log("✅ AI review completed successfully!");
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//   }
// }

// run();
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import { execSync } from "child_process";

dotenv.config();

// 🔐 Setup clients
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const openai = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// 🧩 Extract GitHub repo info
function getRepoInfo() {
  const remoteUrl = execSync("git config --get remote.origin.url")
    .toString()
    .trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  if (!match)
    throw new Error("Could not parse repository info from remote URL");
  const owner = match[1] || "farrukh12255";
  const repo = match[2];
  return { owner, repo };
}

// 🧩 Extract JSON from model response
function extractJSON(text) {
  try {
    const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

// 🧩 Get latest open PR
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

// 🧩 Track last reviewed commit
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

// 🚀 Main reviewer
async function run() {
  try {
    const { owner, repo } = getRepoInfo();
    const pr = await getLatestOpenPR(owner, repo);
    if (!pr) throw new Error("No open pull requests found.");
    const latestRemoteSha = pr.head.sha;

    const last = getLastReviewedSha();
    if (last.prNumber === pr.number && last.commitSha === latestRemoteSha) {
      console.log(
        "🕒 PR commit already reviewed — skipping duplicate comments."
      );
      return;
    }

    console.log(`✅ Reviewing PR #${pr.number} (${latestRemoteSha})...`);
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });
    const allComments = [];

    for (const file of files) {
      if (!file.patch) continue;

      const reviewPrompt = `
You are an **AI code reviewer**. Analyze only the changed lines in this diff.
Return JSON in the format:
[
  { "file": "filename", "line": 12, "comment": "Describe the issue" }
]

Rules:
- Focus on logic errors, unused vars, poor practices, or missed async/await.
- Ignore style, indentation, and trivial formatting.
- Do not compliment. Only flag actionable issues.

Diff to review:
${file.patch}
`;

      console.log(`🧠 Reviewing file: ${file.filename}`);

      let aiResponse = "";
      try {
        const res = await openai.chat.completions.create({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: reviewPrompt }],
        });
        aiResponse = res.choices[0]?.message?.content || "";
      } catch (err) {
        console.warn(
          `⚠️ AI request failed for ${file.filename}: ${err.message}`
        );
        continue;
      }

      const comments = extractJSON(aiResponse);
      const patchLines = file.patch.split("\n");

      for (const c of comments) {
        if (!c.comment || c.comment.length < 5) continue;

        // find matching diff line
        let targetIndex = -1;
        let lineCounter = 0;
        for (let i = 0; i < patchLines.length; i++) {
          const line = patchLines[i];
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineCounter++;
            if (lineCounter === c.line) {
              targetIndex = i;
              break;
            }
          }
        }

        // create short context
        const context =
          targetIndex !== -1
            ? patchLines
                .slice(
                  Math.max(0, targetIndex - 2),
                  Math.min(patchLines.length, targetIndex + 3)
                )
                .filter((l) => !l.startsWith("@@"))
                .map((l) => l.replace(/^[+-]/, ""))
                .join("\n")
            : "";

        const bodyWithContext = context
          ? `\`\`\`js
${context.trim()}
\`\`\`

💡 **AI Review:** ${c.comment.trim()}`
          : `💡 **AI Review:** ${c.comment.trim()}`;

        const duplicate = allComments.some(
          (existing) =>
            existing.path === (c.file || file.filename) &&
            existing.line === c.line &&
            existing.body === bodyWithContext
        );
        if (duplicate) continue;

        allComments.push({
          path: c.file || file.filename,
          line: c.line,
          side: "RIGHT",
          body: bodyWithContext,
        });
      }
    }

    if (!allComments.length) {
      console.log("✅ No relevant issues found — PR looks clean!");
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        body: "🤖 AI Review: No issues found — PR looks good to go!",
        event: "APPROVE",
      });
      saveLastReviewedSha(pr.number, latestRemoteSha);
      return;
    }

    console.log(`💬 Found ${allComments.length} issues — posting once.`);
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      commit_id: latestRemoteSha,
      body: "🤖 AI Review complete — inline comments added below.",
      event: "COMMENT",
      comments: allComments,
    });

    saveLastReviewedSha(pr.number, latestRemoteSha);
    console.log(
      "✅ AI review completed successfully with contextual comments."
    );
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

run();
