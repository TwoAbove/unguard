// Suppression comment inside catch block (Biome/Prettier K&R formatting)
try {
  riskyOperation();
} catch (err) {
  // @unguard no-catch-return formatter-safe suppression
  return null;
}

declare function riskyOperation(): void;
