// content.js - Extracción SIU UNGS
function extraerDatosSIU() {
  // IGNORED CHECK: Si estamos en "Inscripciones Históricas", no extraer para no romper las activas
  if (window.location.href.includes("historicas") || document.body.innerText.includes("Inscripciones históricas activas")) {
    return;
  }
  extraerInscripciones();
  extraerPlanEstudios();
}

function extraerInscripciones() {
  const lista = [];
  const tabla = document.querySelector("table");

  if (!tabla) return;

  const cabeceras = Array.from(tabla.querySelectorAll("th")).map(th => th.innerText.trim().toLowerCase());

  const idxActividad = cabeceras.findIndex(h => h.includes("actividad"));
  const idxComision = cabeceras.findIndex(h => h.includes("comisión") || h.includes("comision"));
  const idxSubcomision = cabeceras.findIndex(h => h.includes("subcomisión") || h.includes("subcomision"));
  const idxTurno = cabeceras.findIndex(h => h.includes("turno"));
  const idxCatedra = cabeceras.findIndex(h => h.includes("cátedra") || h.includes("catedra"));
  const idxUbicacion = cabeceras.findIndex(h => h.includes("ubicación") || h.includes("ubicacion"));
  const idxEstado = cabeceras.findIndex(h => h.includes("estado"));

  const filas = tabla.querySelectorAll("tbody tr");

  filas.forEach(fila => {
    const celdas = fila.querySelectorAll("td");
    if (celdas.length < 3) return;

    // MATERIA (ACTIVIDAD)
    let materiaRaw = idxActividad !== -1 && celdas[idxActividad] ? celdas[idxActividad].innerText.trim() : "";
    
    if (!materiaRaw || /^\d{2}\/\d{2}\/\d{4}/.test(materiaRaw)) {
      const textoFila = fila.innerText.replace(/\s+/g, ' ').trim();
      let textoSinFecha = textoFila.replace(/\d{2}\/\d{2}\/\d{4}\s*\d{2}:\d{2}/gi, "").trim();
      
      const matchNombre = textoSinFecha.match(/(?:LIC\.\s+SISTEMAS\s+|[A-Z0-9_-]+\s*-\s*)([A-ZÁÉÍÓÚÑ\s\d,.:]+?)(?=\s*\(|COM-|\d{2}\/\d{2})/i);
      if (matchNombre && matchNombre[1]) {
        materiaRaw = matchNombre[1].trim();
      } else {
        const partes = textoSinFecha.split("(");
        materiaRaw = partes[0].replace(/LIC\.\s+SISTEMAS/gi, "").trim();
      }
    }

    let materia = materiaRaw.replace(/LIC\.\s+SISTEMAS/gi, "").replace(/\([A-Z0-9_-]+\)/gi, "").trim();
    if (materia.toLowerCase() === "materia" || !materia) materia = "Materia de la Carrera";

    // COMISIÓN
    let comisionRaw = idxComision !== -1 && celdas[idxComision] ? celdas[idxComision].innerText.trim() : fila.innerText;
    let comision = "Sin comisión";
    const matchNum = comisionRaw.match(/(?:COM-|COMISIÓN\s*|COM\s*)(\d+)/i);
    if (matchNum) {
      comision = `COM-${matchNum[1]}`;
    }

    // SUBCOMISIÓN Y TURNO
    let subcomision = idxSubcomision !== -1 && celdas[idxSubcomision] ? celdas[idxSubcomision].innerText.trim() : "";
    let turno = idxTurno !== -1 && celdas[idxTurno] ? celdas[idxTurno].innerText.trim() : "";

    // UBICACIÓN
    let ubicacionTexto = idxUbicacion !== -1 && celdas[idxUbicacion] ? celdas[idxUbicacion].innerText.trim() : "";
    let ubicacion = "Campus";
    if (ubicacionTexto.toLowerCase().includes("virtual") || fila.innerText.toLowerCase().includes("virtual")) {
      ubicacion = "Virtual";
    }

    // CÁTEDRA Y ESTADO
    let catedraTexto = idxCatedra !== -1 && celdas[idxCatedra] ? celdas[idxCatedra].innerText.trim() : fila.innerText;
    const diasHorarios = parsearHorariosPorDia(catedraTexto);

    let estadoRaw = idxEstado !== -1 && celdas[idxEstado] ? celdas[idxEstado].innerText.trim() : "Aceptada";
    let estado = "Aceptada";
    if (estadoRaw.toLowerCase().includes("pendiente")) estado = "Pendiente";
    else if (estadoRaw.toLowerCase().includes("baja")) estado = "Dada de Baja";

    lista.push({
      nombre: materia,
      comision: comision,
      subcomision: subcomision,
      turno: turno,
      dias: diasHorarios,
      ubicacion: ubicacion,
      estado: estado
    });
  });

  if (lista.length > 0) {
    chrome.runtime.sendMessage({ tipo: "SIU_MATERIAS_EXTRAIDAS", materias: lista });
  }
}

function parsearHorariosPorDia(texto) {
  const bloques = [];
  const regex = /(Lunes|Martes|Miercoles|Miércoles|Jueves|Viernes|Sabado|Sábado)\s+de\s+([\d:]{5})(?::\d\d)?\s+a\s+([\d:]{5})(?::\d\d)?\s*(?:\((.*?)\))?/gi;
  
  let match;
  while ((match = regex.exec(texto)) !== null) {
    let dia = match[1];
    if (dia.toLowerCase() === "miercoles") dia = "Miércoles";
    if (dia.toLowerCase() === "sabado") dia = "Sábado";

    const desde = match[2];
    const hasta = match[3];
    const aula = match[4] ? match[4].replace("Campus", "").trim() : "Aula a confirmar";

    bloques.push({ dia, desde, hasta, aula });
  }

  return bloques;
}

function extraerPlanEstudios() {
  const elementoCarrera = document.querySelector(".carrera, .propuesta, #propuesta_activa, .encabezado_usuario");
  if (elementoCarrera) {
    const textoCarrera = elementoCarrera.innerText.replace(/\s+/g, ' ').trim();
    chrome.runtime.sendMessage({ tipo: "SIU_PLAN_EXTRAIDO", plan: textoCarrera });
  }
}

setInterval(() => {
  try {
    chrome.runtime.sendMessage({ tipo: "PING_KEEPALIVE" });
  } catch (e) {}
}, 15000);

extraerDatosSIU();
setInterval(extraerDatosSIU, 10000);