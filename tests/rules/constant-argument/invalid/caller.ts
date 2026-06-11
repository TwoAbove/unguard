import { fetchRows, render } from "./callee";

fetchRows("users", 100);
fetchRows("orders", 100);
fetchRows("events", 100);

render("a", true);
render("b", true);
render("c", true);
