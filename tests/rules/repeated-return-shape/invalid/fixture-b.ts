// 2 more functions returning shape {_tag, data} in a separate file — triggers cross-file detection
function getOk3() { // @expect repeated-return-shape
  return { _tag: "Ok", data: 3 };
}

const getOk4 = () => ({ _tag: "Ok", data: 4 });
