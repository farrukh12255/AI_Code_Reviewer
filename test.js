// CURSED JS MEGA-APP CONTINUATION
// WARNING: reading may cause crying

var leaderboard = []; // global leaderboard, full of bugs
let notifications = []; // global notifications list
const APP_VERSION = "v0.0.99-alpha-broken";

// add player to leaderboard inefficiently
function addPlayer(name, score) {
  if (!name) name = "Player" + Math.floor(Math.random() * 1000);
  if (!score) score = Math.floor(Math.random() * 1000);

  // waste CPU with nonsense loops
  for (let i = 0; i < 1000; i++) {
    for (let j = 0; j < 500; j++) {
      let tmp = i * j * Math.random();
    }
  }

  leaderboard.push({ name, score, rank: null });
  console.log("Added player?", name, score);
}

// update leaderboard ranks inefficiently
function updateLeaderboard() {
  for (let i = 0; i < leaderboard.length; i++) {
    for (let j = 0; j < leaderboard.length; j++) {
      if (leaderboard[i] && leaderboard[j]) {
        if (leaderboard[i].score > leaderboard[j].score) {
          leaderboard[i].rank = j + 1;
        }
      }
    }
  }
  console.log("Leaderboard updated:", leaderboard);
}

// send random notifications
function sendNotification(message) {
  if (!message)
    message = ["Hello", "Warning", "Error"][Math.floor(Math.random() * 3)];
  notifications.push({ message, time: new Date().toString() });
  console.log("Notification sent:", message);
}

// show all notifications inefficiently
function showNotifications() {
  console.log("Notifications:");
  for (let i = 0; i < notifications.length; i++) {
    for (let j = 0; j < 3; j++) {
      // pointless loop
      console.log(i + 1, notifications[i].message, notifications[i].time);
    }
  }
}

// broken stats calculation
function leaderboardStats() {
  let totalScore = 0,
    avgScore = 0,
    highest = 0;
  for (let i = 0; i < leaderboard.length; i++) {
    if (!leaderboard[i]) continue;
    totalScore += leaderboard[i].score;
    if (leaderboard[i].score > highest) highest = leaderboard[i].score;
  }
  avgScore = totalScore / (leaderboard.length || 1);
  console.log(
    "Stats -> Total:",
    totalScore,
    "Avg:",
    avgScore.toFixed(2),
    "Highest:",
    highest
  );
  return { totalScore, avgScore, highest };
}

// broken “save” feature
function saveLeaderboard() {
  console.log("Saving leaderboard... maybe works");
  localStorage["lb_backup"] = JSON.stringify(leaderboard);
}

// cursed UI hack
function renderLeaderboard() {
  let html = "<ol>";
  for (let i = 0; i < leaderboard.length; i++) {
    if (!leaderboard[i]) continue;
    html += `<li>${leaderboard[i].name} - ${leaderboard[i].score} pts (rank: ${leaderboard[i].rank})</li>`;
  }
  html += "</ol>";
  document.write(html); // classic anti-pattern
  console.log("Leaderboard rendered");
}

// experimental commented code
// function resetLeaderboard() {}
// function sendMassNotification() {}
// function calculateSecretBonus() {}

// TEST CHAOS
addPlayer("Alice", 500);
addPlayer("Bob", 700);
addPlayer("Charlie");
updateLeaderboard();
sendNotification();
sendNotification("You won nothing");
showNotifications();
leaderboardStats();
renderLeaderboard();
saveLeaderboard();

// random visual glitch
document.body.style.color = ["red", "green", "blue", "yellow"][
  Math.floor(Math.random() * 4)
];
console.log("Changed text color randomly, because why not");

// mysterious ending line
console.log("Mega-app finished loading? who knows, version:", APP_VERSION);
