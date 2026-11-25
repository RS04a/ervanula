import { useEffect } from "react";
import { Link } from "react-router-dom";
import { icon } from "../full/icons.js";
import { adminLogin } from "../full/routes.js";
import { BrandImage } from "./brand.jsx";

const features = [
  [
    "inventory",
    "Inventario",
    "Consulta existencias y registra entradas, salidas y reservas de cada producto.",
  ],
  [
    "sales",
    "Ventas y caja",
    "Registra ventas, abre y cierra caja y revisa el efectivo esperado en COP.",
  ],
  [
    "payments",
    "Pagos verificables",
    "Vincula órdenes con evidencia TRC-20 y consulta su auditoría.",
  ],
  [
    "imports",
    "Importación CSV",
    "Revisa las filas antes de aplicarlas y detecta errores del catálogo.",
  ],
  [
    "analytics",
    "Análisis operativo",
    "Consulta indicadores por activo, detecta faltantes y simula escenarios.",
  ],
  [
    "settings",
    "Accesos por comercio",
    "Administra usuarios, permisos y direcciones receptoras desde el panel.",
  ],
];
const team = ["Alberto Russell", "Yalal Ajram Elneser"];

function Logo() {
  return (
    <Link to="/" className="site-logo" aria-label="ARVELUNA, inicio">
      <BrandImage variant="horizontal" />
    </Link>
  );
}
function AccessLink({ children = "Entrar al panel" }) {
  return (
    <Link className="site-primary" to={adminLogin}>
      {children}
      {icon("arrow")}
    </Link>
  );
}

export function Landing() {
  useEffect(() => {
    document.title = "ARVELUNA · Gestión para pequeños comercios";
  }, []);
  return (
    <div className="site">
      <a href="#public-content" className="skip-link">
        Ir al contenido
      </a>
      <header className="site-top">
        <div className="site-container flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <Logo />
          <nav
            className="site-nav flex items-center gap-5"
            aria-label="Navegación pública"
          >
            <a href="#que-hacemos">Qué hacemos</a>
            <a href="#quienes-somos">Quiénes somos</a>
          </nav>
          <AccessLink />
        </div>
      </header>
      <main id="public-content" tabIndex={-1}>
        <section className="site-hero">
          <div className="site-container hero-grid grid items-center">
            <div>
              <p className="site-eyebrow">
                <span /> GESTIÓN PARA PEQUEÑOS COMERCIOS
              </p>
              <h1>
                Gestiona tu comercio <em>con claridad.</em>
              </h1>
              <p className="hero-description">
                Organiza tus ventas, conoce tus existencias y revisa tu caja
                desde un solo panel.
              </p>
              <div className="hero-actions flex flex-wrap items-center gap-3">
                <AccessLink />
                <a className="site-secondary" href="#que-hacemos">
                  Explorar módulos
                </a>
              </div>
            </div>
            <figure className="site-preview">
              <div className="preview-window">
                <div className="preview-bar">
                  <span />
                  <span />
                  <span />
                  <strong>Panel del comercio</strong>
                </div>
                <img
                  width="1440"
                  height="1104"
                  src="/media/panel-arveluna.png"
                  alt="Resumen del panel ARVELUNA con indicadores de ventas, caja, pagos e inventario."
                  fetchPriority="high"
                />
              </div>
              <figcaption>Vista del panel en un entorno de prueba</figcaption>
            </figure>
          </div>
        </section>
        <section className="site-section site-container" id="que-hacemos">
          <div className="section-heading">
            <p className="site-eyebrow">QUÉ HACEMOS</p>
            <h2>Las operaciones de tu comercio, en un solo lugar.</h2>
            <p>
              Desde el primer producto hasta el cierre de caja, cada operación
              conserva su registro.
            </p>
          </div>
          <div className="feature-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([symbol, title, copy]) => (
              <article key={symbol} className="feature-card">
                <div className="feature-icon">{icon(symbol)}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="site-section site-container" id="quienes-somos">
          <div className="about-card grid gap-8 md:grid-cols-2">
            <div className="section-heading">
              <p className="site-eyebrow">QUIÉNES SOMOS</p>
              <h2>Un proyecto universitario pensado para comercios reales.</h2>
              <p>
                Desarrollamos ARVELUNA en la Universidad del Norte para explorar
                cómo pequeñas tiendas pueden llevar un registro claro de lo que
                venden, cobran y tienen en inventario.
              </p>
            </div>
            <div className="team">
              <h3>Equipo de ARVELUNA</h3>
              <ul>
                {team.map((name) => (
                  <li key={name}>
                    <span aria-hidden="true">
                      {name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="site-container site-section">
          <div className="site-cta flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2>¿Ya tienes acceso a un comercio?</h2>
              <p>Inicia sesión para ver tus operaciones.</p>
            </div>
            <AccessLink>Ir a administración</AccessLink>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-container flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <p>Proyecto académico · Universidad del Norte</p>
          <Link to={adminLogin}>Acceso al panel</Link>
        </div>
      </footer>
    </div>
  );
}
