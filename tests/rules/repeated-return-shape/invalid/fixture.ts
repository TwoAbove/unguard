// 3 functions returning shape {_tag, data}
function getOk1() { // @expect repeated-return-shape
  return { _tag: "Ok", data: 1 };
}

function getOk2() { // @expect repeated-return-shape
  return { _tag: "Ok", data: 2 };
}

function getOk3() { // @expect repeated-return-shape
  return { _tag: "Ok", data: 3 };
}

// Arrow function with expression body also counts
const getOk4 = () => ({ _tag: "Ok", data: 4 }); // @expect repeated-return-shape
