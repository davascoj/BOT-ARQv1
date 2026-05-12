let datosGlobales = [];
let datosOriginales = [];
let sectorActivo = "TODOS";
let contextoMercado = null;
const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshActivo = true;

function obtenerRepoGitHub() {
  const usuario = location.hostname.includes(".github.io")
    ? location.hostname.split(".github.io")[0]
    : "davascoj";

  const repoDetectado = location.pathname.split("/").filter(Boolean)[0];
  const repo = repoDetectado || "Analizador-acciones";

  return { usuario, repo };
}

function normalizarClase(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function actualizarEstadoAuto(mensaje, error = false) {
  const autoBox = document.getElementById("autoBox");
  const estadoSistema = document.getElementById("estadoSistema");

  if (autoBox) {
    autoBox.textContent = mensaje;
    autoBox.className = error ? "status-value auto-status auto-error" : "status-value auto-status";
  }

  if (estadoSistema) {
    estadoSistema.textContent = error ? "● Requiere revisión" : "● Sistema en línea";
    estadoSistema.className = error ? "status-pill error" : "status-pill online";
  }
}

async function cargarDatos() {
  const tabla = document.getElementById("tabla");
  const fecha = document.getElementById("fecha");
  const fechaHero = document.getElementById("fechaHero");
  const marketBox = document.getElementById("marketBox");
  const resumen = document.getElementById("resumen");
  const contador = document.getElementById("contadorResultados");

  if (tabla) tabla.innerHTML = `<tr><td colspan="17">Cargando datos...</td></tr>`;
  if (resumen) resumen.textContent = "Cargando resumen...";
  if (contador) contador.textContent = "Cargando resultados...";

  try {
    const resp = await fetch("datos_acciones.json?nocache=" + Date.now());
    if (!resp.ok) throw new Error("No existe datos_acciones.json todavía");

    const data = await resp.json();
    const fechaTexto = data.actualizado || "sin fecha";

    if (fecha) fecha.textContent = "Última actualización de datos: " + fechaTexto;
    if (fechaHero) fechaHero.textContent = fechaTexto;

    contextoMercado = data.contexto_mercado || null;
    datosGlobales = data.resultados || [];
    datosOriginales = data.resultados || [];

    pintarMercado();
    pintarResumen();
    renderTabla();
    actualizarEstadoAuto("Activo: datos cada 5 min");

  } catch (e) {
    if (fecha) fecha.textContent = "Sin datos";
    if (fechaHero) fechaHero.textContent = "Sin datos";
    if (marketBox) {
      marketBox.textContent = "Sin datos";
      marketBox.className = "status-value market-status";
    }
    if (resumen) resumen.textContent = "No hay resumen disponible.";
    if (contador) contador.textContent = "No hay resultados cargados";
    actualizarEstadoAuto("Error: revisa datos_acciones.json o GitHub Actions", true);
    if (tabla) tabla.innerHTML = `<tr><td colspan="17">No se pudieron cargar datos. Abre GitHub Actions y presiona Run workflow.</td></tr>`;
  }
}

function pintarMercado() {
  const marketBox = document.getElementById("marketBox");
  if (!marketBox) return;

  if (!contextoMercado) {
    marketBox.textContent = "Sin datos";
    marketBox.className = "status-value market-status";
    return;
  }

  const estado = contextoMercado.estado || "NEUTRO";
  const spy = contextoMercado.spy20 ?? 0;
  const qqq = contextoMercado.qqq20 ?? 0;

  marketBox.textContent = `${estado} · SPY ${spy}% · QQQ ${qqq}%`;
  marketBox.className = "status-value market-status " + normalizarClase(estado);
}

function pintarResumen() {
  const resumen = document.getElementById("resumen");
  if (!resumen) return;

  const total = datosOriginales.length;
  const fuertes = datosOriginales.filter(r => r.Senal === "COMPRA FUERTE").length;
  const posibles = datosOriginales.filter(r => r.Senal === "POSIBLE COMPRA").length;
  const vigilar = datosOriginales.filter(r => r.Senal === "VIGILAR").length;
  const alto = datosOriginales.filter(r => r.Riesgo === "ALTO").length;
  const topCompras = fuertes + posibles;
  const mercado = contextoMercado?.estado || "NEUTRO";
  const mejor = [...datosOriginales].sort(ordenRanking)[0];
  const mejorAccion = mejor?.Accion || "-";
  const mejorSenal = mejor?.Senal || "Sin señal";

  resumen.innerHTML = `
    <div class="summary-item primary">
      <small>Mejor oportunidad</small>
      <strong>${mejorAccion}</strong>
      <span>${mejorSenal}</span>
    </div>
    <div class="summary-item">
      <small>Mercado</small>
      <strong>${mercado}</strong>
      <span>SPY / QQQ</span>
    </div>
    <div class="summary-item buy">
      <small>Top compras</small>
      <strong>${topCompras}</strong>
      <span>fuertes + posibles</span>
    </div>
    <div class="summary-item">
      <small>Total analizadas</small>
      <strong>${total}</strong>
      <span>acciones / ETFs</span>
    </div>
    <div class="summary-item warning">
      <small>Vigilar</small>
      <strong>${vigilar}</strong>
      <span>sin entrada clara</span>
    </div>
    <div class="summary-item danger">
      <small>Riesgo alto</small>
      <strong>${alto}</strong>
      <span>cuidado con entrada</span>
    </div>
  `;
}

function actualizarHoraColombia() {
  const hora = document.getElementById("horaColombia");
  if (!hora) return;

  const ahora = new Date();
  const formato = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  hora.textContent = formato.format(ahora).replace(",", " ·");
}


function actualizarContador(cantidad) {
  const contador = document.getElementById("contadorResultados");
  if (!contador) return;

  const total = datosOriginales.length;
  contador.textContent = `Mostrando ${cantidad} de ${total} resultados`;
}

function filtrarSector(sector) {
  datosGlobales = [...datosOriginales];
  sectorActivo = sector;

  const selector = document.getElementById("sectorSelect");
  if (selector && selector.value !== sector) selector.value = sector;

  renderTabla();
}

function limpiarBusqueda() {
  const buscar = document.getElementById("buscarAccion");
  if (buscar) buscar.value = "";

  datosGlobales = [...datosOriginales];
  sectorActivo = "TODOS";

  const soloCompra = document.getElementById("soloCompra");
  const soloHot = document.getElementById("soloHot");
  const ocultarAlto = document.getElementById("ocultarAlto");
  const sectorSelect = document.getElementById("sectorSelect");

  if (sectorSelect) sectorSelect.value = "TODOS";
  if (soloCompra) soloCompra.checked = false;
  if (soloHot) soloHot.checked = false;
  if (ocultarAlto) ocultarAlto.checked = false;

  renderTabla();
}

function claseProbabilidad(prob) {
  if (prob >= 84) return "prob-verde";
  if (prob >= 70) return "prob-amarillo";
  return "prob-rojo";
}

function prioridadSenal(senal) {
  if (senal === "COMPRA FUERTE") return 3;
  if (senal === "POSIBLE COMPRA") return 2;
  if (senal === "VIGILAR") return 1;
  return 0;
}

function prioridadRiesgo(riesgo) {
  if (riesgo === "BAJO") return 2;
  if (riesgo === "MEDIO") return 1;
  return 0;
}

function mostrarTop4() {
  let datos = [...datosOriginales];

  datos = datos.filter(r =>
    ["COMPRA FUERTE", "POSIBLE COMPRA"].includes(String(r.Senal || "")) &&
    ["BAJO", "MEDIO"].includes(r.Riesgo)
  );

  datos.sort(ordenRanking);
  datosGlobales = datos.slice(0, 4);
  sectorActivo = "TODOS";

  const buscar = document.getElementById("buscarAccion");
  const soloCompra = document.getElementById("soloCompra");
  const soloHot = document.getElementById("soloHot");
  const ocultarAlto = document.getElementById("ocultarAlto");
  const sectorSelect = document.getElementById("sectorSelect");

  if (buscar) buscar.value = "";
  if (sectorSelect) sectorSelect.value = "TODOS";
  if (soloCompra) soloCompra.checked = false;
  if (soloHot) soloHot.checked = false;
  if (ocultarAlto) ocultarAlto.checked = false;

  renderTabla();
}

function ordenRanking(a, b) {
  const aHot = String(a["Hot Score"] || "").length;
  const bHot = String(b["Hot Score"] || "").length;

  return (
    prioridadSenal(b.Senal) - prioridadSenal(a.Senal) ||
    prioridadRiesgo(b.Riesgo) - prioridadRiesgo(a.Riesgo) ||
    bHot - aHot ||
    Number(b["Probabilidad tecnica"] || 0) - Number(a["Probabilidad tecnica"] || 0) ||
    Number(b["Fuerza relativa"] || 0) - Number(a["Fuerza relativa"] || 0) ||
    Number(a["ATR %"] || 99) - Number(b["ATR %"] || 99)
  );
}

function renderTabla() {
  const tabla = document.getElementById("tabla");
  const soloCompra = document.getElementById("soloCompra")?.checked || false;
  const soloHot = document.getElementById("soloHot")?.checked || false;
  const ocultarAlto = document.getElementById("ocultarAlto")?.checked || false;
  const busqueda = document.getElementById("buscarAccion")?.value.trim().toUpperCase() || "";

  let datos = [...datosGlobales];

  if (sectorActivo !== "TODOS") {
    datos = datos.filter(r => String(r.Sector || "").includes(sectorActivo));
  }

  if (busqueda !== "") {
    datos = datos.filter(r => String(r.Accion || "").toUpperCase().includes(busqueda));
  }

  if (soloCompra) {
    datos = datos.filter(r => ["COMPRA FUERTE", "POSIBLE COMPRA"].includes(String(r.Senal || "")));
  }

  if (soloHot) {
    datos = datos.filter(r => String(r["Hot Score"] || "").includes("🔥"));
  }

  if (ocultarAlto) {
    datos = datos.filter(r => String(r.Riesgo || "") !== "ALTO");
  }

  datos.sort(ordenRanking);
  actualizarContador(datos.length);

  if (!tabla) return;
  tabla.innerHTML = "";

  if (datos.length === 0) {
    tabla.innerHTML = `<tr><td colspan="17">No hay resultados con esos filtros.</td></tr>`;
    return;
  }

  datos.forEach(r => {
    const riesgo = String(r.Riesgo || "").toLowerCase();
    const senal = String(r.Senal || "");
    const prob = Number(r["Probabilidad tecnica"] || 0);
    const momentum = Number(r.Momentum || 0);
    const fuerzaRel = Number(r["Fuerza relativa"] || 0);
    const mercadoClase = normalizarClase(r.Mercado || "NEUTRO");

    let claseSenal = "no";
    if (senal === "COMPRA FUERTE") claseSenal = "fuerte";
    else if (senal.includes("POSIBLE")) claseSenal = "compra";
    else if (senal.includes("VIGILAR")) claseSenal = "vigilar";

    const claseMom = momentum >= 0 ? "mom-pos" : "mom-neg";
    const claseRel = fuerzaRel >= 0 ? "mom-pos" : "mom-neg";
    const tr = document.createElement("tr");
    tr.className = `row-${claseSenal}`;
    tr.innerHTML = `
      <td><strong>${r.Accion || ""}</strong></td>
      <td>${r.Sector || "Otro"}</td>
      <td>${r["Precio actual"] ?? ""}</td>
      <td><span class="prob ${claseProbabilidad(prob)}">${prob}%</span></td>
      <td class="${claseMom}">${momentum}%</td>
      <td class="${claseRel}">${fuerzaRel}%</td>
      <td>${r["Hot Score"] || ""}</td>
      <td><span class="conf ${String(r.Confirmacion || "MEDIA").toLowerCase()}">${r.Confirmacion || "MEDIA"}</span></td>
      <td>${r["ATR %"] || 0}%</td>
      <td>${r["Entrada min"]} - ${r["Entrada max"]}</td>
      <td>${r["Stop loss"]}</td>
      <td>${r.Objetivo}</td>
      <td>${r["R/R"] || ""}</td>
      <td>${r.RSI}</td>
      <td><span class="mercado-pill ${mercadoClase}">${r.Mercado || "NEUTRO"}</span></td>
      <td><span class="badge ${riesgo}">${r.Riesgo}</span></td>
      <td><span class="senal-badge ${claseSenal}">${r.Senal}</span></td>
    `;

    tabla.appendChild(tr);
  });
}

function ejecutarAnalisis() {
  const { usuario, repo } = obtenerRepoGitHub();
  const workflow = "analizar.yml";
  const url = `https://github.com/${usuario}/${repo}/actions/workflows/${workflow}`;
  window.open(url, "_blank");
  alert("La actualización automática ya está activa. Si quieres forzar una actualización manual, en GitHub Actions presiona Run workflow.");
}

cargarDatos();
actualizarHoraColombia();

setInterval(() => {
  actualizarHoraColombia();
}, 1000);

setInterval(() => {
  if (!document.hidden && autoRefreshActivo) {
    cargarDatos();
  }
}, AUTO_REFRESH_MS);
