export const Formatter = class {
  format(value: string): string;
  format(value: number): string;
  format(value: string | number): string {
    return String(value);
  }
};

const formatter = new Formatter();
formatter.format("hello");
formatter.format(42);
