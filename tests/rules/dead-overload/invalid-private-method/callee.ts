export class Formatter {
  private format(value: string): string;
  private format(value: number): string; // @expect dead-overload
  private format(value: string | number): string {
    return String(value);
  }

  render(): string {
    return this.format("hello");
  }
}

new Formatter().render();
