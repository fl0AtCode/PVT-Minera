// Login - Tarjeta Digital

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    // Verificar si ya hay sesión activa
    checkSession();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showToast('Completa todos los campos', 'error');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Ingresando...';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al iniciar sesión');
            }

            showToast('¡Bienvenido!', 'success');

            // Redirigir según rol
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = '/dashboard.html';
                } else {
                    // Empleado va a su menú principal
                    window.location.href = '/employee.html';
                }
            }, 500);
        } catch (error) {
            showToast(error.message, 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        }
    });
});

// Verificar sesión activa
async function checkSession() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (data.user.role === 'admin') {
                window.location.href = '/dashboard.html';
            } else {
                window.location.href = '/employee.html';
            }
        }
    } catch (error) {
        // No hay sesión, mostrar login
    }
}

// Mostrar toast
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
    }, 3000);
}
