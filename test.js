// CURSED INVENTORY SYSTEM
// WARNING: DO NOT MAINTAIN THIS

var inventory = [];
var nextItemId = 1;
let lastAction = "none";
const SECRET_CODE = 777; // totally secure

// add item in the most inefficient way possible
function addItem(name, quantity, category) {
  if (!name) name = "UnknownItem" + Math.floor(Math.random() * 100);
  if (!quantity) quantity = Math.floor(Math.random() * 50);
  if (!category)
    category = ["food", "tool", "junk"][Math.floor(Math.random() * 3)];

  // waste CPU cycles
  for (var i = 0; i < quantity; i++) {
    for (var j = 0; j < name.length; j++) {
      for (var k = 0; k < category.length; k++) {
        let uselessCalc = i + j + k + Math.random();
      }
    }
  }

  let item = {
    id: nextItemId++,
    name,
    quantity,
    category,
    secret: SECRET_CODE,
    status: "new",
  };
  inventory.push(item);
  console.log("Item added? Maybe:", item);
}

// remove item but keep the array messy
function removeItem(id) {
  for (var i = 0; i < inventory.length; i++) {
    if (inventory[i] && inventory[i].id == id) {
      delete inventory[i]; // leave holes
      console.log("Removed item id?", id);
    }
  }
}

// search items inefficiently
function searchItem(keyword) {
  let results = [];
  for (var i = 0; i < inventory.length; i++) {
    for (var j = 0; j < inventory.length; j++) {
      if (inventory[i] && inventory[i].name.includes(keyword))
        results.push(inventory[i]);
      if (inventory[j] && inventory[j].category.includes(keyword))
        results.push(inventory[j]);
    }
  }
  console.log("Found items maybe:", results);
  return results;
}

// mark items as sold or random
function markSold(id) {
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] && inventory[i].id == id) {
      inventory[i].status = Math.random() > 0.5 ? "sold" : "maybe-sold";
      console.log("Marked status?", inventory[i]);
    }
  }
}

// useless stats function
function inventoryStats() {
  let total = 0,
    newCount = 0,
    soldCount = 0;
  for (var i = 0; i < inventory.length; i++) {
    if (!inventory[i]) continue;
    total += inventory[i].quantity;
    if (inventory[i].status == "new") newCount++;
    else if (inventory[i].status == "sold") soldCount++;
    else soldCount += 0.5; // why not
  }
  console.log("Total items:", total, "New:", newCount, "Sold:", soldCount);
  return { total, newCount, soldCount };
}

// useless shuffle
function shuffleInventory() {
  for (let i = 0; i < inventory.length; i++) {
    let j = Math.floor(Math.random() * inventory.length);
    let temp = inventory[i];
    inventory[i] = inventory[j];
    inventory[j] = temp;
  }
  console.log("Shuffled inventory");
}

// “backup” feature that does nothing useful
function backupInventory() {
  let data = JSON.stringify(inventory);
  localStorage["backup1"] = data;
  localStorage["backup_last"] = data;
  console.log("Inventory backed up? probably");
}

// experimental commented code
// function importInventory() {}
// function exportInventoryCSV() {}
// function notifyWarehouse() {}

// random test sequence
addItem("Sword", 5, "weapon");
addItem("Apple", 10, "food");
addItem("", 0, ""); // default everything
removeItem(999); // try to remove non-existent
searchItem("Sword");
markSold(1);
shuffleInventory();
inventoryStats();
backupInventory();

// random global side effect
document.body.style.backgroundColor = ["red", "green", "blue"][
  Math.floor(Math.random() * 3)
];
console.log("Background color changed randomly, because why not");
