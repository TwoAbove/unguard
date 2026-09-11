export class Formatter {
  protected format(value: string): string;
  protected format(value: number): string;
  protected format(value: string | number): string {
    return String(value);
  }
}

export class Renderer extends Formatter {
  render(): string[] {
    return [this.format("hello"), this.format(42)];
  }
}

new Renderer().render();
