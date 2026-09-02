export interface NarrowOptions {
  tag?: string;
}

export interface BaseOptions {
  tag?: string;
}

export function report(narrow: NarrowOptions): string {
  return audit(narrow);
}

export function audit(options: BaseOptions): string {
  if ("tag" in options) return "tagged";
  return "plain";
}
