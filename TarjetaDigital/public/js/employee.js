// Employee Portal - Test PVT de Fatiga (3 minutos)
// ============================================

// Configuración del test PVT (estándar minería chilena)
const PVT_CONFIG = {
    timeWindowSeconds: 180,       // 3 minutos
    minIntervalMs: 2000,          // Intervalo mínimo entre estímulos (2s)
    maxIntervalMs: 10000,         // Intervalo máximo entre estímulos (10s)
    stimulusTimeoutMs: 3500,      // Tiempo máximo para reaccionar antes de registrar como no-reacción
    targetSizePx: 70              // Tamaño del botón rojo
};

// Umbrales PVT
const PVT_THRESHOLDS = {
    LAPSE_MS: 500,
    MICROSLEEP_MS: 3000,
    FALSE_START_MS: 100
};

let currentUser = null;
let pvtState = {
    reactions: [],           // Array de reacciones: {stimulus_number, reaction_ms}
    stimulusCount: 0,        // Número de estímulos mostrados
    timeRemaining: PVT_CONFIG.timeWindowSeconds,
    isRunning: false,
    stimulusVisible: false,  // Si el estímulo está visible
    stimulusShownAt: null,   // Timestamp cuando se mostró el estímulo
    mainTimer: null,
    stimulusTimer: null,
    countdownInterval: null,
    nextStimulusTimeout: null,
    currentTarget: null
};

document.addEventListener('DOMContentLoaded', () => {
    checkEmployeeSession();
    setupEmployeeListeners();
});

// ============================================
// Verificar sesión del empleado
// ============================================
async function checkEmployeeSession() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
        const data = await response.json();
        currentUser = data.user;

        // Si es admin, redirigir al dashboard
        if (currentUser.role === 'admin') {
            window.location.href = '/dashboard.html';
            return;
        }

        document.getElementById('employeeGreeting').textContent = `Hola, ${currentUser.full_name}`;
        loadFatigueStatus();
    } catch (error) {
        window.location.href = '/';
    }
}

// ============================================
// Cargar estado de fatiga
// ============================================
async function loadFatigueStatus() {
    try {
        const response = await fetch('/api/users/fatigue-status');
        if (!response.ok) return;

        const data = await response.json();
        if (!data.has_test) return;

        const test = data.last_test;
        const card = document.getElementById('fatigueStatusCard');
        const badge = document.getElementById('fatigueBadge');
        const detail = document.getElementById('fatigueDetail');
        const dateEl = document.getElementById('fatigueDate');

        // Mostrar fecha del último test
        const testDate = new Date(test.created_at);
        dateEl.textContent = testDate.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Configurar badge según nivel de riesgo
        const riskLabels = {
            'bajo_riesgo': 'Bajo Riesgo',
            'riesgo_medio': 'Riesgo Medio',
            'alto_riesgo': 'Alto Riesgo'
        };

        badge.textContent = riskLabels[test.risk_level] || test.risk_level;
        badge.className = `fatigue-badge risk-${test.risk_level}`;

        detail.textContent = `RT promedio: ${test.avg_reaction_ms}ms · ${test.lapses} lapso${test.lapses !== 1 ? 's' : ''}`;

        card.style.display = 'block';
    } catch (error) {
        console.error('Error al cargar estado de fatiga:', error);
    }
}

// ============================================
// Event Listeners
// ============================================
function setupEmployeeListeners() {
    // Ver tarjeta digital
    document.getElementById('viewCardBtn').addEventListener('click', () => {
        if (currentUser) {
            window.location.href = `/card.html?id=${currentUser.id}`;
        }
    });

    // Iniciar test PVT
    document.getElementById('startTestBtn').addEventListener('click', async () => {
        // Verificar disponibilidad
        try {
            const response = await fetch('/api/users/test-availability');
            const data = await response.json();

            if (!data.available) {
                showToast(data.message, 'warning');
                return;
            }

            showPVTView();
        } catch (error) {
            showToast('Error al verificar disponibilidad del test', 'error');
        }
    });

    // Botón volver del PVT
    document.getElementById('pvtBackBtn').addEventListener('click', () => {
        if (pvtState.isRunning) {
            if (!confirm('¿Seguro que quieres abandonar el test? Se perderá el progreso.')) return;
            stopPVT();
        }
        hidePVTView();
    });

    // Botón comenzar test
    document.getElementById('pvtStartBtn').addEventListener('click', () => {
        startPVT();
    });

    // Botón aceptar resultado
    document.getElementById('resultAcceptBtn').addEventListener('click', () => {
        document.getElementById('pvtResultModal').classList.remove('active');
        hidePVTView();
        loadFatigueStatus();
    });

    // Detectar clics anticipados (falsa alarma) en el arena cuando no hay estímulo
    document.getElementById('pvtArenaBorder').addEventListener('click', (e) => {
        if (!pvtState.isRunning || pvtState.stimulusVisible) return;
        if (e.target.id === 'pvtArenaBorder' || e.target.closest('.pvt-arena-border')) {
            // Clic anticipado - falsa alarma
            registerFalseStart();
        }
    });

    // Logout
    document.getElementById('logoutBtnEmployee').addEventListener('click', logout);
}

// ============================================
// Navegación entre vistas
// ============================================
function showPVTView() {
    document.getElementById('employeeMenu').style.display = 'none';
    document.getElementById('pvtView').style.display = 'flex';

    // Resetear estado visual
    document.getElementById('pvtInstructions').style.display = 'flex';
    document.getElementById('pvtArena').style.display = 'none';
    updateTimerDisplay(PVT_CONFIG.timeWindowSeconds);
    document.getElementById('pvtScore').textContent = '0 estímulos';
    document.getElementById('pvtLapses').textContent = '0 lapsos';
}

function hidePVTView() {
    document.getElementById('pvtView').style.display = 'none';
    document.getElementById('employeeMenu').style.display = 'flex';
}

// ============================================
// Formatear tiempo en MM:SS
// ============================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay(seconds) {
    document.getElementById('pvtTimer').textContent = formatTime(seconds);
}

// ============================================
// Motor del Test PVT (3 minutos)
// ============================================
function startPVT() {
    // Resetear estado
    pvtState = {
        reactions: [],
        stimulusCount: 0,
        timeRemaining: PVT_CONFIG.timeWindowSeconds,
        isRunning: true,
        stimulusVisible: false,
        stimulusShownAt: null,
        mainTimer: null,
        stimulusTimer: null,
        countdownInterval: null,
        nextStimulusTimeout: null,
        currentTarget: null
    };

    // Mostrar arena, ocultar instrucciones
    document.getElementById('pvtInstructions').style.display = 'none';
    document.getElementById('pvtArena').style.display = 'flex';
    updateTimerDisplay(PVT_CONFIG.timeWindowSeconds);
    document.getElementById('pvtScore').textContent = '0 estímulos';
    document.getElementById('pvtLapses').textContent = '0 lapsos';

    // Limpiar arena
    const arena = document.getElementById('pvtArenaBorder');
    arena.innerHTML = '';

    // Iniciar cuenta regresiva
    pvtState.countdownInterval = setInterval(() => {
        pvtState.timeRemaining--;
        updateTimerDisplay(pvtState.timeRemaining);

        if (pvtState.timeRemaining <= 10) {
            document.getElementById('pvtTimer').classList.add('pvt-timer-warning');
        }
    }, 1000);

    // Temporizador principal: fin del test
    pvtState.mainTimer = setTimeout(() => {
        finishPVT();
    }, PVT_CONFIG.timeWindowSeconds * 1000);

    // Programar primer estímulo
    scheduleNextStimulus();
}

function scheduleNextStimulus() {
    if (!pvtState.isRunning) return;

    // Intervalo aleatorio entre min y max
    const delay = PVT_CONFIG.minIntervalMs +
        Math.random() * (PVT_CONFIG.maxIntervalMs - PVT_CONFIG.minIntervalMs);

    pvtState.nextStimulusTimeout = setTimeout(() => {
        if (pvtState.isRunning) {
            showStimulus();
        }
    }, delay);
}

function showStimulus() {
    if (!pvtState.isRunning) return;

    pvtState.stimulusCount++;
    pvtState.stimulusVisible = true;
    pvtState.stimulusShownAt = performance.now();

    const arena = document.getElementById('pvtArenaBorder');
    const arenaRect = arena.getBoundingClientRect();

    // Calcular posición aleatoria dentro del arena
    const padding = 10;
    const maxX = arenaRect.width - PVT_CONFIG.targetSizePx - padding * 2;
    const maxY = arenaRect.height - PVT_CONFIG.targetSizePx - padding * 2;

    const randomX = padding + Math.random() * Math.max(0, maxX);
    const randomY = padding + Math.random() * Math.max(0, maxY);

    // Crear botón target
    const target = document.createElement('button');
    target.className = 'pvt-target';
    target.innerHTML = '✕';
    target.style.left = `${randomX}px`;
    target.style.top = `${randomY}px`;
    target.style.width = `${PVT_CONFIG.targetSizePx}px`;
    target.style.height = `${PVT_CONFIG.targetSizePx}px`;
    pvtState.currentTarget = target;

    // Click handler - registrar reacción
    target.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!pvtState.stimulusVisible) return;

        const reactionMs = Math.round(performance.now() - pvtState.stimulusShownAt);
        registerReaction(reactionMs);

        // Efecto visual
        target.classList.add('pvt-target-hit');
        setTimeout(() => target.remove(), 200);

        pvtState.stimulusVisible = false;
        pvtState.currentTarget = null;

        // Cancelar timeout de desaparición
        clearTimeout(pvtState.stimulusTimer);

        // Programar siguiente
        scheduleNextStimulus();
    });

    arena.appendChild(target);

    // Si no reacciona en el tiempo límite, registrar como no-reacción
    pvtState.stimulusTimer = setTimeout(() => {
        if (pvtState.stimulusVisible && pvtState.isRunning) {
            // Registrar como no-reacción (null)
            registerReaction(null);

            target.classList.add('pvt-target-missed');
            setTimeout(() => target.remove(), 300);

            pvtState.stimulusVisible = false;
            pvtState.currentTarget = null;

            // Programar siguiente
            scheduleNextStimulus();
        }
    }, PVT_CONFIG.stimulusTimeoutMs);

    // Actualizar contador
    document.getElementById('pvtScore').textContent = `${pvtState.stimulusCount} estímulos`;
}

function registerReaction(reactionMs) {
    const reaction = {
        stimulus_number: pvtState.stimulusCount,
        reaction_ms: reactionMs
    };

    pvtState.reactions.push(reaction);

    // Contar lapsos en tiempo real
    if (reactionMs !== null && reactionMs > PVT_THRESHOLDS.LAPSE_MS) {
        const lapseCount = pvtState.reactions.filter(
            r => r.reaction_ms !== null && r.reaction_ms > PVT_THRESHOLDS.LAPSE_MS
        ).length;
        document.getElementById('pvtLapses').textContent = `${lapseCount} lapso${lapseCount !== 1 ? 's' : ''}`;
    }
}

function registerFalseStart() {
    // Registrar clic anticipado
    pvtState.stimulusCount++;
    pvtState.reactions.push({
        stimulus_number: pvtState.stimulusCount,
        reaction_ms: 50  // RT muy bajo indica falsa alarma
    });

    // Efecto visual de error
    const arena = document.getElementById('pvtArenaBorder');
    arena.classList.add('pvt-false-start');
    setTimeout(() => arena.classList.remove('pvt-false-start'), 300);

    document.getElementById('pvtScore').textContent = `${pvtState.stimulusCount} estímulos`;
}

function stopPVT() {
    pvtState.isRunning = false;
    pvtState.stimulusVisible = false;
    clearTimeout(pvtState.mainTimer);
    clearTimeout(pvtState.stimulusTimer);
    clearTimeout(pvtState.nextStimulusTimeout);
    clearInterval(pvtState.countdownInterval);
    document.getElementById('pvtTimer').classList.remove('pvt-timer-warning');

    const arena = document.getElementById('pvtArenaBorder');
    arena.innerHTML = '';
}

async function finishPVT() {
    stopPVT();

    // Verificar que haya al menos 1 reacción
    if (pvtState.reactions.length === 0) {
        showToast('No se registraron reacciones. El test no fue guardado.', 'warning');
        return;
    }

    // Enviar resultado al backend
    try {
        const response = await fetch('/api/users/fatigue-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reactions: pvtState.reactions,
                time_window_seconds: PVT_CONFIG.timeWindowSeconds
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Error al guardar test', 'error');
            return;
        }

        showResults(data.result);
    } catch (error) {
        console.error('Error al enviar resultado:', error);
        showToast('Error de conexión', 'error');
    }
}

// ============================================
// Mostrar resultados
// ============================================
function showResults(result) {
    const modal = document.getElementById('pvtResultModal');
    const icon = document.getElementById('resultIcon');
    const description = document.getElementById('resultDescription');
    const badge = document.getElementById('resultBadge');
    const action = document.getElementById('resultAction');
    const metrics = document.getElementById('resultMetrics');

    const riskLabels = {
        'bajo_riesgo': 'Bajo Riesgo',
        'riesgo_medio': 'Riesgo Medio',
        'alto_riesgo': 'Alto Riesgo'
    };

    const levelLabel = riskLabels[result.risk_level] || result.risk_level;

    // Configurar según nivel de riesgo
    if (result.risk_level === 'bajo_riesgo') {
        icon.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        description.textContent = `Existen 3 niveles: Bajo Riesgo, Riesgo Medio y Alto Riesgo. Usted obtuvo ${levelLabel}, puede iniciar sus labores normalmente.`;
        action.textContent = '¡Buen trabajo! Estás en condiciones óptimas para operar.';
        badge.className = 'fatigue-badge fatigue-badge-lg risk-bajo_riesgo';
    } else if (result.risk_level === 'riesgo_medio') {
        icon.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        description.textContent = `Existen 3 niveles: Bajo Riesgo, Riesgo Medio y Alto Riesgo. Usted obtuvo ${levelLabel}, se recomienda realizar proceso de intervención y evaluarse nuevamente.`;
        action.textContent = 'Se recomienda tomar un descanso de 15-20 minutos, hidratarse y repetir el test.';
        badge.className = 'fatigue-badge fatigue-badge-lg risk-riesgo_medio';
    } else {
        icon.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        description.textContent = `Existen 3 niveles: Bajo Riesgo, Riesgo Medio y Alto Riesgo. Usted obtuvo ${levelLabel}, debe seguir las indicaciones de descanso obligatorio antes de retomar cualquier actividad.`;
        action.textContent = '⚠️ DETENCIÓN INMEDIATA. No puede operar maquinaria ni conducir hasta mejorar su condición.';
        badge.className = 'fatigue-badge fatigue-badge-lg risk-alto_riesgo';
    }

    badge.textContent = levelLabel;

    // Mostrar métricas detalladas
    metrics.innerHTML = `
        <div class="pvt-metrics-grid">
            <div class="pvt-metric">
                <span class="pvt-metric-value">${result.avg_reaction_ms} ms</span>
                <span class="pvt-metric-label">RT Promedio</span>
            </div>
            <div class="pvt-metric">
                <span class="pvt-metric-value">${result.lapses}</span>
                <span class="pvt-metric-label">Lapsos (>500ms)</span>
            </div>
            <div class="pvt-metric">
                <span class="pvt-metric-value">${result.microsleeps}</span>
                <span class="pvt-metric-label">Microsueños (>3s)</span>
            </div>
            <div class="pvt-metric">
                <span class="pvt-metric-value">${result.false_starts}</span>
                <span class="pvt-metric-label">Falsas alarmas</span>
            </div>
            <div class="pvt-metric">
                <span class="pvt-metric-value">${result.min_reaction_ms || '-'} ms</span>
                <span class="pvt-metric-label">RT Mínimo</span>
            </div>
            <div class="pvt-metric">
                <span class="pvt-metric-value">${result.total_stimuli}</span>
                <span class="pvt-metric-label">Total estímulos</span>
            </div>
        </div>
    `;

    // Mostrar modal
    modal.classList.add('active');
}

// ============================================
// Logout
// ============================================
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        window.location.href = '/';
    }
}

// ============================================
// Toast
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
