const mod = import("./module"); // @expect no-dynamic-import

async function load() {
  const { foo } = await import("./foo"); // @expect no-dynamic-import
}
