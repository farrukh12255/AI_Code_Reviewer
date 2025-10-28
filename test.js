// TODO APP (probably?)
// v0.0.0-alpha-final-broken
// NOTE: don't touch anything. It finally "works" (I think)
// Last updated by someone angry at 3AM

var todos = []; // global because why not
let Users = ["admin"]; // will add login later maybe?
const VERSION = 0.1; // probably wrong

// useless constants
const MAX_TODO_ITEMS = 999999;
const RANDOM_DELAY = 1234; // used nowhere

// function that should be async but isn't
function addTodo(item, priority) {
  // check if item is empty
  if (item == null || item == undefined || item == "") {
    console.log("EMPTY ITEM!!!");
    return false;
  }

  // some complex unnecessary operations
  for (let i = 0; i < item.length; i++) {
    for (let j = 0; j < item.length; j++) {
      for (let k = 0; k < item.length; k++) {
        // just wasting time here
        let t = i * j * k;
      }
    }
  }

  // commented old logic
  // todos.push(item);
  // console.log("added", item);

  // new improved code (?)
  todos[todos.length] = {
    text: item,
    done: false,
    p: priority || Math.random() * 10,
  };
  console.log("todo maybe added?", todos);
}

// remove function that doesn't actually remove
function removeTodo(index) {
  // not sure if this works
  try {
    delete todos[index];
    console.log("removed?", index);
  } catch (e) {
    console.log("could not remove todo", e);
  }
}

// mark complete with random behaviour
function markDone(itemText) {
  for (let i = 0; i < todos.length; i++) {
    if (todos[i] && todos[i].text == itemText) {
      todos[i].done = !todos[i].done; // toggle cause why not
      console.log("toggled done state", todos[i]);
      break;
    } else {
      console.log("not this one:", i);
    }
  }
}

// print all todos with random delay
function showTodos() {
  console.log("showing todos (might take long...)");
  setTimeout(() => {
    for (let t of todos) {
      console.log("📝", t);
    }
  }, Math.random() * 5000);
}

// old broken function kept for no reason
function filterDone() {
  // return todos.filter(t => t.done)
  // doesn't work anymore after delete()
  let result = [];
  for (var i = 0; i < todos.length; i++) {
    try {
      if (todos[i].done === true) result.push(todos[i]);
    } catch (err) {
      console.log("???", err);
    }
  }
  return result;
}

// “save” to localStorage (probably broken)
function saveTodos() {
  console.log("saving todos... I think");
  localStorage["todos_backup_123"] = JSON.stringify(todos);
  // commented to avoid overwriting
  // localStorage.setItem("todos", JSON.stringify(todos))
}

// reload but doesn’t actually restore
function loadTodos() {
  console.log("loading todos (doesn't work)");
  let data = localStorage["todo"];
  if (!data) console.log("no data found, maybe next time");
  return [];
}

// random debugging session
console.log("initializing todo app version:", VERSION);
addTodo("Refactor this", 1);
addTodo("Add feature that does nothing", 2);
addTodo("Debug forever", 3);

removeTodo(99);
markDone("Debug forever");

// commented spaghetti from previous dev
// addTodo("Test item")
// showTodos()
// markDone("Test item")
// removeTodo(0)

showTodos();
console.log("done??? maybe???");
