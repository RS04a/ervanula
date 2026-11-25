import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Admin } from "../full/app.jsx";
import { Landing } from "./landing.jsx";
import "./tailwind.css";
import "../full/style.css";
import "./site.css";
import "./brand.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route
        path="*"
        element={
          <main className="site site-not-found mx-auto">
            <h1>Página no encontrada</h1>
            <Link to="/">Volver a ARVELUNA</Link>
          </main>
        }
      />
    </Routes>
  </BrowserRouter>,
);
