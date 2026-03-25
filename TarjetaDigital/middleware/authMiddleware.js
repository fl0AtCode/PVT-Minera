// Middleware de autenticación basado en sesiones

// Verifica que el usuario tenga sesión activa
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    }
    next();
}

// Verifica que el usuario sea administrador
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
}

module.exports = { requireAuth, requireAdmin };
