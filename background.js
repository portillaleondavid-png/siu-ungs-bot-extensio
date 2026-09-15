// CONFIGURACIÓN DE TELEGRAM (Inicializadas vacías por seguridad)
let TELEGRAM_TOKEN = ""; 
let TELEGRAM_CHAT_ID = ""; 

// Cargar credenciales guardadas por el usuario desde popup.html al arrancar
chrome.storage.local.get(["user_telegram_token", "user_telegram_chat_id"], (cfg) => {
  if (cfg.user_telegram_token) TELEGRAM_TOKEN = cfg.user_telegram_token;
  if (cfg.user_telegram_chat_id) TELEGRAM_CHAT_ID = cfg.user_telegram_chat_id;
});

let lastUpdateId = 0;
let estaConsultando = false;
const actualizacionesProcesadas = new Set();

// ----------------------------------------------------
// CONTROL AUTOMÁTICO Y MANTENIMIENTO
// ----------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("keepAliveWorker", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAliveWorker" || alarm.name === "checkSIU") {
    consultarTelegramDirecto();
  }
});

if (chrome.idle && chrome.idle.onStateChanged) {
  chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === "active") {
      consultarTelegramDirecto();
    }
  });
}

// Listener de mensajes centralizado
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.tipo === "PING_KEEPALIVE") {
    sendResponse({ status: "despierto" });
    return true;
  }

  if (request.tipo === "ACTUALIZAR_CREDENCIALES") {
    chrome.storage.local.get(["user_telegram_token", "user_telegram_chat_id"], (cfg) => {
      if (cfg.user_telegram_token) TELEGRAM_TOKEN = cfg.user_telegram_token;
      if (cfg.user_telegram_chat_id) TELEGRAM_CHAT_ID = cfg.user_telegram_chat_id;
      console.log("Credenciales de Telegram actualizadas correctamente.");
    });
  }

  if (request.tipo === "SIU_MATERIAS_EXTRAIDAS") {
    const materiasNuevas = request.materias;
    
    chrome.storage.local.get(["siu_materias_previas"], (result) => {
      const previas = result.siu_materias_previas || [];

      if (previas.length > 0) {
        const cambios = detectarCambios(previas, materiasNuevas);
        cambios.forEach(msg => {
          enviarMensajeTelegram(`🚨 *¡Alerta SIU UNGS!*\n\n${msg}`);
        });
      }

      chrome.storage.local.set({ siu_materias_previas: materiasNuevas });
    });
  }

  if (request.tipo === "SIU_PLAN_EXTRAIDO") {
    chrome.storage.local.set({ siu_plan_estudio: request.plan });
  }
});

function detectarCambios(viejas, nuevas) {
  const alertas = [];
  nuevas.forEach(mNueva => {
    const mVieja = viejas.find(v => v.nombre.toLowerCase().trim() === mNueva.nombre.toLowerCase().trim());
    if (mVieja) {
      if (mVieja.comision !== mNueva.comision) alertas.push(`🔄 *${mNueva.nombre}*: Cambio de comisión a "${mNueva.comision}"`);
      if (mVieja.estado !== mNueva.estado) alertas.push(`📋 *${mNueva.nombre}*: Estado cambió a "${mNueva.estado}"`);
    } else {
      if (mNueva.nombre && mNueva.nombre !== "Materia") alertas.push(`➕ *Nueva materia inscripta*: ${mNueva.nombre}`);
    }
  });
  return alertas;
}

// ----------------------------------------------------
// MOTOR DE TELEGRAM
// ----------------------------------------------------
async function loopTelegram() {
  if (TELEGRAM_TOKEN) {
    await consultarTelegramDirecto();
  }
  setTimeout(loopTelegram, 2000);
}

loopTelegram();

async function consultarTelegramDirecto() {
  if (estaConsultando || !TELEGRAM_TOKEN) return;
  estaConsultando = true;

  try {
    if (lastUpdateId === 0) {
      const stored = await chrome.storage.local.get(["last_telegram_update_id"]);
      if (stored.last_telegram_update_id) {
        lastUpdateId = stored.last_telegram_update_id;
      }
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        if (actualizacionesProcesadas.has(update.update_id)) continue;

        actualizacionesProcesadas.add(update.update_id);
        lastUpdateId = update.update_id;

        chrome.storage.local.set({ last_telegram_update_id: lastUpdateId });

        if (actualizacionesProcesadas.size > 100) {
          actualizacionesProcesadas.clear();
        }

        const texto = update.message?.text?.toLowerCase() || "";
        const chatId = update.message?.chat?.id;

        if (!chatId) continue;

        // RUTEADOR DE COMANDOS
        if (texto === "/materias" || texto.includes("materia")) {
          responderMaterias(chatId);
        } else if (texto === "/horarios" || texto.includes("horario") || texto.includes("hoy")) {
          responderHorariosHoy(chatId);
        } else if (texto === "/plan" || texto.includes("plan")) {
          responderPlanEstudio(chatId);
        } else if (texto === "/inscripcion" || texto.includes("inscripcion")) {
          responderFechasInscripcion(chatId);
        } else if (texto === "/examen" || texto.includes("examen") || texto.includes("final")) {
          responderFechasExamenes(chatId);
        } else if (texto.startsWith("/aula") || texto.startsWith("/mapa")) {
          responderConsultaAula(chatId, update.message?.text || "");
        } else {
          enviarMenuPrincipal("👋 ¡Hola! Seleccioná una opción del menú o consultá un aula:", chatId);
        }
      }
    }
  } catch (err) {
    console.error("Error consultando Telegram:", err);
  } finally {
    estaConsultando = false;
  }
}

// ----------------------------------------------------
// RESPUESTAS A COMANDOS
// ----------------------------------------------------
function responderMaterias(chatId) {
  chrome.storage.local.get(["siu_materias_previas"], (res) => {
    const materias = res.siu_materias_previas || [];
    if (materias.length === 0) {
      enviarMensajeTelegram("⚠️ No hay datos guardados. Recargá la pestaña del SIU Guaraní (F5).", chatId);
      return;
    }

    let reporte = "🎓 *Tus Inscripciones (UNGS)*\n───────────────────\n\n";

    materias.forEach(m => {
      reporte += `📖 *${m.nombre}*\n`;
      reporte += `👥 *Comisión:* ${m.comision}`;
      if (m.subcomision) reporte += ` | *Subcomisión:* ${m.subcomision}`;
      reporte += `\n`;

      if (m.turno) reporte += `🌅 *Turno:* ${m.turno}\n`;
      reporte += `🏫 *Ubicación:* ${m.ubicacion}\n`;
      reporte += `📌 *Estado:* \`${m.estado}\`\n`;
      reporte += `👨‍🏫 *Cátedra:*\n`;

      if (m.dias && m.dias.length > 0) {
        m.dias.forEach(d => {
          reporte += `   • *${d.dia}:* ${d.desde} a ${d.hasta} hs\n     └ 🏛️ ${decodificarUbicacionUNGS(d.aula)}\n`;
        });
      } else {
        reporte += `   • _Sin detalles de aula/horario_\n`;
      }
      reporte += "\n";
    });

    enviarMensajeTelegram(reporte, chatId);
  });
}

function responderHorariosHoy(chatId) {
  chrome.storage.local.get(["siu_materias_previas"], (res) => {
    const materias = res.siu_materias_previas || [];
    if (materias.length === 0) {
      enviarMensajeTelegram("⚠️ No hay datos guardados. Recargá la pestaña del SIU Guaraní (F5).", chatId);
      return;
    }

    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diaHoy = diasSemana[new Date().getDay()];

    let reporte = `📅 *Cursadas de Hoy (${diaHoy})*\n───────────────────\n\n`;
    let tieneClaseHoy = false;

    materias.forEach(m => {
      if (m.dias && m.dias.length > 0) {
        const clasesHoy = m.dias.filter(d => d.dia.toLowerCase() === diaHoy.toLowerCase());
        if (clasesHoy.length > 0) {
          tieneClaseHoy = true;
          reporte += `📖 *${m.nombre}*\n👥 *Comisión:* ${m.comision}\n🏫 *Modo:* ${m.ubicacion}\n`;
          clasesHoy.forEach(c => {
            reporte += `⏰ *Horario:* ${c.desde} a ${c.hasta} hs\n🏛️ *Aula:* ${decodificarUbicacionUNGS(c.aula)}\n\n`;
          });
        }
      }
    });

    if (!tieneClaseHoy) reporte += `🎉 *¡Hoy no cursás ninguna materia!* Disfrutá el día libre.`;
    enviarMensajeTelegram(reporte, chatId);
  });
}

function responderPlanEstudio(chatId) {
  chrome.storage.local.get(["siu_plan_estudio", "siu_materias_previas"], (res) => {
    const plan = res.siu_plan_estudio || "Licenciatura en Sistemas - UNGS";
    const materias = res.siu_materias_previas || [];

    let reporte = `📋 *Plan de Estudio y Estado*\n───────────────────\n\n🎓 *Carrera:* ${plan}\n📊 *Materias en curso:* ${materias.length}\n\n`;
    if (materias.length > 0) {
      reporte += `*Listado de materias en curso:*\n`;
      materias.forEach((m, idx) => {
        reporte += `${idx + 1}. ${m.nombre} (${m.comision})\n`;
      });
    }
    enviarMensajeTelegram(reporte, chatId);
  });
}

function responderFechasInscripcion(chatId) {
  let reporte = `📝 *Calendario de Inscripción a Materias UNGS (2026)*\n─────────────────────────\n\n`;
  
  reporte += `1️⃣ *PRIMER SEMESTRE 2026*\n`;
  reporte += `• *1ª Vuelta (Cursantes):* 09/02/2026 al 12/02/2026\n`;
  reporte += `• *2ª Vuelta (No asignados):* 26/02/2026 al 28/02/2026\n`;
  reporte += `🚀 *Inicio de Cursada:* 09/03/2026\n`;
  reporte += `🏁 *Fin de Cursada:* 28/11/2026\n\n`;

  reporte += `2️⃣ *SEGUNDO SEMESTRE 2026*\n`;
  reporte += `• *1ª Vuelta (Ingresantes y Cursantes):* 21/07/2026 al 24/07/2026\n`;
  reporte += `• *2ª Vuelta (No asignados):* 04/08/2026 al 06/08/2026\n`;
  reporte += `🚀 *Inicio de Cursada:* 10/08/2026\n`;
  reporte += `🏁 *Fin de Cursada:* 28/11/2026\n`;

  enviarMensajeTelegram(reporte, chatId);
}

function responderFechasExamenes(chatId) {
  let reporte = `🏆 *Calendario de Exámenes Finales y Acreditación UNGS (2026)*\n─────────────────────────\n\n`;

  reporte += `❄️ *TURNO FEBRERO (Regular y Libre)*\n`;
  reporte += `• *Inscripción:* 04/02/2026 al 06/02/2026\n`;
  reporte += `• *1° Llamado:* 18/02/2026 al 21/02/2026\n`;
  reporte += `• *2° Llamado:* 23/02/2026 al 28/02/2026\n\n`;

  reporte += `🌱 *TURNO MAYO (Regular)*\n`;
  reporte += `• *Inscripción:* 04/05/2026 al 06/05/2026\n`;
  reporte += `• *Único llamado:* 18/05/2026 al 23/05/2026\n\n`;

  reporte += `☀️ *TURNO JULIO (Regular y Libre)*\n`;
  reporte += `• *Inscripción:* 06/07/2026 al 08/07/2026\n`;
  reporte += `• *1° Llamado:* 13/07/2026 al 18/07/2026\n`;
  reporte += `• *2° Llamado:* 20/07/2026 al 25/07/2026\n\n`;

  reporte += `🍂 *TURNO OCTUBRE (Regular)*\n`;
  reporte += `• *Inscripción:* 05/10/2026 al 07/10/2026\n`;
  reporte += `• *Único llamado:* 19/10/2026 al 24/10/2026\n\n`;

  reporte += `🎄 *TURNO DICIEMBRE (Regular y Libre)*\n`;
  reporte += `• *Inscripción:* 09/12/2026 al 11/12/2026\n`;
  reporte += `• *1° Llamado:* 14/12/2026 al 19/12/2026\n`;
  reporte += `• *2° Llamado:* 21/12/2026 al 26/12/2026\n\n`;

  reporte += `🗣️ *ACREDITACIÓN DE IDIOMAS Y UTILITARIOS*\n`;
  reporte += `• *Mayo:* Inscripción 04/05/26 - 06/05/26 | Llamado: 18/05/26 - 23/05/26\n`;
  reporte += `• *Octubre:* Inscripción 05/10/26 - 07/10/26 | Llamado: 19/10/26 - 24/10/26\n`;

  enviarMensajeTelegram(reporte, chatId);
}

function responderConsultaAula(chatId, textoComando) {
  const partes = textoComando.trim().split(/\s+/);
  if (partes.length < 2) {
    enviarMensajeTelegram("💡 *¿Cómo consultar un aula?*\n\nEscribí `/aula` seguido del número.\n\nEjemplo: `/aula 7172` o `/aula 3061`", chatId);
    return;
  }

  const numeroBuscado = partes[1];
  enviarMensajeTelegram(decodificarUbicacionDetallada(numeroBuscado), chatId);
}

// ----------------------------------------------------
// AUXILIARES Y MENÚ
// ----------------------------------------------------
function decodificarUbicacionUNGS(inputAula) {
  const match = inputAula.match(/\b([1-9])(\d)(\d{2})\b/);
  if (!match) return `\`${inputAula}\``;

  const numeroCompleto = match[0];
  const modulo = match[1];
  const pisoNum = parseInt(match[2], 10);
  const pisoTexto = pisoNum === 0 ? "PB" : `Piso ${pisoNum}`;

  return `\`AULA ${numeroCompleto}\` (Módulo ${modulo}, ${pisoTexto})`;
}

function decodificarUbicacionDetallada(inputAula) {
  const match = inputAula.match(/\b([1-9])(\d)(\d{2})\b/);
  if (!match) return `📍 *Espacio:* \`${inputAula}\``;

  const numeroCompleto = match[0];
  const modulo = match[1];
  const pisoNum = parseInt(match[2], 10);
  const pisoTexto = pisoNum === 0 ? "Planta Baja" : `Piso ${pisoNum}`;

  const infoModulos = {
    "1": "Módulo 1 (Posgrado, Tesorería, Becas, Títulos y Planes)",
    "2": "Módulo 2 (Ciencias, Lab. Química / Física)",
    "3": "Módulo 3 (Aulas, Escuela Secundaria UNGS)",
    "4": "Módulo 4 (Instituto de Industria, APUNGS)",
    "5": "Módulo 5 (Instituto del Desarrollo Humano)",
    "6": "Módulo 6 (Instituto del Conurbano, Lab. Sistemas / SIG)",
    "7": "Módulo 7 (Aulas, Bedelía, Lab. Informática, Fotocopiadora, Centro de Estudiantes)",
    "9": "Módulo 9 (Informes, Desarrollo Estudiantil, Bar Universitario)"
  };

  return `📍 *Ubicación Campus UNGS:*\n🚪 *Aula:* \`${numeroCompleto}\`\n🏢 *Ubicación:* ${infoModulos[modulo] || `Módulo ${modulo}`}\n📶 *Nivel:* ${pisoTexto}`;
}

function enviarMenuPrincipal(mensaje, chatId = TELEGRAM_CHAT_ID) {
  const targetChat = chatId || TELEGRAM_CHAT_ID;
  if (!targetChat || !TELEGRAM_TOKEN) return;

  const keyboard = {
    keyboard: [
      [{ text: "/Materias" }, { text: "/Horarios" }],
      [{ text: "/Plan" }, { text: "/Inscripcion" }],
      [{ text: "/Examen" }, { text: "/aula " }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChat,
      text: mensaje,
      reply_markup: keyboard
    })
  }).catch(err => console.error("Error enviando menú Telegram:", err));
}

function enviarMensajeTelegram(mensaje, chatId = TELEGRAM_CHAT_ID) {
  const targetChat = chatId || TELEGRAM_CHAT_ID;
  if (!targetChat || !TELEGRAM_TOKEN) return;

  fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChat,
      text: mensaje,
      parse_mode: "Markdown"
    })
  }).catch(err => console.error("Error enviando Telegram:", err));
}