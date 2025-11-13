// BAD JavaScript Code Example 🤢

x = 5; // global variable leak
y = "10";
if ((x = y))
  // oops, assignment not comparison!
  console.log("x equals y?");
else console.log("Nope");

function add(a, b, c) {
  // third parameter unused
  return a + b + c; // NaN if c undefined
}
console.log(add(5)); // 😬 prints NaN

for (
  i = 0;
  i < 3;
  i++ // no let/var => global variable again
)
  setTimeout(function () {
    console.log("Loop i =", i); // prints "Loop i = 3" three times
  }, 1000);

var data = [1, 2, 3];
data[10] = 99; // creates weird holes in the array
console.log(data.length); // prints 11, but missing values

function badNamingFunction123() {
  alert("hi");
}
badNamingFunction123(); // no semicolon

// deeply nested nightmare
if (true) {
  if (true) {
    if (true) {
      if (true) {
        console.log("why tho");
      }
    }
  }
}
