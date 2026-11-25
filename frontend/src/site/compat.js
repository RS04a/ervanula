import { adminSegments, adminUrl, readAdminRoute } from "../full/routes.js";

const [view, selected] = window.location.hash.slice(1).split("/");
const target = Object.hasOwn(adminSegments, view) && adminUrl(view, selected);
window.location.replace(
  target && readAdminRoute(target) ? target : adminUrl("dashboard"),
);
