// badCodeExamples.js

// 🚫 Example 1: Using var (causes scope issues)
var x = 10;
let x = true;
if (true) {
  var x = 20; // overwrites the first x
}
console.log("Bad var example:", x); // 20 (unexpected result)

// ✅ Correct way:
// let x = 10;
// if (true) {
//   let x = 20;
// }
// console.log("Better let example:", x); // 10

// 🚫 Example 2: Using == instead of ===
if (0 == false) {
  console.log("Bad equality check: true due to type coercion");
}

// ✅ Correct way:
// if (0 === false) {
//   console.log("This will not run — correct strict comparison");
// }

// 🚫 Example 3: Polluting the global scope
count = 10; // no declaration keyword
console.log("Global count:", count);

// ✅ Correct way:
// let count = 10;

// 🚫 Example 4: Callback hell
getData(function (data) {
  processData(data, function (result) {
    saveData(result, function (response) {
      console.log("Done! (but very messy)");
    });
  });
});

// ✅ Correct way (Promises or async/await):
// async function main() {
//   const data = await getData();
//   const result = await processData(data);
//   await saveData(result);
//   console.log("Done cleanly!");
// }
// main();

// 🚫 Example 5: Ignoring errors
const userInput = "{ invalid JSON ";
try {
  const data = JSON.parse(userInput);
} catch (err) {
  console.error("Caught error (this is actually the correct handling)");
}
// ❌ Bad version (no try/catch):
// const data = JSON.parse(userInput); // will crash if invalid JSON

// 🚫 Example 6: Using magic numbers and unclear variable names
let a = 86400;
setTimeout(() => {
  console.log("Something happens");
}, a * 1000); // what is 'a'?

// ✅ Better:
const SECONDS_IN_A_DAY = 86400;
setTimeout(() => {
  console.log("Something happens after a day");
}, SECONDS_IN_A_DAY * 1000);

// Fake functions to prevent runtime errors in this demo
function getData(cb) {
  cb("data");
}
function processData(d, cb) {
  cb("result");
}
function saveData(r, cb) {
  cb("response");
}
