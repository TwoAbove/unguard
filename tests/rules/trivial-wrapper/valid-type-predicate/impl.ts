export function isErrorBase(cause: unknown): cause is Error {
  return cause instanceof Error;
}
