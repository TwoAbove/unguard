// Callbacks in call-expression argument position — not independent functions
type State = { value: string; cursor: number };
declare function setState(fn: (s: State) => State): void;

function handleInput() {
  setState((s) => ({ value: s.value + "a", cursor: s.cursor + 1 }));
}

function handleDelete() {
  setState((s) => ({ value: s.value.slice(0, -1), cursor: s.cursor - 1 }));
}

function handleReset() {
  setState((s) => ({ value: "", cursor: 0 }));
}

function handleReplace() {
  setState((s) => ({ value: "replaced", cursor: 0 }));
}
