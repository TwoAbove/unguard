export class Formatter {
  private format(value: string): string;
  private format(value: number): string;
  private format(value: string | number): string {
    return String(value);
  }

  render(): string[] {
    return [this.format("hello"), this.format(42)];
  }
}

new Formatter().render();
