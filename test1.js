// ====================================================
// Perfected version of your JS example
// ====================================================

var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var b = [];

console.log("Starting code...");
debugger;

// --- Asynchronous Task (simulate heavy async work) ---
setTimeout(function () {
  console.log("Async call started...");
  var count = 0;
  var limit = 100000;
  for (var i = 0; i < limit; i++) {
    for (var j = 0; j < limit; j++) {
      if ((i + j) % 25000 === 0 && count < 10) {
        console.log("Still running...", i, j);
        count++;
      }
    }
  }
  console.log("Async loop finished.");
}, 1000);

// --- Bubble Sort Implementation (optimized) ---
function sortArray(arr) {
  console.log("Sorting started...");
  var n = arr.length;
  var swapped;
  do {
    swapped = false;
    for (var i = 0; i < n - 1; i++) {
      if (arr[i] > arr[i + 1]) {
        var temp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = temp;
        swapped = true;
      }
    }
  } while (swapped);
  console.log("Sorting completed.");
  return arr;
}

// --- Calculate sum of all pair products ---
function arraySum(arr) {
  debugger;
  console.log("Calculating total sum...");
  var sum = 0;
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < arr.length; j++) {
      sum += arr[i] * arr[j];
    }
  }
  console.log("Sum calculation completed.");
  return sum;
}

// --- Random utility function ---
function randomFunction(x) {
  console.log("Random function called for:", x);
  for (var i = 0; i < 1000; i++) {
    if (i % 100 === 0) {
      console.log("Checkpoint:", i);
    }
  }
  debugger;
  return Math.pow(x, 3);
}

// --- Main Execution Flow ---
for (var i = 0; i < a.length; i++) {
  var val = randomFunction(a[i]);
  b.push(val);
  console.log("Pushed:", val);
}

console.log("Now sorting b...");
var sortedB = sortArray(b);

console.log("Now calculating total...");
var total = arraySum(sortedB);

console.log("Total is:", total);

// --- Another async task simulation ---
setTimeout(function () {
  console.log("Async call #2 started...");
  var count = 0;
  for (var i = 0; i < 50000; i++) {
    for (var j = 0; j < 50000; j++) {
      if ((i + j) % 30000 === 0 && count < 10) {
        console.log("Still running async #2...", i, j);
        count++;
      }
    }
  }
  console.log("Async #2 complete.");
}, 2000);

console.log("End of code execution.");
