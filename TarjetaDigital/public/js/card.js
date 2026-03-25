// Tarjeta Digital - card.js

let currentUser = null;
let cardUrl = '';
let pendingDocId = null;
let isOwner = false; // Solo el dueño de la tarjeta puede checkear documentos
let cardUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    cardUserId = urlParams.get('id');

    if (!cardUserId) {
        showError();
        return;
    }

    loadCard(cardUserId);
    setupEventListeners();
});

// ============================================
// Cargar datos de la tarjeta
// ============================================
async function loadCard(userId) {
    try {
        // Verificar si el usuario logueado es el dueño de esta tarjeta
        await checkOwnership(userId);

        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) throw new Error('No encontrado');

        const data = await response.json();
        currentUser = data.user;
        cardUrl = data.card_url;

        renderCard(data);
        renderContactButtons(data.user);
        loadDocuments(userId);
    } catch (error) {
        console.error('Error:', error);
        showError();
    }
}

// ============================================
// Verificar si el usuario logueado es el dueño de la tarjeta
// ============================================
async function checkOwnership(cardId) {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            // Solo es dueño si el ID del usuario logueado coincide con el ID de la tarjeta
            isOwner = (String(data.user.id) === String(cardId));
        }
    } catch (error) {
        isOwner = false;
    }
}

// ============================================
// Renderizar tarjeta
// ============================================
function renderCard(data) {
    const { user, qr_code } = data;

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('digitalCard').style.display = 'block';

    document.title = `${user.full_name} - Tarjeta Digital`;

    // Header personalizado
    const headerSection = document.querySelector('.card-header-section');
    if (user.header_url) {
        headerSection.style.background = `url('${user.header_url}') center/cover no-repeat`;
    }

    // Foto
    const photoEl = document.getElementById('employeePhoto');
    if (user.photo_url) {
        photoEl.src = user.photo_url;
    } else {
        const initials = user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        photoEl.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130"><rect fill="%231e293b" width="130" height="130" rx="65"/><text fill="%2394a3b8" x="65" y="72" text-anchor="middle" font-size="42" font-family="Inter,sans-serif">${initials}</text></svg>`;
    }

    // QR
    document.getElementById('qrCode').src = qr_code;

    // Info
    document.getElementById('employeeName').textContent = user.full_name;
    document.getElementById('employeePosition').textContent = user.position || '';

    // RUT
    const rutEl = document.getElementById('employeeRut');
    if (user.rut) {
        rutEl.textContent = `RUT: ${user.rut}`;
        rutEl.style.display = 'block';
    } else {
        rutEl.style.display = 'none';
    }
}

// ============================================
// Renderizar botones circulares de contacto
// ============================================
function renderContactButtons(user) {
    const container = document.getElementById('contactButtonsRow');
    const buttons = [];

    // Botón Llamar
    if (user.phone) {
        buttons.push(`
      <a href="tel:${user.phone}" class="contact-btn-circle">
        <div class="contact-btn-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <span>Llamar</span>
      </a>
    `);
    }

    // Botón WhatsApp
    if (user.phone) {
        const cleanPhone = user.phone.replace(/[^0-9+]/g, '');
        buttons.push(`
      <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" rel="noopener" class="contact-btn-circle">
        <div class="contact-btn-icon whatsapp">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <span>WhatsApp</span>
      </a>
    `);
    }

    // Botón Email
    if (user.email) {
        buttons.push(`
      <a href="mailto:${user.email}" class="contact-btn-circle">
        <div class="contact-btn-icon email">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <span>Email</span>
      </a>
    `);
    }

    container.innerHTML = buttons.join('');
}

// ============================================
// Cargar documentos
// ============================================
async function loadDocuments(userId) {
    try {
        const response = await fetch(`/api/documents?userId=${userId}`);
        if (!response.ok) throw new Error('Error al cargar documentos');

        const data = await response.json();

        if (data.documents && data.documents.length > 0) {
            renderDocuments(data.documents);
        }
    } catch (error) {
        console.error('Error al cargar documentos:', error);
    }
}

// ============================================
// Renderizar documentos
// ============================================
function renderDocuments(documents) {
    const section = document.getElementById('documentsSection');
    const list = document.getElementById('documentsList');
    section.style.display = 'block';

    list.innerHTML = documents.map(doc => {
        const readDate = doc.read_at ? new Date(doc.read_at).toLocaleString('es-CL') : null;
        // Solo el dueño puede marcar como leído (no admin ni visitante)
        const canCheck = isOwner && !doc.is_read;

        return `
      <div class="document-item">
        <input 
          type="checkbox" 
          class="document-checkbox" 
          id="doc-${doc.id}" 
          data-doc-id="${doc.id}" 
          data-doc-title="${doc.title}"
          ${doc.is_read ? 'checked disabled' : ''}
          ${!canCheck ? 'disabled' : ''}
          onchange="handleDocumentCheck(this)"
        >
        <div class="document-info">
          <div class="document-title">
            <a href="${doc.cloudinary_url}" target="_blank" rel="noopener noreferrer">
              ${doc.title}
            </a>
          </div>
          <div class="document-status ${doc.is_read ? 'read' : ''}">
            ${doc.is_read
                ? `Leido el ${readDate}`
                : (isOwner ? 'Pendiente de lectura' : 'Pendiente')
            }
          </div>
        </div>
      </div>
    `;
    }).join('');
}

// ============================================
// Manejar click en checkbox de documento
// ============================================
function handleDocumentCheck(checkbox) {
    checkbox.checked = false;

    const docId = checkbox.dataset.docId;
    const docTitle = checkbox.dataset.docTitle;

    pendingDocId = docId;
    document.getElementById('confirmDocName').textContent = `"${docTitle}"`;
    document.getElementById('confirmModal').classList.add('active');
}

// ============================================
// Confirmar lectura de documento
// ============================================
async function confirmDocumentRead() {
    if (!pendingDocId) return;

    try {
        const response = await fetch(`/api/documents/${pendingDocId}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al confirmar lectura');

        showToast('Lectura confirmada exitosamente', 'success');

        const checkbox = document.querySelector(`#doc-${pendingDocId}`);
        if (checkbox) {
            checkbox.checked = true;
            checkbox.disabled = true;

            const statusEl = checkbox.closest('.document-item').querySelector('.document-status');
            statusEl.className = 'document-status read';
            statusEl.textContent = `Leido el ${new Date().toLocaleString('es-CL')}`;
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        pendingDocId = null;
        document.getElementById('confirmModal').classList.remove('active');
    }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Coin flip
    document.getElementById('coinFlip').addEventListener('click', () => {
        document.getElementById('coinFlip').classList.toggle('flipped');
    });

    // Agregar contacto (descargar VCF)
    document.getElementById('addContactBtn').addEventListener('click', (e) => {
        e.preventDefault();
        downloadVCF();
    });

    // Compartir
    document.getElementById('shareBtn').addEventListener('click', (e) => {
        e.preventDefault();
        shareCard();
    });

    // Modal de confirmación
    document.getElementById('confirmAccept').addEventListener('click', confirmDocumentRead);
    document.getElementById('confirmCancel').addEventListener('click', () => {
        pendingDocId = null;
        document.getElementById('confirmModal').classList.remove('active');
    });
}

// ============================================
// Descargar VCF
// ============================================
async function downloadVCF() {
    if (!currentUser) return;

    try {
        const response = await fetch(`/api/users/${currentUser.id}/vcf`);
        if (!response.ok) throw new Error('Error al generar contacto');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUser.full_name.replace(/\s+/g, '_')}.vcf`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Contacto descargado', 'success');
    } catch (error) {
        showToast('Error al descargar contacto', 'error');
    }
}

// ============================================
// Compartir tarjeta
// ============================================
async function shareCard() {
    const shareData = {
        title: `${currentUser.full_name} - Tarjeta Digital`,
        text: `Tarjeta digital de ${currentUser.full_name}${currentUser.position ? ' - ' + currentUser.position : ''}`,
        url: cardUrl || window.location.href
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
        }
    }

    try {
        await navigator.clipboard.writeText(shareData.url);
        showToast('Enlace copiado al portapapeles', 'success');
    } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = shareData.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Enlace copiado al portapapeles', 'success');
    }
}

// ============================================
// Estados
// ============================================
function showError() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
}

// ============================================
// Toast
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
