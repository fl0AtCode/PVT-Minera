// Rutas de documentos y confirmaciones de lectura
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/authMiddleware');

// GET /api/documents - Listar documentos (con estado de lectura del usuario actual si está autenticado)
router.get('/', async (req, res) => {
    try {
        const [documents] = await pool.execute('SELECT * FROM documents ORDER BY id ASC');

        // Si hay un userId en query (para la tarjeta pública), buscar sus lecturas
        const userId = req.query.userId || (req.session && req.session.user ? req.session.user.id : null);

        let reads = [];
        if (userId) {
            const [userReads] = await pool.execute(
                'SELECT * FROM document_reads WHERE user_id = ?',
                [userId]
            );
            reads = userReads;
        }

        const documentsWithStatus = documents.map(doc => ({
            ...doc,
            is_read: reads.some(r => r.document_id === doc.id),
            read_at: reads.find(r => r.document_id === doc.id)?.read_at || null
        }));

        res.json({ documents: documentsWithStatus });
    } catch (error) {
        console.error('Error al listar documentos:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// POST /api/documents/:id/read - Marcar documento como leído (IRREVERSIBLE)
router.post('/:id/read', requireAuth, async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.session.user.id;

        // Verificar que el documento existe
        const [docs] = await pool.execute('SELECT * FROM documents WHERE id = ?', [documentId]);
        if (docs.length === 0) {
            return res.status(404).json({ error: 'Documento no encontrado.' });
        }

        // Verificar si ya fue leído (el UNIQUE KEY también lo previene)
        const [existingRead] = await pool.execute(
            'SELECT * FROM document_reads WHERE user_id = ? AND document_id = ?',
            [userId, documentId]
        );

        if (existingRead.length > 0) {
            return res.status(400).json({ error: 'Este documento ya fue marcado como leído.' });
        }

        // Registrar lectura con timestamp
        await pool.execute(
            'INSERT INTO document_reads (user_id, document_id) VALUES (?, ?)',
            [userId, documentId]
        );

        res.json({
            message: 'Documento marcado como leído exitosamente.',
            read_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al marcar documento como leído:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// GET /api/documents/status/:userId - Estado de lectura por usuario (para admin)
router.get('/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [documents] = await pool.execute('SELECT * FROM documents ORDER BY id ASC');
        const [reads] = await pool.execute(
            'SELECT * FROM document_reads WHERE user_id = ?',
            [userId]
        );

        const status = documents.map(doc => ({
            ...doc,
            is_read: reads.some(r => r.document_id === doc.id),
            read_at: reads.find(r => r.document_id === doc.id)?.read_at || null
        }));

        res.json({ documents: status });
    } catch (error) {
        console.error('Error al obtener estado de documentos:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

module.exports = router;
