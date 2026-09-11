export class Base {
  render(mode?: string): string {
    return mode ?? "empty";
  }
}
const base = new Base();
base.render("static");
base.render("static");
base.render("static");
