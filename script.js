let datosGlobales = [];
let datosOriginales = [];
let sectorActivo = "TODOS";
let contextoMercado = null;
const AUTO_REFRESH_MS = 5 * 60 * 1000;
let autoRefreshActivo = true;
let filasAbiertas = new Set();

function obtenerRepoGitHub() {
  const usuario = location.hostname.includes(".github.io")
    ? location.hostname.split(".github.io")[0]
    : "davascoj";

  const repoDetectado = location.pathname.split("/").filter(Boolean)[0];
  const repo = repoDetectado || "BOT-ARQv1";

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

function escaparHTML(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatoNumero(valor, decimales = 2) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(decimales);
}

function obtenerHoraZona(timeZone, locale = "es-CO") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(new Date()).replace(",", " ·");
}

function obtenerHoraNewYorkARQ() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const datos = {};
  partes.forEach((parte) => {
    datos[parte.type] = parte.value;
  });

  return {
    weekday: datos.weekday,
    hour: Number(datos.hour),
    minute: Number(datos.minute),
    second: Number(datos.second)
  };
}

function mercadoAbiertoAhoraARQ() {
  const ny = obtenerHoraNewYorkARQ();
  const diasHabiles = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const esDiaHabil = diasHabiles.includes(ny.weekday);
  const minutosActuales = ny.hour * 60 + ny.minute;
  const apertura = 9 * 60 + 30;
  const cierre = 16 * 60;

  return esDiaHabil && minutosActuales >= apertura && minutosActuales < cierre;
}

function mercadoPreAperturaARQ() {
  const ny = obtenerHoraNewYorkARQ();
  const diasHabiles = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const esDiaHabil = diasHabiles.includes(ny.weekday);
  const minutosActuales = ny.hour * 60 + ny.minute;
  const preInicio = 9 * 60;
  const apertura = 9 * 60 + 30;

  return esDiaHabil && minutosActuales >= preInicio && minutosActuales < apertura;
}

function actualizarAvisoSistemaARQ() {
  const badge = document.getElementById("marketStatusBadge");
  const texto = document.getElementById("marketStatusText");

  if (!badge || !texto) return;

  badge.classList.remove("market-online", "market-off", "market-preopen");

  if (mercadoAbiertoAhoraARQ()) {
    badge.classList.add("market-online");
    texto.textContent = "sistema en línea";
  } else if (mercadoPreAperturaARQ()) {
    badge.classList.add("market-preopen");
    texto.textContent = "preapertura";
  } else {
    badge.classList.add("market-off");
    texto.textContent = "sistema off";
  }
}

function actualizarRelojes() {
  const horaColombia = document.getElementById("horaColombia");
  const horaNewYork = document.getElementById("horaNewYork");

  if (horaColombia) horaColombia.textContent = obtenerHoraZona("America/Bogota", "es-CO");
  if (horaNewYork) horaNewYork.textContent = obtenerHoraZona("America/New_York", "es-CO");

  actualizarAvisoSistemaARQ();
}

async function cargarDatos() {
  const tabla = document.getElementById("tabla");
  const fecha = document.getElementById("fecha");
  const resumen = document.getElementById("resumen");
  const contador = document.getElementById("contadorResultados");

  if (tabla) tabla.innerHTML = `<tr><td colspan="12" class="loading-cell">Cargando datos...</td></tr>`;
  if (resumen) resumen.textContent = "Cargando resumen...";
  if (contador) contador.textContent = "Cargando resultados...";

  try {
    const resp = await fetch("datos_acciones.json?nocache=" + Date.now());
    if (!resp.ok) throw new Error("No existe datos_acciones.json todavía");

    const data = await resp.json();
    const fechaTexto = data.actualizado || "sin fecha";

    if (fecha) fecha.textContent = fechaTexto;

    contextoMercado = data.contexto_mercado || null;
    datosGlobales = data.resultados || [];
    datosOriginales = data.resultados || [];

    pintarMercado();
    pintarContextoDetalle();
    pintarResumen();
    renderTabla();
  } catch (e) {
    if (fecha) fecha.textContent = "Sin datos";
    if (resumen) resumen.textContent = "No hay resumen disponible.";
    if (contador) contador.textContent = "No hay resultados cargados";
    if (tabla) {
      tabla.innerHTML = `<tr><td colspan="12" class="loading-cell error-cell">No se pudieron cargar datos. Revisa datos_acciones.json o GitHub Actions.</td></tr>`;
    }
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

function pintarContextoDetalle() {
  const box = document.getElementById("contextoDetalle");
  if (!box) return;

  if (!contextoMercado) {
    box.innerHTML = `<div class="context-item">Sin contexto disponible</div>`;
    return;
  }

  const sectores = contextoMercado.sectores || {};
  const cards = [];

  cards.push(`
    <div class="context-item mercado-general">
      <small>Mercado general</small>
      <strong>${escaparHTML(contextoMercado.estado || "NEUTRO")}</strong>
      <span>SPY ${contextoMercado.spy20 ?? 0}% · QQQ ${contextoMercado.qqq20 ?? 0}%</span>
    </div>
  `);

  Object.entries(sectores).forEach(([nombre, ctx]) => {
    const estado = ctx?.estado || "SIN DATOS";
    const detalle = ctx?.detalle || "";
    cards.push(`
      <div class="context-item ${normalizarClase(estado)}">
        <small>${escaparHTML(nombre)}</small>
        <strong>${escaparHTML(estado)}</strong>
        <span>${escaparHTML(detalle || "Sin detalle")}</span>
      </div>
    `);
  });

  box.innerHTML = cards.join("");
}

function pintarResumen() {
  const resumen = document.getElementById("resumen");
  if (!resumen) return;

  const total = datosOriginales.length;
  const fuertes = datosOriginales.filter(r => r.Senal === "COMPRA FUERTE").length;
  const posibles = datosOriginales.filter(r => r.Senal === "POSIBLE COMPRA").length;
  const vigilar = datosOriginales.filter(r => r.Senal === "VIGILAR").length;
  const noComprar = datosOriginales.filter(r => r.Senal === "NO COMPRAR").length;
  const alto = datosOriginales.filter(r => r.Riesgo === "ALTO").length;
  const topCompras = fuertes + posibles;
  const mercado = contextoMercado?.estado || "NEUTRO";
  const mejor = [...datosOriginales].sort(ordenRanking)[0];
  const mejorAccion = mejor?.Accion || "-";
  const mejorSenal = mejor?.Senal || "Sin señal";

  resumen.innerHTML = `
    <div class="summary-item primary">
      <small>Mejor oportunidad</small>
      <strong>${escaparHTML(mejorAccion)}</strong>
      <span>${escaparHTML(mejorSenal)}</span>
    </div>
    <div class="summary-item">
      <small>Mercado</small>
      <strong>${escaparHTML(mercado)}</strong>
      <span>SPY / QQQ + sectores</span>
    </div>
    <div class="summary-item buy">
      <small>Top compras</small>
      <strong>${topCompras}</strong>
      <span>${fuertes} fuertes · ${posibles} posibles</span>
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
      <span>${noComprar} no comprar</span>
    </div>
  `;
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
  filasAbiertas.clear();

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

function prioridadContexto(ctx) {
  if (ctx === "ACOMPAÑA") return 3;
  if (ctx === "NEUTRO +") return 2;
  if (ctx === "NEUTRO") return 1;
  return 0;
}

function ordenRanking(a, b) {
  const aHot = String(a["Hot Score"] || "").length;
  const bHot = String(b["Hot Score"] || "").length;

  return (
    prioridadSenal(b.Senal) - prioridadSenal(a.Senal) ||
    prioridadRiesgo(b.Riesgo) - prioridadRiesgo(a.Riesgo) ||
    prioridadContexto(b["Contexto sector"]) - prioridadContexto(a["Contexto sector"]) ||
    bHot - aHot ||
    Number(b["Probabilidad tecnica"] || 0) - Number(a["Probabilidad tecnica"] || 0) ||
    Number(b["Fuerza relativa"] || 0) - Number(a["Fuerza relativa"] || 0) ||
    Number(a["ATR %"] || 99) - Number(b["ATR %"] || 99)
  );
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
  filasAbiertas.clear();

  const buscar = document.getElementById("buscarAccion");
  const soloCompra = document.getElementById("soloCompra");
  const soloHot = document.getElementById("soloHot");
  const ocultarAlto = document.getElementById("ocultarAlto");
  const sectorSelect = document.getElementById("sectorSelect");

  if (buscar) buscar.value = "";
  if (sectorSelect) sectorSelect.value = "TODOS";
  if (soloCompra) soloCompra.checked = false;
  if (soloHot) soloHot.checked = false;
  if (ocultarAlto) ocultarAlto.checked = true;

  renderTabla();
}

function separarListaTexto(texto) {
  const valor = String(texto || "").trim();
  if (!valor) return [];
  return valor
    .split(/;|\n|\|/)
    .map(item => item.trim())
    .filter(Boolean);
}

function listaHTML(titulo, items, tipo) {
  if (!items.length) {
    return `
      <div class="explain-block ${tipo}">
        <h4>${titulo}</h4>
        <p class="empty-note">Sin datos destacados.</p>
      </div>
    `;
  }

  return `
    <div class="explain-block ${tipo}">
      <h4>${titulo}</h4>
      <ul>
        ${items.map(item => `<li>${escaparHTML(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function detalleTecnicoHTML(r) {
  const ma20 = r["MA20"] ?? r["Media 20"] ?? r["Distancia MA20 %"];
  const ma20Label = r["MA20"] || r["Media 20"] ? formatoNumero(ma20, 2) : `${formatoNumero(ma20, 2)}% dist.`;

  const detalles = [
    ["RSI", formatoNumero(r.RSI, 2)],
    ["ATR %", `${formatoNumero(r["ATR %"], 2)}%`],
    ["MA20", ma20Label],
    ["Fuerza relativa", `${formatoNumero(r["Fuerza relativa"], 2)}%`],
    ["Drivers sector", r["Drivers sector"] || "SPY/QQQ"],
    ["Confirmación", r.Confirmacion || "MEDIA"],
    ["R/R", r["R/R"] || "-"],
    ["Hot", r["Hot Score"] || "-"],
  ];

  return `
    <div class="technical-grid">
      ${detalles.map(([label, value]) => `
        <div class="tech-item">
          <small>${escaparHTML(label)}</small>
          <strong>${escaparHTML(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function toggleDetalle(ticker) {
  if (filasAbiertas.has(ticker)) {
    filasAbiertas.delete(ticker);
  } else {
    filasAbiertas.add(ticker);
  }
  renderTabla();
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
    tabla.innerHTML = `<tr><td colspan="12" class="loading-cell">No hay resultados con esos filtros.</td></tr>`;
    return;
  }

  datos.forEach(r => {
    const ticker = String(r.Accion || "");
    const riesgo = String(r.Riesgo || "").toLowerCase();
    const senal = String(r.Senal || "");
    const prob = Number(r["Probabilidad tecnica"] || 0);
    const momentum = Number(r.Momentum || 0);
    const volumenRel = Number(r["Volumen relativo"] || 0);
    const contextoSector = r["Contexto sector"] || "GENERAL";
    const contextoClase = normalizarClase(contextoSector);
    const abierto = filasAbiertas.has(ticker);

    let claseSenal = "no";
    if (senal === "COMPRA FUERTE") claseSenal = "fuerte";
    else if (senal.includes("POSIBLE")) claseSenal = "compra";
    else if (senal.includes("VIGILAR")) claseSenal = "vigilar";

    const claseMom = momentum >= 0 ? "mom-pos" : "mom-neg";
    const claseVol = volumenRel >= 1 ? "mom-pos" : "mom-neutral";
    const razones = separarListaTexto(r.Razones);
    const alertas = separarListaTexto(r.Alertas);

    const tr = document.createElement("tr");
    tr.className = `main-row row-${claseSenal} riesgo-${riesgo}`;
    tr.innerHTML = `
      <td class="ticker-cell">
        <strong>${escaparHTML(ticker)}</strong>
        <span>${escaparHTML(r.Sector || "Otro")}</span>
      </td>
      <td>$${formatoNumero(r["Precio actual"], 2)}</td>
      <td><span class="prob ${claseProbabilidad(prob)}">${formatoNumero(prob, 1)}</span></td>
      <td><span class="senal-badge ${claseSenal}">${escaparHTML(senal)}</span></td>
      <td><span class="badge ${riesgo}">${escaparHTML(r.Riesgo || "-")}</span></td>
      <td><span class="contexto-pill ${contextoClase}" title="${escaparHTML(r["Drivers sector"] || "")}">${escaparHTML(contextoSector)}</span></td>
      <td class="${claseMom}">${formatoNumero(momentum, 2)}%</td>
      <td class="${claseVol}">${formatoNumero(volumenRel, 2)}x</td>
      <td>${formatoNumero(r["Entrada min"], 2)} - ${formatoNumero(r["Entrada max"], 2)}</td>
      <td class="stop-cell">${formatoNumero(r["Stop loss"], 2)}</td>
      <td class="target-cell">${formatoNumero(r.Objetivo, 2)}</td>
      <td>
        <button class="explain-btn ${abierto ? "open" : ""}" onclick="toggleDetalle('${escaparHTML(ticker)}')">
          ${abierto ? "Ocultar" : "Ver explicación"}
        </button>
      </td>
    `;

    tabla.appendChild(tr);

    if (abierto) {
      const detalle = document.createElement("tr");
      detalle.className = "detail-row";
      detalle.innerHTML = `
        <td colspan="12">
          <div class="explain-panel">
            <div class="explain-header">
              <div>
                <small>Explicación de la señal</small>
                <h3>¿Por qué ${escaparHTML(ticker)} marca ${escaparHTML(senal || "esta señal")}?</h3>
              </div>
              <span class="score-large ${claseProbabilidad(prob)}">Score ARQ ${formatoNumero(prob, 1)}</span>
            </div>

            <div class="explain-grid">
              ${listaHTML("Razones", razones, "reasons")}
              ${listaHTML("Alertas", alertas, "alerts")}
            </div>

            <div class="secondary-title">Datos técnicos secundarios</div>
            ${detalleTecnicoHTML(r)}
          </div>
        </td>
      `;
      tabla.appendChild(detalle);
    }
  });
}

function ejecutarAnalisis() {
  const { usuario, repo } = obtenerRepoGitHub();
  const workflow = "analizar.yml";
  const url = `https://github.com/${usuario}/${repo}/actions/workflows/${workflow}`;
  window.open(url, "_blank");
  alert("La actualización automática ya está activa. Si quieres forzar una actualización manual, abre GitHub Actions y presiona Run workflow.");
}

cargarDatos();
actualizarRelojes();

setInterval(() => {
  actualizarRelojes();
}, 1000);

setInterval(() => {
  if (!document.hidden && autoRefreshActivo) {
    cargarDatos();
  }
}, AUTO_REFRESH_MS);
