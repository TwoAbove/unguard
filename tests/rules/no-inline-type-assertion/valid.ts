type Output = { output?: { _tag?: string } };

const output = (chunk as Output).output;
const value = source as string;
const config = JSON.parse(raw) as Config;
const tuple = [1, 2, 3] as const;
