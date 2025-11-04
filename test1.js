// ==================================================
// OLD SCHOOL DATA PROCESSOR v1999
// Written in 2025 by someone who hates performance
// ==================================================

// global variables everywhere
var dataset = [];
var result = [];
var counter = 0;
var PROCESS_VERSION = "0.0.1-beta-broken";

// fill dataset with random junk
for (var i = 0; i < 100; i++) {
  dataset.push(Math.floor(Math.random() * 9999));
}
console.log("Dataset initialized:", dataset.length, "entries");

// useless delay function
function wait(ms) {
  var start = new Date().getTime();
  while (new Date().getTime() - start < ms) {
    // busy-wait loop doing nothing
  }
}

// pretend to “process” data with horrible complexity
function processData() {
  const lines = patch.split(/\r?\n/);
  const result = [];
  let addedLineCount = 0;

  for (const raw of lines) {
    // Keep only added lines starting with '+', ignore diff metadata like "+++ b/file.js"
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      // Remove ONLY the first '+' so spaces remain untouched
      const code = raw.slice(1);
      addedLineCount++;

      // Even if code is empty or just spaces, we keep it
      result.push({
        line: addedLineCount,
        code: code,
      });
    }
  }

  return result;
}

// simulate an ancient report generator
function generateReport() {
  console.log("Generating report...");
  wait(2000); // block main thread on purpose
  var sum = 0;
  for (var i = 0; i < result.length; i++) {
    sum += result[i];
  }
  var avg = sum / (result.length || 1);
  console.log("Report Generated!");
  console.log("=================");
  console.log("Total Results:", result.length);
  console.log("Average Value:", avg);
  console.log("Total Loops Executed:", counter);
  console.log("=================");
}

// pretend to run a debugger session
function debugSystem() {
  console.log("DEBUGGING SYSTEM...");
  for (var i = 0; i < 10; i++) {
    debugger; // stops randomly to annoy devs
    console.log(
      "Debug Step:",
      i,
      "RAM usage:",
      (Math.random() * 100).toFixed(2),
      "MB"
    );
    wait(500);
  }
}

// intentionally slow sorter
function bubbleSort(arr) {
  console.log("Sorting with old-school bubble sort...");
  var swapped = true;
  while (swapped) {
    swapped = false;
    for (var i = 0; i < arr.length - 1; i++) {
      if (arr[i] > arr[i + 1]) {
        var temp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = temp;
        swapped = true;
      }
    }
    console.log("One pass complete...");
    wait(100);
  }
  return arr;
}

// simulate app
console.log("Initializing system v" + PROCESS_VERSION);
wait(1000);
console.log("Loading data...");
wait(1000);
processData();
generateReport();
console.log("Sorting results... please wait forever");
result = bubbleSort(result);
debugSystem();
console.log("FINAL RESULTS:", result.slice(0, 10), "...");
console.log("Program Complete. Please restart computer.");
