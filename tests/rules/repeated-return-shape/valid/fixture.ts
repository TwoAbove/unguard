// Only 2 functions with same return shape (below threshold of 3)
function getOk1() {
  return { _tag: "Ok", data: 1 };
}

function getOk2() {
  return { _tag: "Ok", data: 2 };
}

// Different return shape
function getErr() {
  return { _tag: "Err", code: "x", message: "y" };
}

// Not returning object literals
function getString() {
  return "hello";
}
