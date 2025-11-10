// Example of "bad" JavaScript code
var x = 10;
if ((x = 5))
  // <- assignment instead of comparison!
  console.log("x is five");
else console.log("x is not five");

function doSomething() {
  for (
    i = 0;
    i < 10;
    i++ // <- missing 'let' or 'var', pollutes global scope
  ) {
    setTimeout(function () {
      console.log(i); // <- all prints 10 because of closure issue
    }, 1000);
  }
}
doSomething();
