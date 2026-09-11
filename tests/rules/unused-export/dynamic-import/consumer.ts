// Static imports would bypass the dynamic module-loading boundary under test.
async function main(): Promise<number> {
  return (await import("./library.js")).work();
}

void main();
