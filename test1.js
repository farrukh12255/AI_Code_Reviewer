// absolutely cursed JavaScript

var a = 1;
function b(x) {
  if (x == undefined) x = prompt("gimme number lol");
  while (x != a) {
    if (x > a) {
      alert("too big");
    } else {
      alert("too small");
    }
    a = Math.floor(Math.random() * 10);
    x = prompt("try again idk");
  }
  alert("u did it i guess");
}
b();
