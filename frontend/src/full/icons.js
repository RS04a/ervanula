import { createElement } from "react";

// Small decorative UI symbols, sized and colored by the surrounding control.
const paths = {
  bag: "M5 7h14l1 14H4L5 7Zm4 2V6a3 3 0 0 1 6 0v3",
  store:
    "M3 9l2-5h14l2 5M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 14v6h14v-6M10 20v-4h4v4M3 9h18",
  menu: "M4 6h16M4 12h16M4 18h16",
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  inventory: "m12 3 9 5-9 5-9-5 9-5Zm-9 5v8l9 5 9-5V8m-9 5v8m-4-15 9 5",
  sales: "M3 4h2l2.5 11H18l2-7H6m2 11h.01M17 19h.01",
  cash: "M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7m18 6h-5v4h5",
  payments: "M3 5h18v14H3zM3 10h18M7 15h4",
  imports: "M6 3h9l4 4v14H6zM14 3v5h5m-7 3v6m-3-3 3 3 3-3",
  analytics: "M4 4v16h16M8 16v-4m5 4V8m5 8V5",
  settings: "M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4",
  alert: "M12 3 2 20h20L12 3Zm0 6v4m0 3h.01",
  clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  empty: "M4 8h16l2 10H2L4 8Zm0 0 3-4h10l3 4m-18 6h6l2 2h4l2-2h6",
};
export function icon(name) {
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      "aria-hidden": true,
      focusable: false,
      className: "icon",
    },
    createElement("path", { d: paths[name] }),
  );
}
