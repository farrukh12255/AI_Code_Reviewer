// 100 lines of gloriously messy JS
var x = 0,
  y = 10,
  z = "hello";
function a() {
  return Math.random() * 100;
}
function b(q) {
  return q * q;
}
var c = [1, 2, 3, 4, 5];
var d = { foo: "bar", baz: 42 };
function e(f) {
  for (var i = 0; i < 10; i++) {
    f += i;
  }
  return f;
}
x += a();
y += b(5);
console.log("x:", x, "y:", y);
var foo = "world";
function f(g) {
  if (g > 5) {
    return g * 2;
  } else {
    return g / 2;
  }
}
for (var i = 0; i < 5; i++) {
  console.log(i, f(i));
}
console.log(d.foo, d.baz);

function g(h) {
  return h.split("").reverse().join("");
}
console.log(g("javascript"));
var arr = ["a", "b", "c", "d"];
arr.forEach(function (v, i) {
  console.log(i, v);
});
var sum = 0;
for (var i = 0; i < 10; i++) {
  sum += i;
}
console.log("sum:", sum);
function h(j) {
  return j % 2 == 0 ? "even" : "odd";
}
for (var k = 0; k < 10; k++) {
  console.log(k, h(k));
}

var str = "messy code";
function i(l) {
  return l.toUpperCase();
}
console.log(i(str));
var m = { x: 1, y: 2, z: 3 };
for (var key in m) {
  console.log(key, m[key]);
}
var n = [10, 20, 30];
var total = n.reduce(function (p, q) {
  return p + q;
}, 0);
console.log("total:", total);

function j(o) {
  while (o < 5) {
    console.log("loop", o);
    o++;
  }
  return o;
}
console.log(j(0));
var p = [1, 2, 3, 4, 5];
p.map(function (r) {
  return r * 2;
}).forEach(function (s) {
  console.log(s);
});
var q = "concat";
var r = q + "enation";
console.log(r);

function k(t) {
  try {
    if (t < 0) {
      throw "negative number";
    }
  } catch (e) {
    console.log("error:", e);
  } finally {
    console.log("finally block");
  }
}
k(-1);
var u = ["x", "y", "z"];
for (var v of u) {
  console.log(v);
}
var w = [{ a: 1 }, { b: 2 }];
w.forEach(function (obj) {
  for (var key in obj) {
    console.log(key, obj[key]);
  }
});

var aa = 0;
function l(bb) {
  aa += bb;
  return aa;
}
console.log(l(5));
console.log(l(10));
var cc = "repeat";
for (var dd = 0; dd < 3; dd++) {
  console.log(cc + dd);
}
function m(ee) {
  return ee * ee * ee;
}
console.log(m(3));

var ff = ["one", "two", "three"];
ff.forEach(function (gg, hh) {
  console.log(hh, gg);
});
function n(ii) {
  return ii
    .split("")
    .map(function (c) {
      return c.charCodeAt(0);
    })
    .join("-");
}
console.log(n("abc"));
var jj = { k: 1, l: 2 };
console.log(Object.keys(jj), Object.values(jj));

function o(kk) {
  return kk % 3 == 0 ? "div3" : "notdiv3";
}
for (var ll = 0; ll < 10; ll++) {
  console.log(ll, o(ll));
}
var mm = [5, 10, 15, 20];
console.log(
  mm.filter(function (nn) {
    return nn > 10;
  })
);
var oo = "weird";
console.log(oo.repeat(3));

function p(pp) {
  return Math.sqrt(pp);
}
console.log(p(16));
var qq = [1, 2, 3, 4, 5];
console.log(
  qq.find(function (rr) {
    return rr > 3;
  })
);
var ss = { a: "A", b: "B" };
console.log(ss["a"]);
var tt = "abc";
console.log(tt.includes("b"));

function q(uu) {
  return uu + 100;
}
console.log(q(50));
var vv = ["x", "y", "z"];
console.log(vv.indexOf("y"));
var ww = 0;
while (ww < 3) {
  console.log("while", ww);
  ww++;
}
var xx = "concat" + "enate";
console.log(xx);

function r(yy) {
  return yy.toLowerCase();
}
console.log(r("HELLO"));
var zz = ["red", "green", "blue"];
for (var aaa of zz) {
  console.log(aaa);
}
var bbb = { c: 3, d: 4 };
for (var key in bbb) {
  console.log(key, bbb[key]);
}
function s(ccc) {
  return ccc * 10;
}
console.log(s(7));
