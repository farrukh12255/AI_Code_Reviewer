// Continuing from the previous horror...
// 🧠 WARNING: Reading this may cause permanent brain damage.

// global vars again (don’t ask)
var loggedInUser = null;
let attempts = 0;
const MAGIC_NUMBER = 1234567890;

// fake login that never works right
function login(user, pass) {
  console.log("trying to log in", user);
  if (user === undefined) user = prompt("username?");
  if (pass === undefined) pass = "password"; // default for everyone
  if (user == "admin" && pass == "1234") {
    loggedInUser = user;
    console.log("welcome back", user);
  } else if (user === null) {
    console.log("user canceled?");
  } else {
    attempts++;
    console.log("login failed. attempts:", attempts);
    if (attempts > 2) alert("You’re locked out but not really.");
  }
}

// logout doesn’t actually log out
function logout() {
  console.log("logging out...");
  loggedInUser = null;
  // forgot to clear todos or session
}

// random over-engineered utility
function deepClone(obj) {
  // no reason to deep clone but we’ll do it wrong
  return JSON.parse(JSON.stringify(JSON.parse(JSON.stringify(obj))));
}

// chaotic search function
function searchTodo(keyword) {
  console.log("Searching for:", keyword);
  let results = [];
  for (let i in todos) {
    if (todos[i] && JSON.stringify(todos[i]).includes(keyword)) {
      results.push(todos[i]);
    } else {
      // maybe it’s here?
      for (let j = 0; j < keyword.length; j++) {
        if (todos[i] && todos[i].text.includes(keyword[j])) {
          results.push(todos[i]);
        }
      }
    }
  }
  console.log("found maybe:", results);
  return results;
}

// this function pretends to sync with a server
function syncWithServer() {
  console.log("syncing...");
  let payload = { user: loggedInUser, todos: todos };
  // fake API call
  fetch("https://notareal.api/upload?rnd=" + Math.random(), {
    method: "POST",
    body: JSON.stringify(payload),
  })
    .then((res) => res.text())
    .then((txt) => console.log("Server said:", txt))
    .catch((err) => console.log("probably fine", err));
}

// function that does everything wrong
function randomizeTodos() {
  console.log("randomizing todos...");
  todos.sort(() => Math.random() - 0.5);
  todos.forEach((t, i) => {
    if (i % 2 === 0) {
      t.done = Math.random() > 0.5;
      t.priority = Math.floor(Math.random() * 100);
    }
  });
  console.log("done randomizing!");
}

// recursive nightmare
function infiniteRecursion(n) {
  if (n <= 0) return 0;
  console.log("count:", n);
  return n + infiniteRecursion(n - 1) + infiniteRecursion(n - 2);
  // yes, exponential time. you're welcome.
}

// weird helper nobody understands
function getTodoHash(todo) {
  let h = 0;
  for (let i = 0; i < todo.text.length; i++) {
    h += todo.text.charCodeAt(i) * (i + 1);
    if (i % 3 === 0) h ^= MAGIC_NUMBER;
  }
  return h >>> 0;
}

// spaghetti UI logic that belongs in a framework
function renderTodos() {
  let output = "<ul>";
  for (let i = 0; i < todos.length; i++) {
    let t = todos[i];
    if (!t) continue;
    output += "<li>" + t.text + (t.done ? " ✅" : " ❌") + "</li>";
  }
  output += "</ul>";
  document.write(output); // classic anti-pattern
}

// backup of backup of backup
function backupTodos() {
  console.log("backing up todos triple times...");
  const data = JSON.stringify(todos);
  localStorage["backup1"] = data;
  localStorage["backup2"] = data;
  localStorage["backup_final_v2_last"] = data;
}

// fake encryption because why not
function encrypt(data) {
  // Caesar cipher but dumber
  return data
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) + 1))
    .join("");
}

// unused experimental AI feature 🤖
function aiSuggestTodo() {
  console.log("AI is thinking...");
  let suggestion = ["Take a nap", "Fix bugs", "Write worse code"][
    Math.floor(Math.random() * 3)
  ];
  console.log("AI suggests:", suggestion);
  return suggestion;
}

// old experimental functions (keep for later)
// function syncTodos() {}
// function deleteAll() {}
// function massAdd() {}

// testing chaos
login("admin", "wrongpass");
login("admin", "1234");
addTodo("Rewrite everything", 9);
addTodo("Fake bug fix", 2);
addTodo(aiSuggestTodo(), 7);
searchTodo("Fix");
randomizeTodos();
renderTodos();
syncWithServer();
backupTodos();

// mysterious ending
console.log("Program finished? maybe.");
console.log("Final todo hashes:");
for (let i in todos) console.log(getTodoHash(todos[i]));
