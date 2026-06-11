export interface UsedShape {
  id: string;
}

export interface UnusedShape { // @expect unused-export
  id: number;
}

export type UsedAlias = { name: string };

export type UnusedAlias = { name: number }; // @expect unused-export

export const USED_LIMIT = 10;

export const UNUSED_LIMIT = 20; // @expect unused-export

export type SameFileUsed = { flag: boolean };

export const SAME_FILE_USED = 5;

export function takesLocal(input: SameFileUsed): number {
  return input.flag ? SAME_FILE_USED : 0;
}
