document.addEventListener("DOMContentLoaded", () => {
  const tokenInput = document.getElementById("token");
  const chatIdInput = document.getElementById("chatId");
  const btnGuardar = document.getElementById("btnGuardar");
  const statusDiv = document.getElementById("status");

  // Cargar credenciales previas si existen
  chrome.storage.local.get(["user_telegram_token", "user_telegram_chat_id"], (data) => {
    if (data.user_telegram_token) tokenInput.value = data.user_telegram_token;
    if (data.user_telegram_chat_id) chatIdInput.value = data.user_telegram_chat_id;
  });

  // Guardar datos al hacer clic
  btnGuardar.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    const chatId = chatIdInput.value.trim();

    if (!token || !chatId) {
      statusDiv.style.color = "red";
      statusDiv.innerText = "❌ Completa ambos campos.";
      return;
    }

    chrome.storage.local.set({
      user_telegram_token: token,
      user_telegram_chat_id: chatId
    }, () => {
      statusDiv.style.color = "green";
      statusDiv.innerText = "✅ Configuración guardada.";
      
      // Forzar actualización inmediata en el script en segundo plano
      chrome.runtime.sendMessage({ tipo: "ACTUALIZAR_CREDENCIALES" });

      setTimeout(() => {
        window.close();
      }, 1200);
    });
  });
});