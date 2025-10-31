// import express from "express";
// import { Octokit } from "@octokit/rest";
// import OpenAI from "openai";
// import dotenv from "dotenv";
// import fs from "fs";

// dotenv.config();

// const app = express();
// app.use(express.json());

// // 🧩 Extract JSON safely from AI response
// function extractJSON(text) {
//   debugger;
//   const match = text.match(/\[\s*{[\s\S]*}\s*\]/);
//   if (!match) throw new Error("No JSON found in AI response");
//   return JSON.parse(match[0]);
// }

// // 🧩 Save/retrieve last reviewed PR info
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

// // 🧩 Extract added lines with correct real line numbers from patch
// function extractAddedLines(patchText) {
//   const lines = patchText.split("\n");
//   const addedLines = [];
//   let oldLine = 0;
//   let newLine = 0;

//   for (const line of lines) {
//     // Parse diff header like: @@ -40,6 +50,8 @@
//     const hunkMatch = line.match(/^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
//     if (hunkMatch) {
//       oldLine = parseInt(hunkMatch[1], 10);
//       newLine = parseInt(hunkMatch[3], 10);
//       continue;
//     }

//     if (line.startsWith("+") && !line.startsWith("++")) {
//       addedLines.push({ code: line.slice(1), line: newLine });
//       newLine++;
//     } else if (line.startsWith("-") && !line.startsWith("--")) {
//       oldLine++;
//     } else {
//       oldLine++;
//       newLine++;
//     }
//   }

//   return addedLines;
// }

// // 🧩 Fetch file content from GitHub
// async function getFileLines(octokit, owner, repo, path, ref) {
//   const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
//   const content = Buffer.from(data.content, "base64").toString("utf-8");
//   return content.split("\n");
// }

// // 🚀 Main review endpoint
// app.post("/review", async (req, res) => {
//   const { githubToken, googleKey, owner, repo, pull_number } = req.body;
//   if (!githubToken || !googleKey || !owner || !repo)
//     return res.status(400).json({ error: "Missing required parameters" });

//   const octokit = new Octokit({ auth: githubToken });
//   const openai = new OpenAI({
//     apiKey: googleKey,
//     baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
//   });

//   try {
//     let pr;

//     if (pull_number) {
//       const { data } = await octokit.pulls.get({ owner, repo, pull_number });
//       pr = data;
//     } else {
//       const { data: prs } = await octokit.pulls.list({
//         owner,
//         repo,
//         state: "open",
//         sort: "created",
//         direction: "desc",
//         per_page: 1,
//       });
//       if (!prs.length) throw new Error("No open pull requests found.");
//       pr = prs[0];
//     }

//     const latestSha = pr.head.sha;
//     const last = getLastReviewedSha();

//     const { data: files } = await octokit.pulls.listFiles({
//       owner,
//       repo,
//       pull_number: pr.number,
//     });

//     const allComments = [];

//     for (const file of files) {
//       if (!file.patch) continue;

//       console.log(`🧠 Reviewing file: ${file.filename}`);

//       const prompt = `
//       You are a professional code reviewer analyzing a GitHub pull request diff.

//       Rules:
//       - Focus only on ADDED (right-hand side) lines.
//       - If code was REMOVED without a replacement, ask why.
//       - Identify logic gaps, missing error handling, or potential bugs.
//       - Avoid trivial comments (like formatting or naming).
//       - Focus only on ADDED (right-hand side) lines — those that start with "+".
//       - When reporting "line", count only added lines, ignoring context and deleted ones.

//       Respond strictly in JSON:
//       [
//         {
//           "file": "${file.filename}",
//           "line": <the Nth ADDED line that starts with '+' in the diff>,
//           "comment": "Your feedback or question"
//         }
//       ]
//       Only count lines starting with '+' when deciding line numbers.

//       Patch:
//       ${file.patch}
//       `;

//       try {
//         const response = await openai.chat.completions.create({
//           model: "gemini-2.0-flash",
//           messages: [{ role: "user", content: prompt }],
//         });

//         const aiComments = extractJSON(response.choices[0].message.content);
//         // Gemini gives "line" = Nth added line (not real file line)
//         const addedLines = extractAddedLines(file.patch);

//         // 🧮 Match Gemini "line" index to actual file line number using diff hunks
//         for (const c of aiComments) {
//           if (!c.comment || c.comment.length < 5) continue;

//           let realLineEntry = addedLines[c.line - 1];

//           // Try to find a more accurate match if Gemini is off
//           if (!realLineEntry) {
//             for (let offset = -3; offset <= 3; offset++) {
//               const nearby = addedLines[c.line - 1 + offset];
//               if (nearby) {
//                 console.log(
//                   `⚙️ Adjusted Gemini line ${c.line} → real line ${nearby.line}`
//                 );
//                 realLineEntry = nearby;
//                 break;
//               }
//             }
//           }

//           if (!realLineEntry) continue;

//           const contextStart = Math.max(0, c.line - 3);
//           const contextEnd = Math.min(addedLines.length, c.line + 2);
//           const context = addedLines
//             .slice(contextStart, contextEnd)
//             .map((l) => l.code)
//             .join("\n");

//           const body = `\`\`\`js
//   ${context}
//   \`\`\`

//   💡 **AI Review:** ${c.comment.trim()}`;

//           allComments.push({
//             path: file.filename,
//             line: realLineEntry.line, // ✅ correct real line number now
//             side: "RIGHT",
//             body,
//           });
//         }
//       } catch (err) {
//         console.warn(`⚠️ Skipped ${file.filename}: ${err.message}`);
//       }
//     }

//     if (!allComments.length) {
//       await octokit.pulls.createReview({
//         owner,
//         repo,
//         pull_number: pr.number,
//         body: "🤖 AI Review: No issues found — PR looks good!",
//         event: "APPROVE",
//       });
//       saveLastReviewedSha(pr.number, latestSha);
//       return res.json({ message: "✅ No issues found." });
//     }

//     console.log(`💬 Found ${allComments.length} issues — posting...`);

//     await octokit.pulls.createReview({
//       owner,
//       repo,
//       pull_number: pr.number,
//       commit_id: latestSha,
//       body: "🤖 AI Review completed — see inline comments below.",
//       event: "COMMENT",
//       comments: allComments,
//     });

//     saveLastReviewedSha(pr.number, latestSha);
//     res.json({
//       message: "✅ AI Review completed.",
//       comments: allComments.length,
//     });
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => console.log(`🚀 AI Reviewer running on port ${PORT}`));

// ===================================Deepsick======================================
import express from "express";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

// 🧩 Smart Line Mapper Class
class SmartLineMapper {
  constructor(sourceCode) {
    this.sourceCode = sourceCode;
    this.lines = sourceCode.split("\n");
  }

  /**
   * Map AI comments to correct line numbers using multiple strategies
   */
  mapAIComments(aiComments, fileContent) {
    if (!fileContent) return aiComments;

    this.sourceCode = fileContent;
    this.lines = fileContent.split("\n");

    return aiComments.map((comment) => {
      const actualLine = this.findBestMatchingLine(comment);

      return {
        ...comment,
        originalLine: comment.line,
        actualLine: actualLine,
        context: this.getCodeContext(actualLine),
        confidence: this.calculateConfidence(comment, actualLine),
      };
    });
  }

  findBestMatchingLine(comment) {
    const strategies = [
      () => this.findByCodePattern(comment.comment),
      () => this.findByFunctionContext(comment.comment),
      () => this.findByVariableMention(comment.comment),
      () => comment.line, // Fallback to AI's original line
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result && this.isGoodMatch(comment.comment, result)) {
        return result;
      }
    }
    return comment.line;
  }

  findByCodePattern(commentText) {
    const patterns = this.extractCodePatterns(commentText);

    for (const pattern of patterns) {
      for (let i = 0; i < this.lines.length; i++) {
        if (this.lines[i].includes(pattern)) {
          return i + 1;
        }
      }
    }
    return null;
  }

  findByFunctionContext(commentText) {
    const functionRegex =
      /function\s+(\w+)|(\w+)\s*\([^)]*\)\s*\{|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/gi;
    const functionMentions = commentText.match(functionRegex);

    if (functionMentions) {
      for (const funcMention of functionMentions) {
        const funcName = funcMention.match(/(\w+)/)[0];
        const line = this.findFunctionLine(funcName);
        if (line) return line;
      }
    }
    return null;
  }

  findByVariableMention(commentText) {
    const variableNames = commentText.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];

    for (const varName of variableNames) {
      if (varName.length > 3) {
        for (let i = 0; i < this.lines.length; i++) {
          if (
            this.lines[i].includes(`let ${varName}`) ||
            this.lines[i].includes(`const ${varName}`) ||
            this.lines[i].includes(`var ${varName}`) ||
            this.lines[i].includes(`${varName} =`)
          ) {
            return i + 1;
          }
        }
      }
    }
    return null;
  }

  findFunctionLine(funcName) {
    for (let i = 0; i < this.lines.length; i++) {
      if (
        this.lines[i].includes(`function ${funcName}`) ||
        this.lines[i].includes(`${funcName}(`) ||
        this.lines[i].includes(`${funcName} =`)
      ) {
        return i + 1;
      }
    }
    return null;
  }

  extractCodePatterns(commentText) {
    const patterns = [
      ...(commentText.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g) || []),
      ...(commentText.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || []),
      ...(commentText.match(/\b[a-z_][a-z0-9_]*\b/g) || []),
      ...(commentText.match(/%|\+|\-|\*|\/|=/g) || []),
      ...(commentText.match(/\b\d+\b/g) || []),
    ];

    const commonWords = new Set([
      "the",
      "and",
      "for",
      "why",
      "was",
      "changed",
      "from",
      "to",
      "what",
      "impact",
      "on",
      "this",
      "that",
      "with",
    ]);

    return patterns.filter(
      (pattern) => pattern.length > 2 && !commonWords.has(pattern.toLowerCase())
    );
  }

  getCodeContext(lineNumber) {
    if (!lineNumber || lineNumber < 1 || lineNumber > this.lines.length) {
      return "Context not available";
    }

    const start = Math.max(0, lineNumber - 2);
    const end = Math.min(this.lines.length, lineNumber + 2);

    const contextLines = [];
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const marker = lineNum === lineNumber ? ">>> " : "    ";
      contextLines.push(`${marker}${lineNum}: ${this.lines[i]}`);
    }

    return contextLines.join("\n");
  }

  isGoodMatch(commentText, lineNumber) {
    const context = this.getCodeContext(lineNumber).toLowerCase();
    const comment = commentText.toLowerCase();
    const keywords = this.extractKeywords(commentText);

    const matches = keywords.filter((keyword) =>
      context.includes(keyword.toLowerCase())
    ).length;

    return matches >= 1;
  }

  calculateConfidence(comment, mappedLine) {
    if (comment.line === mappedLine) return "low";

    const context = this.getCodeContext(mappedLine).toLowerCase();
    const commentText = comment.comment.toLowerCase();
    const keywords = this.extractKeywords(comment.comment);

    const matches = keywords.filter((keyword) =>
      context.includes(keyword.toLowerCase())
    ).length;

    const confidenceRatio = matches / Math.max(keywords.length, 1);

    if (confidenceRatio > 0.6) return "high";
    if (confidenceRatio > 0.3) return "medium";
    return "low";
  }

  extractKeywords(text) {
    const commonWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "why",
      "was",
      "what",
    ]);
    return text
      .split(/\W+/)
      .filter((word) => word.length > 3 && !commonWords.has(word.toLowerCase()))
      .map((word) => word.replace(/[^\w]/g, ""));
  }

  // 🆕 Added method to find best match in added lines
  findBestMatchInAddedLines(commentText, addedLines) {
    const keywords = commentText
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3);

    for (const addedLine of addedLines) {
      const lineText = addedLine.code.toLowerCase();
      const matches = keywords.filter((keyword) =>
        lineText.includes(keyword)
      ).length;

      if (matches > 0) {
        return addedLine;
      }
    }

    return addedLines[0]; // Fallback to first added line
  }
}

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

// 🧩 Extract added lines with real line numbers from patch
function extractAddedLines(patchText) {
  debugger;
  const patch = patchText
    .split("\n")
    .filter((line) => !line.startsWith("-"))
    .join("\n");
  debugger;
  const lines = patch.split("\n");
  const addedLines = [];
  let newLine = 0;
  let oldLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse header like @@ -40,6 +50,8 @@
      const match = /@@ -(\d+),?\d* \+(\d+),?\d* @@/.exec(line);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
    } else if (line.startsWith("+") && !line.startsWith("++")) {
      addedLines.push({ code: line.slice(1), line: newLine });
      newLine++;
    } else if (line.startsWith("-")) {
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
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return content;
  } catch (error) {
    console.warn(
      `⚠️ Could not fetch file content for ${path}: ${error.message}`
    );
    return null;
  }
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

      // 🔍 Get the actual file content for accurate line mapping
      const fileContent = await getFileLines(
        octokit,
        owner,
        repo,
        file.filename,
        pr.head.sha
      );
      const lineMapper = new SmartLineMapper(fileContent || ""); // 🆕 Create mapper for each file

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
        const addedLines = extractAddedLines(file.patch);

        // 🎯 Use Smart Line Mapping to get accurate line numbers
        const mappedComments = lineMapper.mapAIComments(
          aiComments,
          fileContent
        );

        for (const c of mappedComments) {
          if (!c.comment || c.comment.length < 5) continue;

          let realLineNumber = c.actualLine;
          let confidenceNote = "";

          // If confidence is low, try to find the best matching line in added lines
          if (c.confidence === "low") {
            const bestMatch = lineMapper.findBestMatchInAddedLines(
              c.comment,
              addedLines
            ); // 🆕 Fixed: use lineMapper
            if (bestMatch) {
              realLineNumber = bestMatch.line;
              confidenceNote = ` (mapped from AI line ${c.line})`;
            }
          }

          // Get context from actual file content if available
          let context = "";
          if (fileContent) {
            const contextStart = Math.max(0, realLineNumber - 3);
            const contextEnd = Math.min(
              fileContent.split("\n").length,
              realLineNumber + 2
            );
            context = fileContent
              .split("\n")
              .slice(contextStart, contextEnd)
              .join("\n");
          } else {
            // Fallback to added lines context
            const contextStart = Math.max(0, c.line - 3);
            const contextEnd = Math.min(addedLines.length, c.line + 2);
            context = addedLines
              .slice(contextStart, contextEnd)
              .map((l) => l.code)
              .join("\n");
          }

          const body = `\`\`\`js
${context}
\`\`\`

💡 **AI Review:** ${c.comment.trim()} 
${confidenceNote ? `\n\n*Note: ${confidenceNote}*` : ""}
${c.confidence !== "high" ? `\n*Confidence: ${c.confidence}*` : ""}`;

          allComments.push({
            path: file.filename,
            line: realLineNumber,
            side: "RIGHT",
            body,
          });

          console.log(
            `📝 Comment on ${file.filename}:${realLineNumber} (confidence: ${c.confidence})`
          );
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
      details: allComments.map((c) => ({
        file: c.path,
        line: c.line,
        confidence: c.confidence,
      })),
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 AI Reviewer running on port ${PORT}`));
