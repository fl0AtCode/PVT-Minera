// Servidor principal - Tarjeta Digital
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// ============================================
// Middleware
// ============================================

// Parsear JSON y formularios
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sesiones
app.use(session({
    secret: 'tarjeta-digital-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true
    }
}));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// Rutas API
// ============================================

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);

// ============================================
// Rutas de páginas
// ============================================

// Página principal (login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard admin
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Vista del empleado (menú principal)
app.get('/employee', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

// Tarjeta digital pública
app.get('/card', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'card.html'));
});

// ============================================
// Iniciar servidor
// ============================================

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
