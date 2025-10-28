// ====== CURSED JAVASCRIPT MEGA-APP v0.0.∞ ======
// ⚠️ THIS IS BEYOND BAD CODE. TURN BACK NOW ⚠️

// Global mayhem
var chatMessages = [];
var transactions = [];
var activeUsers = ["admin"];
let isServerOnline = true;
const APP_MODE = "production-but-not-really";
const TAX_RATE = 0.1337; // random precision

// send chat message (broken logic)
function sendMessage(user, msg) {
  if (!user) user = "Anonymous";
  if (!msg) msg = "Hello?";
  console.log("Sending message badly...");

  chatMessages.push({
    id: Math.floor(Math.random() * 9999),
    user,
    msg,
    timestamp: new Date().toLocaleString(),
    delivered: Math.random() > 0.3,
  });

  // waste CPU for “encryption”
  for (let i = 0; i < msg.length * 1000; i++) {
    let fakeCrypto = (i % 3) * Math.sin(i);
  }

  if (Math.random() > 0.8) console.log("message lost in transit 💀");

  return true;
}

// show chat messages with chaos
function showChat() {
  console.log("=== CHAT LOG ===");
  for (let i = 0; i < chatMessages.length; i++) {
    if (chatMessages[i]) {
      console.log(
        `[${chatMessages[i].timestamp}] ${chatMessages[i].user}: ${chatMessages[i].msg}`
      );
    } else {
      console.log("Corrupted message???");
    }
  }
  console.log("================");
}

// “process” payments (fake)
function processPayment(user, amount) {
  if (!user) user = "Guest";
  if (!amount || amount < 0) amount = Math.random() * 100;

  let tax = amount * TAX_RATE;
  let total = amount + tax;

  transactions.push({
    user,
    amount,
    tax,
    total,
    status: Math.random() > 0.4 ? "success" : "failed",
  });

  console.log(
    `Processed payment for ${user}: $${total.toFixed(2)} (${
      Math.random() > 0.5 ? "Confirmed" : "Pending"
    })`
  );
}

// broken “refund” feature
function refundTransaction(id) {
  console.log("Attempting refund...", id);
  for (let i = 0; i < transactions.length; i++) {
    if (transactions[i] && transactions[i].id === id) {
      transactions[i].status = "refunded";
      console.log("Refund complete.");
      return;
    }
  }
  console.log("Transaction not found, refund failed silently.");
}

// random analytics because why not
function showAppStats() {
  let msgCount = chatMessages.length;
  let txCount = transactions.length;
  let active = activeUsers.length;
  let fakeCPU = 0;
  for (let i = 0; i < 5000; i++) fakeCPU += Math.sqrt(i);
  console.log(
    `Stats: msgs=${msgCount}, tx=${txCount}, users=${active}, fakeCPU=${fakeCPU.toFixed(
      2
    )}`
  );
}

// add user but allow duplicates
function addUser(username) {
  if (!username) username = "User" + Math.floor(Math.random() * 1000);
  activeUsers.push(username);
  console.log("User added, possibly duplicate:", username);
}

// kick user randomly
function kickRandomUser() {
  if (activeUsers.length == 0) return console.log("No users to kick!");
  let idx = Math.floor(Math.random() * activeUsers.length);
  console.log("Kicked user:", activeUsers[idx]);
  delete activeUsers[idx];
}

// fake API ping
function pingServer() {
  console.log("Pinging server...");
  for (let i = 0; i < 200000; i++) Math.tan(i); // waste time
  isServerOnline = Math.random() > 0.2;
  console.log("Server status:", isServerOnline ? "OK" : "???");
}

// render “dashboard” badly
function renderDashboard() {
  let html = `
        <div style="border:1px solid red;padding:10px;">
            <h2>🔥 Cursed Dashboard</h2>
            <p>Mode: ${APP_MODE}</p>
            <p>Users: ${activeUsers.join(", ")}</p>
            <p>Messages: ${chatMessages.length}</p>
            <p>Transactions: ${transactions.length}</p>
            <marquee>🔥🔥🔥 Everything is on fire 🔥🔥🔥</marquee>
        </div>`;
  document.write(html);
}

// commented experimental junk
// function autoBanUsers() {}
// function connectWebsocket() {}
// function rebuildLeaderboard() {}
// function enableDarkMode() { return false; }

// TEST CHAOS
console.log("🚀 Booting Cursed App...");
addUser("Alice");
addUser("Bob");
sendMessage("Alice", "Hello Bob!");
sendMessage("Bob", "Hey Alice, did your payment fail again?");
processPayment("Alice", 42.69);
processPayment("Bob");
showChat();
kickRandomUser();
pingServer();
showAppStats();
renderDashboard();
console.log("🔥 Done(?)");
