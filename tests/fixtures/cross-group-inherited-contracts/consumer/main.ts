import { Base } from "../shared/base";

class Child extends Base {
  override render(mode?: string): string {
    return mode ?? "child";
  }
  own(label: string): string {
    return label;
  }
}
const child = new Child();
child.render("static");
child.render("static");
child.render("static");
const throughBase: Base = child;
throughBase.render();
throughBase.render("dynamic");
child.own("fixed");
child.own("fixed");
child.own("fixed");
