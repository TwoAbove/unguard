// This function has an optional param — but it's NOT the one being called
export function process(data: string, verbose?: boolean) {
  if (verbose) console.log(data);
  return data.toUpperCase();
}
