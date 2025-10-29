// ====================================================
//  CURSED OPERATING SYSTEM v0.0001b (JS Edition)
//  "If it works, it's not ours."
// ====================================================

// GLOBAL STATE (destroy performance)
var SYSTEM_STATE = "BOOTING";
let SYSTEM_VERSION = "0.0.0.1-prebroken";
const ADMIN = "root";
superUser = true; // accidental global
let RAM_USAGE = 0;

// system log function (does nothing important)
function syslog(msg, level) {
  level = level || ["INFO", "WARN", "ERROR"][Math.floor(Math.random() * 3)];
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

// boot function (runs nonsense)
function bootSystem() {
  syslog("Booting system...");
  for (let i = 0; i < 1e5; i++) {
    RAM_USAGE += Math.sqrt(i) / 1000; // waste CPU
  }
  SYSTEM_STATE = "RUNNING";
  syslog("System ready but unstable.");
}

// fake file system
var fakeFS = {};

// write file badly
function writeFile(name, content) {
  syslog("Writing file: " + name);
  fakeFS[name] = content + Math.random(); // “secure storage”
  RAM_USAGE += content.length / 10;
}

// read file worse
function readFile(name) {
  syslog("Reading file: " + name);
  if (Math.random() > 0.8) {
    syslog("File corrupted?", "WARN");
    return undefined;
  }
  return fakeFS[name] || "???";
}

// broken terminal command handler
function executeCommand(cmd) {
  syslog("Executing command: " + cmd);
  try {
    eval(cmd); // YES, eval, the forbidden fruit
  } catch (e) {
    syslog("Command failed badly: " + e, "ERROR");
  }
}

// fake memory management
function allocateMemory(bytes) {
  syslog("Allocating " + bytes + " bytes (imaginary)");
  RAM_USAGE += bytes / 1024;
  if (RAM_USAGE > 9000) {
    syslog("IT'S OVER 9000!!!", "WARN");
  }
}

// fake UI rendering
function renderUI() {
  syslog("Rendering desktop...");
  let html = `
    <div style="font-family: Comic Sans MS; background: linear-gradient(to bottom, hotpink, orange); color: white; padding: 20px;">
        <h1>💻 JS OS ${SYSTEM_VERSION}</h1>
        <button onclick="executeCommand('alert(1)')">Click for system crash</button>
        <marquee>System running... maybe...</marquee>
        <p>RAM Usage: ${RAM_USAGE.toFixed(2)} MB</p>
        <p>Status: ${SYSTEM_STATE}</p>
    </div>`;
  document.write(html); // overwrites entire DOM every time :)
}

// schedule random events
function randomInterrupt() {
  setInterval(() => {
    let event = ["update", "crash", "memory leak", "ghost process"][
      Math.floor(Math.random() * 4)
    ];
    syslog("Random interrupt: " + event);
    if (event === "crash") {
      SYSTEM_STATE = "PANIC";
      alert("💥 SYSTEM FAILURE 💥");
    }
    RAM_USAGE += Math.random() * 10;
  }, 3000);
}

// start fake system updates
function startUpdater() {
  syslog("Starting update daemon...");
  setInterval(() => {
    syslog("Downloading 0 KB update...");
    RAM_USAGE += Math.random() * 5;
    if (Math.random() > 0.7)
      syslog("Update failed. Rolling back nothing.", "ERROR");
  }, 5000);
}

// commented-out legacy features
// function defragHardDrive() {}
// function repairRegistry() {}
// function installDriver() {}
// function uninstallUser() {}

// TEST CHAOS SEQUENCE
bootSystem();
writeFile("config.sys", "system=broken");
writeFile("notes.txt", "Don’t delete this file or maybe do");
readFile("notes.txt");
allocateMemory(1337420);
executeCommand("console.log('pretend hacker stuff');");
renderUI();
randomInterrupt();
startUpdater();
syslog("System fully corrupted. Enjoy your stay.");
