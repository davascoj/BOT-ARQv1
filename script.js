let datosGlobales = [];
let datosOriginales = [];
let sectorActivo = "TODOS";
let contextoMercado = null;

const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshActivo = true;
let ultimaCargaCorrecta = null;

function obtenerRepoGitHub() {
  const usuario = location.hostname.includes(".github.io")
    ? location.hostname.split(".github.io")[0]
    : "davascoj";

  const repoDetectado = location.pathname.split("/").filter(Boolean)[0];
  const repo = repoDetectado || "Analizador-acciones";

  return { usuario, repo };
}

function actualizarEstadoAuto(mensaje, error = false) {
  const autoBox = document.getElementById("autoBox");
  if (!autoBox) return;

  const hora = new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  autoBox.textContent = `${mensaje} | Vista revisada: ${hora}`;
  autoBox.className = error ? "auto-box error" : "auto-box";
}

async function cargarDatos() {
  const tabla = document.getElementById("tabla");
  const fecha = document.getElementById("fecha");
  const marketBox = document.getElementById("marketBox");
  const resumen = document.getElementById("resumen");

  tabla.innerHTML = `<tr><td colspan="18">Cargando datos...</td></tr>`;
  if (resumen) resumen.textContent = "Cargando resumen...";

  try {
    const resp = await fetch("datos_acciones.json?nocache=" + Date.now());
    if (!resp.ok) throw new Error("No existe datos_acciones.json todavía");

    const data = await resp.json();
    fecha.textContent = "Última actualización: " + (data.actualizado || "sin fecha");

    contextoMercado = data.contexto_mercado || null;
    datosGlobales = data.resultados || [];
    datosOriginales = data.resultados || [];

    pintarMercado();
    pintarResumen();
    renderTabla();

    ultimaCargaCorrecta = new Date();
    actualizarEstadoAuto("Página actualizando sola cada 60 segundos. GitHub Actions intenta renovar datos cada 5 minutos.");

  } catch (e) {
    fecha.textContent = "Sin datos";
    if (marketBox) marketBox.textContent = "Mercado: sin datos";
    if (resumen) resumen.textContent = "No hay resumen disponible.";
    actualizarEstadoAuto("No se pudieron cargar los datos. Revisa que datos_acciones.json exista o ejecuta GitHub Actions manualmente.", true);
    tabla.innerHTML = `<tr><td colspan="18">No se pudieron cargar datos. Abre GitHub Actions y ejecuta Run workflow.</td></tr>`;
  }
}

function pintarMercado() {
  const marketBox = document.getElementById("marketBox");
  if (!marketBox) return;

  if (!contextoMercado) {
    marketBox.textContent = "Mercado: sin datos";
    marketBox.className = "market-box";
    return;
  }

  const estado = contextoMercado.estado || "NEUTRO";
  const spy = contextoMercado.spy20 ?? 0;
  const qqq = contextoMercado.qqq20 ?? 0;

  marketBox.textContent = `Mercado: ${estado} | SPY 20D: ${spy}% | QQQ 20D: ${qqq}%`;
  marketBox.className = "market-box " + estado.toLowerCase().replace(" ", "-").replace("é", "e");
}

function pintarResumen() {
  const resumen = document.getElementById("resumen");
  if (!resumen) return;

  const total = datosOriginales.length;
  const fuertes = datosOriginales.filter(r => r.Senal === "COMPRA FUERTE").length;
  const posibles = datosOriginales.filter(r => r.Senal === "POSIBLE COMPRA").length;
  const vigilar = datosOriginales.filter(r => r.Senal === "VIGILAR").length;
  const alto = datosOriginales.filter(r => r.Riesgo === "ALTO").length;

  resumen.innerHTML = `
    <div><strong>${total}</strong><span>acciones analizadas</span></div>
    <div><strong>${fuertes}</strong><span>compra fuerte</span></div>
    <div><strong>${posibles}</strong><span>posible compra</span></div>
    <div><strong>${vigilar}</strong><span>vigilar</span></div>
    <div><strong>${alto}</strong><span>riesgo alto</span></div>
  `;
}

function filtrarSector(sector) {
  datosGlobales = [...datosOriginales];
  sectorActivo = sector;
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

  if (buscar) buscar.value = "";
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
  tabla.innerHTML = "";

  if (datos.length === 0) {
    tabla.innerHTML = `<tr><td colspan="18">No hay resultados con esos filtros.</td></tr>`;
    return;
  }

  datos.forEach(r => {
    const riesgo = String(r.Riesgo || "").toLowerCase();
    const senal = String(r.Senal || "");
    const prob = Number(r["Probabilidad tecnica"] || 0);
    const momentum = Number(r.Momentum || 0);
    const fuerzaRel = Number(r["Fuerza relativa"] || 0);

    let claseSenal = "no";
    if (senal === "COMPRA FUERTE") claseSenal = "fuerte";
    else if (senal.includes("POSIBLE")) claseSenal = "compra";
    else if (senal.includes("VIGILAR")) claseSenal = "vigilar";

    const claseMom = momentum >= 0 ? "mom-pos" : "mom-neg";
    const claseRel = fuerzaRel >= 0 ? "mom-pos" : "mom-neg";
    const detalle = [r.Razones, r.Alertas].filter(Boolean).join(" | ");

    const tr = document.createElement("tr");
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
      <td>${r.Mercado || "NEUTRO"}</td>
      <td><span class="badge ${riesgo}">${r.Riesgo}</span></td>
      <td class="${claseSenal}">${r.Senal}</td>
      <td class="detalle" title="${detalle}">${detalle || "-"}</td>
    `;

    tabla.appendChild(tr);
  });
}

function ejecutarAnalisis() {
  const { usuario, repo } = obtenerRepoGitHub();
  const workflow = "analizar.yml";
  const url = `https://github.com/${usuario}/${repo}/actions/workflows/${workflow}`;

  window.open(url, "_blank");
  alert("Ya no necesitas pegar token desde la página. Se abrió GitHub Actions. Si quieres forzar una actualización manual, presiona Run workflow.");
}


cargarDatos();

setInterval(() => {
  if (!document.hidden && autoRefreshActivo) {
    cargarDatos();
  }
}, AUTO_REFRESH_MS);
