export class Formatter {
  protected format(value: string): string; // @expect dead-overload
  protected format(value: number): string;
  protected format(value: string | number): string {
    return String(value);
  }
}

export class Renderer extends Formatter {
  render(): string {
    return this.format(42);
  }
}

new Renderer().render();
