import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { button, feedbackMessage, form, heading, id } from "./ui.js";
import { icon } from "./icons.js";
import { BrandImage } from "../site/brand.jsx";
import { adminLogin, adminUrl, readAdminRoute } from "./routes.js";
import { cash, inventory, payments, products, sales } from "./operations.js";
import { imports, settings } from "./management.js";
import {
  dashboard,
  diagnostics,
  recommendations,
  simulation,
} from "./analytics.js";

const views = {
  dashboard: ["Resumen", dashboard],
  sales: ["Ventas", sales],
  products: ["Productos", products],
  inventory: ["Inventario", inventory],
  cash: ["Caja", cash],
  payments: ["Pagos", payments],
  imports: ["Importación", imports, true],
  diagnostics: ["Diagnósticos", diagnostics],
  simulation: ["Simulaciones", simulation],
  recommendations: ["Recomendaciones", recommendations],
  settings: ["Configuración", settings],
};
const navGroups = [
  ["General", [["dashboard", "dashboard"]]],
  [
    "Operaciones",
    [
      ["inventory", "inventory"],
      ["sales", "sales"],
      ["cash", "cash"],
      ["payments", "payments"],
    ],
  ],
  [
    "Gestión",
    [
      ["imports", "imports"],
      ["diagnostics", "analytics", "Análisis"],
      ["settings", "settings"],
    ],
  ],
];
const sections = [
  {
    label: "Inventario",
    routes: ["inventory", "products"],
    labels: ["Existencias", "Productos"],
  },
  {
    label: "Análisis",
    routes: ["diagnostics", "simulation", "recommendations"],
  },
];

function useSession() {
  const [session, setSession] = useState({ status: "loading" });
  const refresh = useCallback(async (signal) => {
    try {
      const [user, merchant] = await Promise.all([
        api("identity/session", undefined, signal),
        api("merchant/profile", undefined, signal),
      ]);
      if (!signal?.aborted) setSession({ status: "ready", user, merchant });
    } catch (error) {
      if (signal?.aborted) return;
      if (error.status === 401) {
        setSession({ status: "signed-out" });
        return;
      }
      throw error;
    }
  }, []);
  const check = useCallback(
    async (signal) => {
      setSession({ status: "loading" });
      try {
        await refresh(signal);
      } catch (error) {
        if (!signal?.aborted) setSession({ status: "error", error });
      }
    },
    [refresh],
  );
  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);
  const signOut = useCallback(
    (reason) => setSession({ status: "signed-out", reason }),
    [],
  );
  return { session, check, refresh, signOut };
}

function SkipLink({ content }) {
  return (
    <a
      className="skip-link"
      href="#content"
      onClick={(event) => {
        event.preventDefault();
        content.current?.focus();
      }}
    >
      Ir al contenido
    </a>
  );
}

function Entry({ children, busy = false }) {
  const content = useRef(null);
  return (
    <div className="shell">
      <SkipLink content={content} />
      <header className="top">
        <Link to="/" aria-label="ARVELUNA, inicio">
          <BrandImage variant="horizontal" />
        </Link>
        <Link className="entry-back" to="/">
          Ir al sitio público
        </Link>
      </header>
      <main id="content" ref={content} tabIndex={-1} aria-busy={busy}>
        {children}
      </main>
    </div>
  );
}

function Login({ refresh }) {
  return (
    <Entry>
      {heading(
        "Iniciar sesión",
        "Panel del comercio",
        "Accede con las credenciales asignadas a tu comercio.",
      )}
      <section className="panel">
        <h2>Credenciales</h2>
        {form(
          "Entrar",
          [
            [
              "email",
              "Correo",
              { type: "email", autocomplete: "username", maxlength: 120 },
            ],
            [
              "password",
              "Contraseña",
              {
                type: "password",
                autocomplete: "current-password",
                maxlength: 128,
              },
            ],
          ],
          async (input) => {
            await api("identity/login", input);
            await refresh();
          },
        )}
      </section>
    </Entry>
  );
}

export function Admin() {
  const { session, check, refresh, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname.replace(/\/$/, "");
  const route = readAdminRoute(pathname);
  const login = pathname === adminLogin;
  const dashboardPath = adminUrl("dashboard");
  const pageTitle = login
    ? "Iniciar sesión"
    : route
      ? views[route.view][0]
      : "Panel del comercio";
  useEffect(() => {
    document.title = `${pageTitle} · ARVELUNA`;
  }, [pageTitle]);

  if (session.status === "loading")
    return (
      <Entry busy>
        <p className="view-status" role="status">
          Cargando sesión…
        </p>
      </Entry>
    );
  if (session.status === "error")
    return (
      <Entry>
        {heading("Servicio no disponible")}
        <p role="alert" className="error">
          {feedbackMessage(session.error)}
        </p>
        {button("Reintentar", () => void check())}
      </Entry>
    );
  if (login) {
    if (session.status === "ready") {
      const next = location.state?.next;
      return (
        <Navigate
          replace
          to={
            typeof next === "string" && readAdminRoute(next)
              ? next
              : dashboardPath
          }
        />
      );
    }
    return <Login refresh={refresh} />;
  }
  if (session.status === "signed-out")
    return (
      <Navigate
        replace
        to={adminLogin}
        state={
          session.reason === "logout"
            ? null
            : { next: route ? pathname : dashboardPath }
        }
      />
    );
  if (pathname === "/admin") return <Navigate replace to={dashboardPath} />;
  if (!route)
    return (
      <Entry>
        {heading("Página del panel no encontrada")}
        <Link to={dashboardPath}>Volver al resumen</Link>
      </Entry>
    );

  const logout = async () => {
    await api("identity/logout", {});
    signOut("logout");
  };
  return (
    <AdminWorkspace
      key={pathname}
      route={route}
      session={session}
      refresh={refresh}
      logout={logout}
      signOut={signOut}
      navigate={navigate}
    />
  );
}

function AdminWorkspace({
  route,
  session,
  refresh,
  logout,
  signOut,
  navigate,
}) {
  const { view, selected } = route;
  const [title, load, restricted] = views[view];
  const { user, merchant } = session;
  const admin = user.role === "ADMIN";
  const section = sections.find(({ routes }) => routes.includes(view));
  const primary = section?.routes[0] ?? view;
  const main = useRef(null);
  const toggle = useRef(null);
  const sidebar = useRef(null);
  const [menu, setMenu] = useState(false);
  const [state, setState] = useState({ page: 0, selected });
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState({ loading: true });
  const [revision, setRevision] = useState(0);
  const activeTask = useRef(false);
  const focusNext = useRef(true);
  const refreshView = useCallback(() => setRevision((value) => value + 1), []);
  const task = useCallback(
    async (work, reload = false, success = "Operación registrada.") => {
      if (activeTask.current) return;
      activeTask.current = true;
      setNotice({ text: "Procesando…" });
      try {
        await work();
        setNotice({ text: success });
        if (reload) refreshView();
      } catch (error) {
        if (error.status === 401) signOut();
        else setNotice({ text: feedbackMessage(error), error: true });
      } finally {
        activeTask.current = false;
      }
    },
    [refreshView, signOut],
  );
  const go = useCallback((patch, nextFocus = false) => {
    focusNext.current = nextFocus;
    setState((previous) => ({ ...previous, ...patch }));
  }, []);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 840px)");
    const reset = () => {
      if (mobile.matches && sidebar.current?.contains(document.activeElement))
        toggle.current?.focus();
      setMenu(false);
    };
    mobile.addEventListener("change", reset);
    return () => mobile.removeEventListener("change", reset);
  }, []);
  useEffect(() => {
    if (result.loading || !focusNext.current) return;
    focusNext.current = false;
    main.current?.focus();
  }, [result]);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer;
    const post = (path, body) => api(path, body);
    async function fetchView(background = false) {
      if (
        background &&
        document.activeElement !== main.current &&
        main.current?.contains(document.activeElement)
      ) {
        timer = window.setTimeout(() => void fetchView(true), 2800);
        return;
      }
      if (!background) setResult({ loading: true });
      let polling = false;
      try {
        const content =
          restricted && !admin
            ? [
                heading(title),
                <section className="panel">
                  <h2>Acceso restringido</h2>
                  <p role="alert">Se requiere rol ADMIN.</p>
                </section>,
              ]
            : await load({
                admin,
                userId: user.userId,
                state,
                go,
                post,
                navigate,
                task,
                refreshIdentity: refresh,
                get: (path) => api(path, undefined, signal),
                poll: () => {
                  polling = true;
                },
                action: (path, body = {}, message) => {
                  if (!message || window.confirm(message))
                    return task(() => post(path, body), true);
                },
                referenced: (path, map = (data) => data, message) => {
                  let reference = id();
                  return async (data) => {
                    if (message && !window.confirm(message)) return false;
                    await post(path, { ...map(data), reference });
                    reference = id();
                    go({});
                  };
                },
              });
        if (signal.aborted) return;
        setResult({ content });
        if (polling)
          timer = window.setTimeout(() => void fetchView(true), 2800);
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) signOut();
        else setResult({ error });
      }
    }
    void fetchView();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    load,
    restricted,
    admin,
    user.userId,
    state,
    revision,
    title,
    task,
    signOut,
    refresh,
    navigate,
    go,
  ]);

  const [header, ...panels] = result.content ?? [];
  const today = new Date();
  const initials = user.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="shell signed-in"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu) {
          setMenu(false);
          toggle.current?.focus();
        }
      }}
    >
      <SkipLink content={main} />
      <header className="top">
        <button
          ref={toggle}
          className="menu-toggle"
          type="button"
          aria-expanded={menu}
          aria-controls="sidebar"
          onClick={() => setMenu(!menu)}
        >
          {icon("menu")} Menú
        </button>
        <div className="breadcrumb">
          <Link className="brand" to="/" aria-label="ARVELUNA, inicio">
            <span>ARVELUNA</span>
            <BrandImage variant="symbol" decorative />
          </Link>
          <span className="crumb-divider" aria-hidden="true">
            /
          </span>
          <span>{title}</span>
        </div>
        <time
          id="today"
          dateTime={new Intl.DateTimeFormat("sv-SE", {
            timeZone: "America/Bogota",
          }).format(today)}
        >
          {new Intl.DateTimeFormat("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "America/Bogota",
          }).format(today)}
        </time>
      </header>
      <aside ref={sidebar} className="sidebar" id="sidebar" data-open={menu}>
        <Link className="sidebar-brand" to="/" aria-label="ARVELUNA, inicio">
          <BrandImage variant="symbol" decorative />
          <span>ARVELUNA</span>
        </Link>
        <div className="store-card">
          <span className="store-icon">{icon("store")}</span>
          <div>
            <span className="store-label">Comercio activo</span>
            <strong>{merchant.name}</strong>
          </div>
        </div>
        <nav aria-label="Navegación principal">
          {navGroups.map(([group, links]) => (
            <div className="nav-group" key={group}>
              <p className="nav-label">{group}</p>
              {links
                .filter(([key]) => admin || !views[key][2])
                .map(([key, symbol, label]) => (
                  <Link
                    key={key}
                    to={adminUrl(key)}
                    aria-current={
                      primary === key
                        ? view === key
                          ? "page"
                          : "true"
                        : undefined
                    }
                    onClick={() => {
                      setMenu(false);
                      if (view === key && !selected) main.current?.focus();
                    }}
                  >
                    {icon(symbol)}
                    {label ?? views[key][0]}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="account-copy">
            <strong>{user.displayName}</strong>
            <span>{user.role}</span>
          </div>
          {button("Salir", () => task(logout))}
        </div>
      </aside>
      <main
        id="content"
        ref={main}
        tabIndex={-1}
        aria-busy={Boolean(result.loading)}
      >
        {result.loading ? (
          <p role="status" className="view-status">
            Cargando…
          </p>
        ) : (
          <>
            {header ?? heading(title)}
            {section && (
              <nav className="section-tabs" aria-label={section.label}>
                {section.routes.map((key, index) => (
                  <Link
                    key={key}
                    to={adminUrl(key)}
                    aria-current={key === view ? "page" : undefined}
                  >
                    {section.labels?.[index] ?? views[key][0]}
                  </Link>
                ))}
              </nav>
            )}
            {result.error ? (
              <section className="panel">
                <h2>No se pudo cargar la vista</h2>
                <p role="alert" className="error">
                  {feedbackMessage(result.error)}
                </p>
                {button("Reintentar", refreshView)}
              </section>
            ) : (
              panels.map(
                (panel, index) =>
                  panel && <Fragment key={index}>{panel}</Fragment>,
              )
            )}
          </>
        )}
        {notice && (
          <p
            role="status"
            className={notice.error ? "feedback error" : "feedback"}
          >
            {notice.text}
          </p>
        )}
      </main>
    </div>
  );
}
