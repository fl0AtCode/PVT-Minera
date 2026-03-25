// Dashboard Admin - Tarjeta Digital

let allEmployees = [];
let allDocuments = [];
let cropper = null;
let currentCropType = null; // 'photo' o 'header'
let currentReportType = null; // 'daily' o 'weekly'

// Etiquetas de nivel de riesgo
const RISK_LABELS = {
    'bajo_riesgo': 'Bajo Riesgo',
    'riesgo_medio': 'Riesgo Medio',
    'alto_riesgo': 'Alto Riesgo'
};

document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
    setupEventListeners();
});

// ============================================
// Verificar sesión admin
// ============================================
async function checkAdminSession() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) throw new Error('No autenticado');

        const data = await response.json();
        if (data.user.role !== 'admin') {
            window.location.href = '/index.html';
            return;
        }

        document.getElementById('adminName').textContent = data.user.full_name;
        loadEmployees();
    } catch (error) {
        window.location.href = '/index.html';
    }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Botón agregar empleado
    document.getElementById('addEmployeeBtn').addEventListener('click', () => openModal());

    // Cerrar modal
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelModal').addEventListener('click', closeModal);
    document.getElementById('employeeModal').addEventListener('click', (e) => {
        if (e.target.id === 'employeeModal') closeModal();
    });

    // Formulario de empleado
    document.getElementById('employeeForm').addEventListener('submit', handleSubmitEmployee);

    // Búsqueda
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchEmployees(e.target.value.trim());
        }, 300);
    });

    // Exportar CSV
    document.getElementById('exportBtn').addEventListener('click', exportCSV);

    // Reportes PVT
    document.getElementById('dailyReportBtn').addEventListener('click', () => openReportModal('daily'));
    document.getElementById('weeklyReportBtn').addEventListener('click', () => openReportModal('weekly'));
    document.getElementById('downloadReport').addEventListener('click', downloadReport);
    document.getElementById('closeReportDate').addEventListener('click', closeReportModal);
    document.getElementById('cancelReportDate').addEventListener('click', closeReportModal);
    document.getElementById('reportDateModal').addEventListener('click', (e) => {
        if (e.target.id === 'reportDateModal') closeReportModal();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Foto de empleado - abrir cropper
    document.getElementById('empPhoto').addEventListener('change', (e) => {
        openCropper(e, 'photo');
    });

    // Header - abrir cropper
    document.getElementById('empHeader').addEventListener('change', (e) => {
        openCropper(e, 'header');
    });

    // Formateo de RUT en tiempo real
    document.getElementById('empRut').addEventListener('input', handleRutInput);

    // Cropper modal
    document.getElementById('cropperAccept').addEventListener('click', acceptCrop);
    document.getElementById('cropperCancel').addEventListener('click', closeCropper);
    document.getElementById('closeCropper').addEventListener('click', closeCropper);
}

// ============================================
// Cargar empleados
// ============================================
async function loadEmployees() {
    try {
        const response = await fetch('/api/admin/employees');
        if (!response.ok) throw new Error('Error al cargar empleados');

        const data = await response.json();
        allEmployees = data.employees;
        allDocuments = data.documents;

        renderEmployees(allEmployees);
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al cargar empleados', 'error');
    }
}

// ============================================
// Renderizar tabla de empleados
// ============================================
function renderEmployees(employees) {
    const tbody = document.getElementById('employeesTableBody');
    const countEl = document.getElementById('employeeCount');

    countEl.textContent = `${employees.length} empleado${employees.length !== 1 ? 's' : ''} registrado${employees.length !== 1 ? 's' : ''}`;

    if (employees.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 60px; color: var(--text-muted);">
          No hay empleados registrados aún
        </td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        // Generar badges de documentos
        const docBadges = allDocuments.map(doc => {
            const isRead = emp.document_reads?.some(r => r.document_id === doc.id);
            const readInfo = emp.document_reads?.find(r => r.document_id === doc.id);
            const readDate = readInfo ? new Date(readInfo.read_at).toLocaleDateString('es-CL') : '';

            return `<span class="doc-badge ${isRead ? 'read' : 'unread'}" title="${doc.title}${readDate ? ` - Leído el ${readDate}` : ' - No leído'}">
        ${isRead ? '✓' : '✕'} ${doc.title.substring(0, 15)}${doc.title.length > 15 ? '...' : ''}
      </span>`;
        }).join(' ');

        const avatarUrl = emp.photo_url || `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231e293b" width="100" height="100" rx="50"/><text fill="%2394a3b8" x="50" y="55" text-anchor="middle" font-size="36">${(emp.full_name ? emp.full_name.charAt(0).toUpperCase() : '?')}</text></svg>`;

        // Generar badge de riesgo PVT
        let fatigueBadge = '<span class="fatigue-badge fatigue-none">Sin test</span>';
        if (emp.last_fatigue_test) {
            const ft = emp.last_fatigue_test;
            const ftDate = new Date(ft.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' });
            const levelLabel = RISK_LABELS[ft.risk_level] || ft.risk_level;
            fatigueBadge = `<span class="fatigue-badge risk-${ft.risk_level}" title="RT prom: ${ft.avg_reaction_ms}ms · ${ft.lapses} lapsos - ${ftDate}">${levelLabel}</span>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">${ftDate}</div>`;
        }

        return `
      <tr>
        <td>
          <div class="employee-info">
            <img src="${avatarUrl}" alt="${emp.full_name}" class="employee-avatar">
            <div>
              <div class="employee-name">${emp.full_name}</div>
              <div class="employee-email">${emp.email || ''}</div>
            </div>
          </div>
        </td>
        <td><code style="background: var(--surface); padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${emp.username}</code></td>
        <td>${emp.position || '<span class="text-muted">Sin cargo</span>'}</td>
        <td>${emp.rut || '<span class="text-muted">Sin RUT</span>'}</td>
        <td>${fatigueBadge}</td>
        <td>${docBadges || '<span class="text-muted">-</span>'}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-primary btn-sm" onclick="viewCard(${emp.id})" title="Ver tarjeta digital">
              Ver tarjeta
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editEmployee(${emp.id})" title="Editar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${emp.id}, '${emp.full_name.replace(/'/g, "\\'")}')" title="Eliminar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
}

// ============================================
// Búsqueda
// ============================================
async function searchEmployees(query) {
    if (!query) {
        renderEmployees(allEmployees);
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Error en búsqueda');

        const data = await response.json();
        renderEmployees(data.employees);
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// Modal: Abrir / Cerrar
// ============================================
function openModal(employee = null) {
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('modalTitle');
    const passwordGroup = document.getElementById('passwordGroup');
    const submitBtn = document.getElementById('submitBtn');
    const usernameInput = document.getElementById('empUsername');

    // Reset formulario
    document.getElementById('employeeForm').reset();
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoUploadText').style.display = 'block';
    document.getElementById('headerPreview').style.display = 'none';
    document.getElementById('headerUploadText').style.display = 'block';
    document.getElementById('rutPreview').textContent = '';
    document.getElementById('croppedPhotoData').value = '';
    document.getElementById('croppedHeaderData').value = '';

    if (employee) {
        // Modo edición
        title.textContent = 'Editar Empleado';
        submitBtn.textContent = 'Actualizar';
        passwordGroup.style.display = 'none';
        usernameInput.readOnly = true;
        usernameInput.style.opacity = '0.6';
        document.getElementById('employeeId').value = employee.id;
        document.getElementById('empUsername').value = employee.username || '';
        document.getElementById('empName').value = employee.full_name;
        document.getElementById('empEmail').value = employee.email || '';
        document.getElementById('empPhone').value = employee.phone || '';
        document.getElementById('empPosition').value = employee.position || '';
        // Mostrar RUT sin formato para edición
        const cleanRut = employee.rut ? employee.rut.replace(/[^0-9kK]/gi, '') : '';
        document.getElementById('empRut').value = cleanRut;
        if (cleanRut) handleRutInput({ target: { value: cleanRut } });

        if (employee.photo_url) {
            document.getElementById('photoPreview').src = employee.photo_url;
            document.getElementById('photoPreview').style.display = 'block';
            document.getElementById('photoUploadText').style.display = 'none';
        }

        if (employee.header_url) {
            document.getElementById('headerPreview').src = employee.header_url;
            document.getElementById('headerPreview').style.display = 'block';
            document.getElementById('headerUploadText').style.display = 'none';
        }
    } else {
        // Modo creación
        title.textContent = 'Agregar Empleado';
        submitBtn.textContent = 'Guardar';
        passwordGroup.style.display = 'block';
        usernameInput.readOnly = false;
        usernameInput.style.opacity = '1';
        document.getElementById('employeeId').value = '';
    }

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('employeeModal').classList.remove('active');
}

// ============================================
// Cropper: Abrir / Cerrar / Aceptar
// ============================================
function openCropper(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    currentCropType = type;
    const reader = new FileReader();
    reader.onload = (event) => {
        const cropperImage = document.getElementById('cropperImage');
        cropperImage.src = event.target.result;

        // Configurar título
        document.getElementById('cropperTitle').textContent =
            type === 'photo' ? 'Ajustar foto (500x500)' : 'Ajustar cabecera (1200x400)';

        // Abrir modal del cropper
        document.getElementById('cropperModal').classList.add('active');

        // Destruir cropper anterior si existe
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        // Crear cropper según el tipo
        setTimeout(() => {
            const options = {
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                responsive: true,
                background: true,
                guides: true,
                cropBoxResizable: true,
                cropBoxMovable: true,
            };

            if (type === 'photo') {
                options.aspectRatio = 1; // 1:1 para foto de perfil
            } else {
                options.aspectRatio = 3; // 3:1 para header (1200x400)
            }

            cropper = new Cropper(cropperImage, options);
        }, 200);
    };
    reader.readAsDataURL(file);
}

function closeCropper() {
    document.getElementById('cropperModal').classList.remove('active');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    currentCropType = null;
    // Reset file input
    if (currentCropType === 'photo') {
        document.getElementById('empPhoto').value = '';
    } else {
        document.getElementById('empHeader').value = '';
    }
}

function acceptCrop() {
    if (!cropper || !currentCropType) return;

    const canvas = cropper.getCroppedCanvas({
        width: currentCropType === 'photo' ? 500 : 1200,
        height: currentCropType === 'photo' ? 500 : 400,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    if (currentCropType === 'photo') {
        document.getElementById('croppedPhotoData').value = dataUrl;
        document.getElementById('photoPreview').src = dataUrl;
        document.getElementById('photoPreview').style.display = 'block';
        document.getElementById('photoUploadText').style.display = 'none';
    } else {
        document.getElementById('croppedHeaderData').value = dataUrl;
        document.getElementById('headerPreview').src = dataUrl;
        document.getElementById('headerPreview').style.display = 'block';
        document.getElementById('headerUploadText').style.display = 'none';
    }

    // Cerrar modal
    document.getElementById('cropperModal').classList.remove('active');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    currentCropType = null;

    showToast('Imagen recortada correctamente', 'success');
}

// ============================================
// Crear/Editar empleado
// ============================================
async function handleSubmitEmployee(e) {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value;
    const isEditing = !!employeeId;

    // Preparar datos como JSON (no FormData, porque enviamos base64)
    const body = {
        username: document.getElementById('empUsername').value.trim(),
        full_name: document.getElementById('empName').value.trim(),
        email: document.getElementById('empEmail').value.trim(),
        phone: document.getElementById('empPhone').value.trim(),
        position: document.getElementById('empPosition').value.trim(),
        rut: document.getElementById('empRut').value.trim(),
    };

    if (!isEditing) {
        const password = document.getElementById('empPassword').value;
        if (!password || password.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        body.password = password;
    }

    // Incluir imágenes recortadas si existen
    const croppedPhoto = document.getElementById('croppedPhotoData').value;
    if (croppedPhoto) {
        body.photo_base64 = croppedPhoto;
    }

    const croppedHeader = document.getElementById('croppedHeaderData').value;
    if (croppedHeader) {
        body.header_base64 = croppedHeader;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    try {
        const url = isEditing ? `/api/admin/employees/${employeeId}` : '/api/admin/employees';
        const method = isEditing ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Error al guardar');

        showToast(data.message, 'success');
        closeModal();
        loadEmployees();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEditing ? 'Actualizar' : 'Guardar';
    }
}

// ============================================
// Editar empleado
// ============================================
function editEmployee(id) {
    const employee = allEmployees.find(e => e.id === id);
    if (employee) openModal(employee);
}

// ============================================
// Eliminar empleado
// ============================================
async function deleteEmployee(id, name) {
    if (!confirm(`¿Estás seguro de eliminar a "${name}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Error al eliminar');

        showToast(data.message, 'success');
        loadEmployees();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// Ver tarjeta digital
// ============================================
function viewCard(id) {
    window.open(`/card.html?id=${id}`, '_blank');
}

// ============================================
// Exportar CSV
// ============================================
async function exportCSV() {
    try {
        const response = await fetch('/api/admin/employees/export');
        if (!response.ok) throw new Error('Error al exportar');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'empleados.csv';
        a.click();
        URL.revokeObjectURL(url);

        showToast('CSV descargado exitosamente', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// Reportes PVT (Excel)
// ============================================
function openReportModal(type) {
    currentReportType = type;
    const modal = document.getElementById('reportDateModal');
    const title = document.getElementById('reportDateTitle');
    const label = document.getElementById('reportDateLabel');
    const dateInput = document.getElementById('reportDateInput');

    // Configurar según tipo
    if (type === 'daily') {
        title.textContent = 'Reporte Diario PVT';
        label.textContent = 'Selecciona el día del reporte';
        dateInput.type = 'date';
    } else {
        title.textContent = 'Reporte Semanal PVT';
        label.textContent = 'Selecciona el lunes de la semana';
        dateInput.type = 'date';
    }

    // Default: hoy para diario, lunes de esta semana para semanal
    const today = new Date();
    if (type === 'daily') {
        dateInput.value = today.toISOString().split('T')[0];
    } else {
        // Calcular lunes de esta semana
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        dateInput.value = monday.toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

function closeReportModal() {
    document.getElementById('reportDateModal').classList.remove('active');
    currentReportType = null;
}

async function downloadReport() {
    const dateInput = document.getElementById('reportDateInput');
    const date = dateInput.value;

    if (!date) {
        showToast('Selecciona una fecha', 'warning');
        return;
    }

    try {
        let url;
        let filename;

        if (currentReportType === 'daily') {
            url = `/api/admin/reports/daily?date=${date}`;
            filename = `Reporte_Diario_PVT_${date.replace(/-/g, '')}.xlsx`;
        } else {
            url = `/api/admin/reports/weekly?week_start=${date}`;
            filename = `Reporte_Semanal_PVT_${date.replace(/-/g, '')}.xlsx`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al generar reporte');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);

        showToast(`Reporte ${currentReportType === 'daily' ? 'diario' : 'semanal'} descargado`, 'success');
        closeReportModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// Formateo de RUT en tiempo real
// ============================================
function handleRutInput(e) {
    const value = e.target.value.replace(/[^0-9kK]/gi, '');
    const preview = document.getElementById('rutPreview');

    if (value.length === 9) {
        const body = value.slice(0, -1);
        const dv = value.slice(-1).toUpperCase();
        const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        preview.textContent = `Formato: ${formatted}-${dv}`;
        preview.style.color = '#10b981';
    } else if (value.length > 0) {
        preview.textContent = `${value.length}/9 dígitos`;
        preview.style.color = '#f59e0b';
    } else {
        preview.textContent = '';
    }
}

// ============================================
// Logout
// ============================================
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        // Ignorar errores
    }
    window.location.href = '/index.html';
}

// ============================================
// Toast
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
