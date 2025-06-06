// ** IMPORTANTE: REEMPLAZA ESTA URL CON LA URL DE DESPLIEGUE DE TU APPS SCRIPT (doPost) **
// Esta es la URL de tu proyecto "WebFormularioDeRifa" en Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqG-mAFv-sdK5vP3kkUyIHFdf4kIXfdPieO-u7fYT_pfoE_ZPfqegsv6b8GvtFO7CnKQ/exec"; // <-- ¡ACTUALIZA ESTO!

let tasaDolar = 0;
const precioTicketUSD = 1;

// Datos para Pago Móvil 1 (Banesco)
const cedulaPM1 = "V-12345678";
const telefonoPM1 = "0412-1234567";
const bankPM1 = "Banesco";

// Datos para Pago Móvil 2 (Banco de Venezuela)
const cedulaPM2 = "V-87654321";
const telefonoPM2 = "0424-7654321";
const bankPM2 = "Banco de Venezuela";

// Números de WhatsApp para contacto (con código de país sin el +) - Añadido desde el segundo código
const whatsappNumber1 = "584121234567";
const whatsappNumber2 = "584247654321";

const TOTAL_TICKETS = 10000; // Total de tickets disponibles
const MIN_TICKETS_PURCHASE = 2; // Compra mínima

let soldTickets = new Set(); // Almacena los tickets ya vendidos
let selectedTickets = new Set(); // Tickets seleccionados por el usuario en el modal

// Referencia al loader
const loaderWrapper = document.getElementById('loader-wrapper');

// Función para mostrar el loader
function showLoader() {
    loaderWrapper.classList.remove('hidden');
}

// Función para ocultar el loader
function hideLoader() {
    loaderWrapper.classList.add('hidden');
}

async function obtenerTasaDolar() {
    try {
        const res = await fetch("https://pydolarvenezuela-api.vercel.app/api/v1/dollar/bcv");
        const data = await res.json();
        tasaDolar = parseFloat(data.price);
        calcularMonto();
    } catch (error) {
        console.error("Error al obtener la tasa del dólar:", error);
        tasaDolar = 98; // valor por defecto si falla la API
        calcularMonto();
        alert("Advertencia: No se pudo obtener la tasa de cambio actual. Se usará un valor de Bs. 98 por dólar.");
    } finally {
        // El loader inicial ya maneja el ocultamiento
    }
}

function openModal(id) {
    document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

// Nueva función para abrir el modal de compra principal
function openPurchaseModal() {
    // Reinicia la selección de tickets al abrir el modal principal de compra
    selectedTickets.clear();
    updateSelectedTicketsInfo(); // Actualiza el display de tickets seleccionados

    // Restablecer el estado inicial del formulario de compra y sus botones/mensajes
    const raffleForm = document.getElementById('raffleForm');
    raffleForm.reset(); // Limpia los campos del formulario

    document.getElementById('paymentOptionsContainer').style.display = 'none'; // Oculta info de pago
    document.getElementById('submitRaffleFormBtn').style.display = 'none'; // Oculta botón de enviar
    document.getElementById('showPaymentDetailsBtn').style.display = 'block'; // Muestra botón "Pagar"
    document.getElementById('showPaymentDetailsBtn').disabled = false; // Asegura que no esté deshabilitado

    const raffleFormResponseMessage = document.getElementById('raffleFormResponseMessage');
    raffleFormResponseMessage.textContent = ''; // Limpia mensajes previos
    raffleFormResponseMessage.style.backgroundColor = 'transparent';
    raffleFormResponseMessage.style.color = 'black';

    // Limpiar mensajes de copia
    document.getElementById('pm1CopyMessage').textContent = '';
    document.getElementById('pm2CopyMessage').textContent = '';


    openModal('comprarModal');
}

function calcularMonto() {
    const cantidad = selectedTickets.size;
    let montoBs = 0;
    if (cantidad >= MIN_TICKETS_PURCHASE && tasaDolar > 0) {
        montoBs = (cantidad * precioTicketUSD * tasaDolar).toFixed(2);
    }
    document.getElementById("montoDisplay").innerText = `Monto a pagar: Bs. ${montoBs}`;

    // Actualiza los montos en las opciones de pago móvil
    document.getElementById("pm1Monto").innerText = `Bs. ${montoBs}`;
    document.getElementById("pm2Monto").innerText = `Bs. ${montoBs}`;
}

// Función para actualizar el display de tickets seleccionados en el formulario de compra
function updateSelectedTicketsInfo() {
    const display = document.getElementById('displaySelectedTickets');
    const selectedArr = Array.from(selectedTickets).sort((a, b) => a - b); // Ordenar para mejor visualización
    display.innerText = selectedArr.length > 0 ? selectedArr.join(', ') : 'Ninguno';
    calcularMonto(); // Recalcula el monto cuando cambia la selección
}

// Nueva función para enviar datos a Google Apps Script (modificada para loader y GET/POST)
async function enviarDatosAAppsScript(data, sheetName, method = "POST") {
    showLoader();
    const formData = new FormData();
    for (const key in data) {
        formData.append(key, data[key]);
    }
    formData.append("sheet", sheetName);

    let url = SCRIPT_URL;
    if (method === "GET") {
        url += "?" + new URLSearchParams(formData).toString();
    }

    try {
        const response = await fetch(url, {
            method: method,
            body: method === "POST" ? formData : null, // Solo body para POST
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error al enviar datos a Google Sheets:", error);
        return { status: "error", message: "No se pudo conectar con el servidor de Google Sheets." };
    } finally {
        hideLoader();
    }
}

// --- Lógica del Modal de Selección de Tickets ---
async function openTicketSelectionModal() {
    showLoader();
    closeModal('comprarModal'); // Cierra el modal de compra temporalmente

    // Obtener tickets vendidos al abrir el modal
    const result = await enviarDatosAAppsScript({}, "TicketsComprados", "GET"); // No se envía data, solo se pide los tickets
    // hideLoader() ya lo maneja enviarDatosAAppsScript

    if (result.status === "success") {
        soldTickets = new Set(result.soldTickets); // Actualiza la lista de tickets vendidos
        renderTicketGrid(); // Renderiza la cuadrícula de tickets

        // Restaurar la selección actual del usuario si ya había seleccionado algo antes de cerrar
        const currentSelectedTicketsArr = Array.from(selectedTickets);
        selectedTickets.clear(); // Limpiar y volver a seleccionar para asegurar que el DOM refleje
        currentSelectedTicketsArr.forEach(ticketNum => {
            const ticketElement = document.getElementById(`ticket-${ticketNum}`);
            if (ticketElement && !ticketElement.classList.contains('sold')) {
                ticketElement.classList.add('selected');
                selectedTickets.add(ticketNum);
            }
        });
        updateModalSelectedTicketsDisplay();
        openModal('ticketSelectionModal'); // Abre el modal de tickets
    } else {
        alert("Error al cargar la lista de tickets: " + result.message);
        openModal('comprarModal'); // Vuelve al modal de compra si falla
    }
}

function renderTicketGrid() {
    const ticketGrid = document.getElementById('ticketGrid');
    ticketGrid.innerHTML = ''; // Limpiar cuadrícula existente

    for (let i = 1; i <= TOTAL_TICKETS; i++) {
        const ticketDiv = document.createElement('div');
        ticketDiv.id = `ticket-${i}`;
        ticketDiv.className = 'ticket-item';
        ticketDiv.innerText = i;

        if (soldTickets.has(i)) {
            ticketDiv.classList.add('sold');
        } else {
            ticketDiv.classList.add('available');
            ticketDiv.onclick = () => toggleTicketSelection(i, ticketDiv);
        }
        ticketGrid.appendChild(ticketDiv);
    }
}

function toggleTicketSelection(ticketNum, element) {
    if (element.classList.contains('sold')) {
        // No hacer nada si el ticket está vendido
        return;
    }

    if (selectedTickets.has(ticketNum)) {
        selectedTickets.delete(ticketNum);
        element.classList.remove('selected');
        element.classList.add('available');
    } else {
        selectedTickets.add(ticketNum);
        element.classList.add('selected');
        element.classList.remove('available');
    }
    updateModalSelectedTicketsDisplay();
}

function updateModalSelectedTicketsDisplay() {
    const display = document.getElementById('currentSelectedTickets');
    const countDisplay = document.getElementById('currentTicketsCount');
    const selectedArr = Array.from(selectedTickets).sort((a, b) => a - b);
    display.innerText = selectedArr.length > 0 ? selectedArr.join(', ') : 'Ninguno';
    countDisplay.innerText = `${selectedArr.length} ticket(s) seleccionado(s)`;
}

function confirmTicketSelection() {
    if (selectedTickets.size < MIN_TICKETS_PURCHASE) {
        alert(`Debe seleccionar al menos ${MIN_TICKETS_PURCHASE} tickets.`);
        return;
    }
    updateSelectedTicketsInfo(); // Actualiza la información en el modal de compra
    closeModal('ticketSelectionModal');
    openModal('comprarModal'); // Vuelve al modal de compra
}

function cancelTicketSelection() {
    // Al cancelar, descartar la selección actual
    selectedTickets.clear(); // Limpiar la selección si el usuario cancela
    updateSelectedTicketsInfo(); // Actualizar el display principal
    closeModal('ticketSelectionModal');
    openModal('comprarModal');
}

// --- Fin Lógica del Modal de Selección de Tickets ---

// Función para copiar datos al portapapeles
function copyToClipboard(text, messageElementId) {
    navigator.clipboard.writeText(text).then(() => {
        const messageElement = document.getElementById(messageElementId);
        messageElement.textContent = '¡Copiado!';
        setTimeout(() => {
            messageElement.textContent = '';
        }, 2000); // El mensaje desaparece después de 2 segundos
    }).catch(err => {
        console.error('Error al copiar: ', err);
        alert('Error al copiar los datos. Por favor, inténtalo manualmente.');
    });
}

// Función para manejar la copia de datos de Pago Móvil
function copyPaymentData(type) {
    let dataToCopy = '';
    let messageElementId = '';
    const monto = document.getElementById('montoDisplay').textContent.replace('Monto a pagar: ', ''); // Obtiene el monto del display general

    if (type === 'pm1') {
        const bank = document.getElementById('pm1Bank').textContent;
        const cedula = document.getElementById('pm1Cedula').textContent;
        const phone = document.getElementById('pm1Phone').textContent;
        dataToCopy = `Pago Móvil (${bank}):\nBanco: ${bank}\nCédula: ${cedula}\nTeléfono: ${phone}\nMonto: ${monto}`;
        messageElementId = 'pm1CopyMessage';
    } else if (type === 'pm2') {
        const bank = document.getElementById('pm2Bank').textContent;
        const cedula = document.getElementById('pm2Cedula').textContent;
        const phone = document.getElementById('pm2Phone').textContent;
        dataToCopy = `Pago Móvil (${bank}):\nBanco: ${bank}\nCédula: ${cedula}\nTeléfono: ${phone}\nMonto: ${monto}`;
        messageElementId = 'pm2CopyMessage';
    }
    copyToClipboard(dataToCopy, messageElementId);
}

// Lógica para el nuevo flujo de "Pagar" y "Enviar Registros"
document.addEventListener('DOMContentLoaded', function() {
    const raffleForm = document.getElementById('raffleForm');
    const showPaymentDetailsBtn = document.getElementById('showPaymentDetailsBtn'); // Botón "Pagar"
    const submitRaffleFormBtn = document.getElementById('submitRaffleFormBtn'); // Botón "Enviar Registros"
    const paymentOptionsContainer = document.getElementById('paymentOptionsContainer'); // Nuevo contenedor de opciones de pago
    const raffleFormResponseMessage = document.getElementById('raffleFormResponseMessage'); // Mensajes del formulario de compra

    // Inicializar los valores fijos de pago móvil
    document.getElementById('pm1Bank').textContent = bankPM1;
    document.getElementById('pm1Cedula').textContent = cedulaPM1;
    document.getElementById('pm1Phone').textContent = telefonoPM1;

    document.getElementById('pm2Bank').textContent = bankPM2;
    document.getElementById('pm2Cedula').textContent = cedulaPM2;
    document.getElementById('pm2Phone').textContent = telefonoPM2;

    // Evento para mostrar las opciones de pago y el botón de enviar
    showPaymentDetailsBtn.addEventListener('click', function(event) {
        // Validación de campos del formulario antes de mostrar el pago
        if (!raffleForm.checkValidity()) {
            raffleForm.reportValidity(); // Muestra mensajes de error del navegador
            raffleFormResponseMessage.textContent = 'Por favor, completa todos los campos requeridos y selecciona tus tickets antes de proceder al pago.';
            raffleFormResponseMessage.style.color = 'red';
            raffleFormResponseMessage.style.backgroundColor = '#ffe0e0';
            return;
        }

        // Validar que se hayan seleccionado tickets
        if (selectedTickets.size < MIN_TICKETS_PURCHASE) {
            alert(`Por favor, selecciona al menos ${MIN_TICKETS_PURCHASE} tickets antes de proceder al pago.`);
            raffleFormResponseMessage.textContent = `Por favor, selecciona al menos ${MIN_TICKETS_PURCHASE} tickets.`;
            raffleFormResponseMessage.style.color = 'orange';
            raffleFormResponseMessage.style.backgroundColor = '#fff3cd';
            return;
        }

        // Si todas las validaciones pasan, muestra la información de pago y el botón de enviar
        paymentOptionsContainer.style.display = 'block'; // Muestra el nuevo contenedor de opciones de pago
        submitRaffleFormBtn.style.display = 'block'; // Muestra el botón de enviar
        showPaymentDetailsBtn.style.display = 'none'; // Oculta el botón de "Pagar"
        showPaymentDetailsBtn.disabled = false; // Asegura que no esté deshabilitado
        raffleFormResponseMessage.textContent = ''; // Limpia mensajes previos
        raffleFormResponseMessage.style.backgroundColor = 'transparent';
        raffleFormResponseMessage.style.color = 'black';
        calcularMonto(); // Asegura que el monto esté actualizado en las opciones de pago
    });

    // Evento para enviar el formulario a Google Apps Script (cuando se presiona "Enviar Registros")
    raffleForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Evita el envío tradicional del formulario HTML

        raffleFormResponseMessage.textContent = 'Enviando tus registros... por favor espera.';
        raffleFormResponseMessage.style.color = 'blue';
        raffleFormResponseMessage.style.backgroundColor = '#e0f7fa';

        // Deshabilitar botones para evitar envíos múltiples
        showPaymentDetailsBtn.disabled = true;
        submitRaffleFormBtn.disabled = true;

        // Recopilar datos del formulario
        const nombre = document.getElementById("nombre").value.trim();
        const apellido = document.getElementById("apellido").value.trim();
        const cedula = document.getElementById("cedula").value.trim();
        const telefono = document.getElementById("telefono").value.trim();
        const correo = document.getElementById("correo").value.trim();
        const montoBsText = document.getElementById("montoDisplay").innerText;
        const montoBs = parseFloat(montoBsText.replace('Monto a pagar: Bs. ', ''));

        const purchaseData = {
            nombre,
            apellido,
            cedula,
            telefono,
            correo,
            selectedTickets: Array.from(selectedTickets).join(','), // Enviar los tickets seleccionados como CSV
            montoBs
        };

        const result = await enviarDatosAAppsScript(purchaseData, "TicketsComprados", "POST");

        if (result.status === "success") {
            raffleFormResponseMessage.textContent = '¡Registros enviados con éxito! Después de validar su pago, recibirá un correo con sus tickets solicitados. ¡Mucha suerte!';
            raffleFormResponseMessage.style.color = 'green';
            raffleFormResponseMessage.style.backgroundColor = '#e8f5e9';

            // Limpiar formulario después del envío exitoso
            raffleForm.reset();
            selectedTickets.clear(); // Limpiar la selección de tickets
            updateSelectedTicketsInfo(); // Actualizar el display de tickets

            paymentOptionsContainer.style.display = 'none'; // Oculta las opciones de pago
            submitRaffleFormBtn.style.display = 'none'; // Oculta el botón de enviar
            showPaymentDetailsBtn.style.display = 'block'; // Vuelve a mostrar el botón de "Pagar"
            showPaymentDetailsBtn.disabled = false; // Habilita el botón de "Pagar"

        } else {
            raffleFormResponseMessage.textContent = `Error al enviar los registros: ${result.message || 'Inténtelo de nuevo.'}`;
            raffleFormResponseMessage.style.color = 'red';
            raffleFormResponseMessage.style.backgroundColor = '#ffe0e0';

            // Re-habilitar botones para permitir reintentar
            showPaymentDetailsBtn.disabled = false;
            submitRaffleFormBtn.disabled = false;
        }
    });
});

// Función para enviar datos del reporte de pago (mantener tal cual)
async function enviarReporte() {
    const cedula = document.getElementById("cedulaReporte").value.trim();
    const telefono = document.getElementById("telefonoReporte").value.trim();
    const correo = document.getElementById("correoReporte").value.trim(); // Obtener el correo
    const referencia = document.getElementById("referencia").value.trim();
    const bancoEmisor = document.getElementById("bancoEmisor").value;

    if (!cedula || !telefono || !correo || !referencia || bancoEmisor === "Seleccione banco emisor" || bancoEmisor === "") {
        alert("Por favor, complete todos los campos del reporte correctamente.");
        return;
    }

    // Datos a enviar para el reporte de pago
    const reportData = {
        cedula,
        telefono,
        correo, // Incluir correo en los datos del reporte
        referencia,
        bancoEmisor
    };

    const result = await enviarDatosAAppsScript(reportData, "ReportesDePago", "POST");

    if (result.status === "success") {
        alert("¡Reporte de pago enviado con éxito! Gracias por su información.");
        closeModal("reportModal");
        // Limpiar los campos del formulario de reporte
        document.getElementById("cedulaReporte").value = '';
        document.getElementById("telefonoReporte").value = '';
        document.getElementById("correoReporte").value = ''; // Limpiar el correo
        document.getElementById("referencia").value = '';
        document.getElementById("bancoEmisor").value = "";
    } else {
        alert("Error al enviar el reporte de pago: " + result.message);
    }
}

// Ocultar el loader inicial cuando el DOM esté completamente cargado y obtener la tasa del dólar
document.addEventListener('DOMContentLoaded', () => {
    obtenerTasaDolar().finally(() => {
        setTimeout(hideLoader, 500);
    });
});
