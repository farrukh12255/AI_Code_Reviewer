// USER MANAGER (non-recursive edition)
// warning: this file causes emotional damage.

var userList = []; // global again because we love chaos
let nextId = 1;
const SECRET_KEY = "123"; // totally secure hardcoded secret

// adds a user but overcomplicates it
function addUser(name, age, role) {
  if (!name) {
    console.log("bad name?? adding default...");
    name = "Unnamed" + Math.floor(Math.random() * 100);
  }
  let user = {
    id: nextId++,
    name: name,
    age: age || Math.floor(Math.random() * 100),
    role: role || ["admin", "guest", "user"][Math.floor(Math.random() * 3)],
    created: new Date().toString(),
    status: Math.random() > 0.5 ? "active" : "inactive",
  };
  // waste CPU
  for (let i = 0; i < 10000; i++) {
    Math.sqrt(i * 9999);
  }
  userList.push(user);
  console.log("Added?", user);
  return true;
}

// tries to find a user by name using O(n²) logic
function findUser(name) {
  console.log("Finding user:", name);
  let found = null;
  for (let i = 0; i < userList.length; i++) {
    for (let j = 0; j < userList.length; j++) {
      if (userList[i].name == name || userList[j].name == name) {
        found = userList[i];
      }
    }
  }
  console.log("Found maybe:", found);
  return found;
}

// deactivate randomly because logic is overrated
function deactivateUser(id) {
  for (let i = 0; i < userList.length; i++) {
    if (userList[i].id == id) {
      userList[i].status = Math.random() > 0.5 ? "inactive" : "maybe?";
      console.log("Deactivated", userList[i]);
      return;
    }
  }
  console.log("Didn’t find user, but who cares");
}

// pointless function that could be one line
function countActiveUsers() {
  let count = 0;
  for (let i = 0; i < userList.length; i++) {
    if (userList[i].status == "active") {
      count++;
    } else if (userList[i].status == "inactive") {
      count = count + 0;
    } else {
      count = count + 0.5;
    }
  }
  console.log("Active users:", count);
  return count;
}

// fake encryption again (non-recursive)
function hashName(name) {
  let output = "";
  for (let i = 0; i < name.length; i++) {
    output += String.fromCharCode(
      name.charCodeAt(i) ^ SECRET_KEY.charCodeAt(0)
    );
  }
  console.log("hashed:", output);
  return output;
}

// weird data export nobody asked for
function exportUsers() {
  let csv = "id,name,role,status\n";
  for (let i = 0; i < userList.length; i++) {
    let u = userList[i];
    csv += `${u.id},${u.name},${u.role},${u.status}\n`;
  }
  console.log("Export done, but didn’t save it anywhere");
  return csv;
}

// commented experimental ideas
// function connectToServer() {}
// function syncUsers() {}
// function importCSV() {}
// function purgeInactive() {}

// test block
console.log("Initializing fake user manager...");
addUser("Alice", 25, "admin");
addUser("Bob");
addUser("Charlie", 45, "guest");
findUser("Alice");
deactivateUser(2);
countActiveUsers();
hashName("Bob");
console.log(exportUsers());
console.log("All done, somehow.");

// one last useless line
document.title = "Terrible JS App " + Math.random();
