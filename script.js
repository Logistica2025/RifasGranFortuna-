// ** IMPORTANTE: REEMPLAZA ESTA URL CON LA URL DE DESPLIEGUE DE TU APPS SCRIPT (doPost) **
// Esta es la URL de tu proyecto "WebFormularioDeRifa" en Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqG-mAFv-sdK5vP3kkUyIHFdf4kIXfdPieO-u7fYT_pfoE_ZPfqegsv6b8GvtFO7CnKQ/exec"; // <-- ¡ACTUALIZA ESTO CON TU PROPIA URL!

let tasaDolar = 0;
const precioTicketUSD = 1;

// Datos para Pago Móvil (se usan para todos los bancos en este flujo)
const cedulaFija = "12345678"; // <--- CAMBIA ESTOS DATOS POR LA CÉDULA DEL BENEFICIARIO
const telefonoFijo = "04141234567"; // <--- CAMBIA ESTOS DATOS POR EL TELÉFONO DEL BENEFICIARIO

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
        tasaDolar = 40; // valor por defecto si falla la API
        calcularMonto();
        alert("Advertencia: No se pudo obtener la tasa de cambio actual. Se usará un valor de Bs. 40 por dólar.");
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

// Función para abrir el modal de compra principal
function openPurchaseModal() {
    // Reinicia la selección de tickets al abrir el modal principal de compra
    selectedTickets.clear();
    updateSelectedTicketsInfo(); // Actualiza el display de tickets seleccionados

    // Limpia los campos del formulario de compra
    const raffleForm = document.getElementById('raffleForm');
    raffleForm.reset();

    // Limpia y restablece el mensaje de respuesta del formulario de compra
    const raffleFormResponseMessage = document.getElementById('raffleFormResponseMessage');
    raffleFormResponseMessage.textContent = '';
    raffleFormResponseMessage.style.backgroundColor = 'transparent';
    raffleFormResponseMessage.style.color = 'black';

    openModal('comprarModal');
}

function calcularMonto() {
    const cantidad = selectedTickets.size;
    let montoBs = 0;
    if (cantidad >= MIN_TICKETS_PURCHASE && tasaDolar > 0) {
        montoBs = (cantidad * precioTicketUSD * tasaDolar).toFixed(2);
    }
    // Actualiza el monto en el display principal del modal de compra
    document.getElementById("montoDisplay").innerText = `Monto a pagar: Bs. ${montoBs}`;
    // Actualiza el monto en el modal de bancos
    document.getElementById("bankModalMonto").innerText = `Bs. ${montoBs}`;
    // El paymentInfo en paymentModal se actualiza en mostrarDatosPago()
}

// Función para actualizar el display de tickets seleccionados en el formulario de compra
function updateSelectedTicketsInfo() {
    const display = document.getElementById('displaySelectedTickets');
    const selectedArr = Array.from(selectedTickets).sort((a, b) => a - b); // Ordenar para mejor visualización
    display.innerText = selectedArr.length > 0 ? selectedArr.join(', ') : 'Ninguno';
    calcularMonto(); // Recalcula el monto cuando cambia la selección
}

// Función para enviar datos a Google Apps Script (modificada para loader y GET/POST)
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
    const result = await enviarDatosAAppsScript({}, "TicketsComprados", "GET");

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


// Lógica para el nuevo flujo de "Pagar" y "Enviar Registros"
document.addEventListener('DOMContentLoaded', function() {
    const raffleForm = document.getElementById('raffleForm');
    const showPaymentOptionsBtn = document.getElementById('showPaymentOptionsBtn'); // Botón "Pagar"
    const submitRaffleFormBtn = document.getElementById('submitRaffleFormBtn'); // Botón "Enviar Registros"
    const raffleFormResponseMessage = document.getElementById('raffleFormResponseMessage'); // Mensajes del formulario de compra

    // Evento para el botón "Pagar" (que abre el modal de bancos)
    showPaymentOptionsBtn.addEventListener('click', function(event) {
        // Validación de campos del formulario antes de mostrar opciones de pago
        if (!raffleForm.checkValidity()) {
            raffleForm.reportValidity(); // Muestra mensajes de error del navegador
            raffleFormResponseMessage.textContent = 'Por favor, completa todos los campos requeridos y selecciona tus tickets antes de ver las opciones de pago.';
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

        // Si todas las validaciones pasan, abre el modal de selección de bancos
        closeModal('comprarModal'); // Cierra el modal de compra temporalmente
        openModal('bankModal'); // Abre el modal de selección de banco
        raffleFormResponseMessage.textContent = ''; // Limpia mensajes previos
        raffleFormResponseMessage.style.backgroundColor = 'transparent';
        raffleFormResponseMessage.style.color = 'black';
    });

    // Evento para el botón "Enviar Registros" (cuando se presiona "Enviar Registros")
    raffleForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Evita el envío tradicional del formulario HTML

        // Primero, una validación rápida antes de intentar enviar
        if (!raffleForm.checkValidity()) {
            raffleForm.reportValidity();
            raffleFormResponseMessage.textContent = 'Por favor, completa todos los campos requeridos antes de enviar los registros.';
            raffleFormResponseMessage.style.color = 'red';
            raffleFormResponseMessage.style.backgroundColor = '#ffe0e0';
            return;
        }
        if (selectedTickets.size < MIN_TICKETS_PURCHASE) {
            alert(`Por favor, selecciona al menos ${MIN_TICKETS_PURCHASE} tickets antes de enviar los registros.`);
            raffleFormResponseMessage.textContent = `Por favor, selecciona al menos ${MIN_TICKETS_PURCHASE} tickets.`;
            raffleFormResponseMessage.style.color = 'orange';
            raffleFormResponseMessage.style.backgroundColor = '#fff3cd';
            return;
        }

        raffleFormResponseMessage.textContent = 'Enviando tus registros... por favor espera.';
        raffleFormResponseMessage.style.color = 'blue';
        raffleFormResponseMessage.style.backgroundColor = '#e0f7fa';

        // Deshabilitar botones para evitar envíos múltiples
        showPaymentOptionsBtn.disabled = true;
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

            // Re-habilitar botones para un nuevo proceso
            showPaymentOptionsBtn.disabled = false;
            submitRaffleFormBtn.disabled = false;

        } else {
            raffleFormResponseMessage.textContent = `Error al enviar los registros: ${result.message || 'Inténtelo de nuevo.'}`;
            raffleFormResponseMessage.style.color = 'red';
            raffleFormResponseMessage.style.backgroundColor = '#ffe0e0';

            // Re-habilitar botones para permitir reintentar
            showPaymentOptionsBtn.disabled = false;
            submitRaffleFormBtn.disabled = false;
        }
    });
});


// Las funciones `mostrarDatosPago` y `copiarDatos` se mantienen para el flujo de pago móvil.

function mostrarDatosPago(banco) {
    closeModal("bankModal");
    const montoBsText = document.getElementById("montoDisplay").innerText; // Obtener el monto de la compra
    const montoBs = parseFloat(montoBsText.replace('Monto a pagar: Bs. ', ''));
    const datos = `Banco: ${banco}\nCédula: ${cedulaFija}\nTeléfono: ${telefonoFijo}\nMonto: Bs. ${montoBs}`;
    document.getElementById("paymentInfo").innerText = datos;
    openModal("paymentModal");
}

function copiarDatos() {
    const texto = document.getElementById("paymentInfo").innerText;
    navigator.clipboard.writeText(texto).then(() => alert("Datos copiados al portapapeles"));
}

// Función para enviar datos del reporte de pago (mantener tal cual)
async function enviarReporte() {
    const cedula = document.getElementById("cedulaReporte").value.trim();
    const telefono = document.getElementById("telefonoReporte").value.trim();
    const correo = document.getElementById("correoReporte").value.trim();
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
        correo,
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
        document.getElementById("correoReporte").value = '';
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
