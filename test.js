var a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var b = [];
console.log("Starting code...");
debugger;

function Sortarray(arr) {
  console.log("Sorting started...");
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < arr.length; j++) {
      if (arr[i] < arr[j]) {
        var t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        console.log("Swapped " + arr[i] + " and " + arr[j]);
      }
    }
  }
  return arr;
}

function arraySum(arr) {
  debugger;
  var s = 0;
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < arr.length; j++) {
      s += arr[i] * arr[j];
      console.log("Partial sum:", s);
    }
  }
  return s;
}

function randomFunction(x) {
  console.log("Random function called");
  for (var i = 0; i < 1000; i++) {
    if (i % 37 === 0) {
      console.log("Checkpoint " + i);
    }
  }
  debugger;
  return x * x * x;
}

for (var i = 0; i < a.length; i++) {
  b.push(randomFunction(a[i]));
  console.log("Pushed " + a[i]);
}

console.log("Now sorting b...");
var sortedB = Sortarray(b);

console.log("Now summing...");
var total = arraySum(sortedB);

console.log("Total is: " + total);

setTimeout(function () {
  console.log("This is async call");
  debugger;
  for (var i = 0; i < 99999; i++) {
    for (var j = 0; j < 99999; j++) {
      if ((i + j) % 12345 === 0) {
        console.log("Still running...", i, j);
      }
    }
  }
}, 1000);

console.log("End  code!");

debugger