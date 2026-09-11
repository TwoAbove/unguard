export const Formatter = class {
  format(value: string): string;
  format(value: number): string; // @expect dead-overload
  format(value: string | number): string {
    return String(value);
  }
};

new Formatter().format("hello");
