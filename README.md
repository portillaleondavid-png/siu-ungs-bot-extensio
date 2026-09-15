# SIU Guaraní Notifier - UNGS

Extensión para navegador (Chrome / Edge) y Bot de Telegram que automatiza las consultas de cursada, aulas y notificaciones del SIU Guaraní de la Universidad Nacional de General Sarmiento.

---

##Guía de Instalación Rápida

### Paso 1: Crear tu Bot de Telegram

Para recibir tus datos y alertas en tu propio celular, necesitás un Bot personal de Telegram:

1. Abrí **Telegram** y buscá el usuario oficial **`@BotFather`**.
2. Escribile el comando `/newbot`.
3. Te pedirá un **nombre** para el bot (ejemplo: *Mi SIU Bot*) y un **usuario** terminado en `bot` (ejemplo: *mi_siu_ungs_bot*).
4. Al finalizar, **`@BotFather`** te dará un código largo llamado **HTTP API Token** (ej: `8636397840:AAFmlVEkmn...`). **¡Copialo!**
5. Busca tu bot recién creado en Telegram y tocá el botón **INICIAR** (o escribile `/start`).

---

### Paso 2: Obtener tu Chat ID 

1. En Telegram, buscá el usuario **`@userinfobot`**.
2. Escribile cualquier mensaje (ejemplo: `hola`).
3. El bot te responderá con tu **Id** numérico (ej: `8697206408`). **¡Copialo!**

---

### Paso 3: Instalar la Extensión en el Navegador

1. Abrí tu navegador (Edge, Chrome o Brave) e ingresá a:
   * En Edge: `edge://extensions/`
   * En Chrome: `chrome://extensions/`
2. Activá el **Modo de desarrollador** (interruptor en la esquina superior derecha o lateral).
3. Hacé clic en **Cargar extensión sin empaquetar** (o *Cargar descomprimida*).
4. Seleccioná la carpeta de este proyecto.

---

### Paso 4: Configurar tus credenciales

1. En la barra superior de tu navegador, hacé clic en el ícono de la extensión **SIU Guaraní Notifier**.
2. Pegá tu **Bot Token** y tu **Chat ID**.
3. Presioná ** Guardar Configuración**.

---

## Comandos Disponibles en Telegram

Una vez configurado, abrí la página del SIU Guaraní UNGS en el navegador. Podrás enviarle los siguientes comandos a tu bot desde el celular:

* **/Materias**: Muestra tus inscripciones activas, comisiones, aulas, catedra y estado.
* **/Horarios**: Muestra únicamente la cursada y el aula que te toca hoy.
* **/Plan**: Lista tus materias en curso y estado del plan de estudios.
* **/Inscripcion**: Fechas oficiales de inscripción a cursada (1ª y 2ª vuelta).
* **/Examen**: Calendario de llamados de exámenes finales y acreditación de idiomas.
* **/aula <número>**: Muestra en qué módulo, piso y ubicación queda cualquier aula de la UNGS (ejemplo: `/aula 7172`).
