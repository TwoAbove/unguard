// Inline type used only once — should not trigger
function createUser(opts: { name: string; email: string }): void {}

// Named type reference — never triggers
type Config = { timeout: number };
function init(cfg: Config): void {}
