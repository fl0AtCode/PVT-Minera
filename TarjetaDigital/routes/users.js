// Rutas de usuarios (públicas y de perfil)
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/authMiddleware');
const { generateQR, getCardUrl } = require('../services/qrService');
const { generateVCF } = require('../services/vcfService');

// ============================================
// Umbrales PVT (estándar minería chilena)
// ============================================
const PVT_THRESHOLDS = {
    LAPSE_MS: 500,        // RT > 500ms = lapso
    MICROSLEEP_MS: 3000,  // RT > 3000ms = microsueño
    FALSE_START_MS: 100   // RT < 100ms = falsa alarma (anticipación)
};

/**
 * Clasificar nivel de riesgo según umbrales de minería chilena
 * Bajo Riesgo (BR):   0-1 lapsos Y 0 microsueños
 * Riesgo Medio (RM):  2-4 lapsos O avg RT > 350ms (máx 1 microsueño)
 * Alto Riesgo (AR):   5+ lapsos O 2+ microsueños O avg RT > 500ms
 */
function classifyRisk(lapses, microsleeps, avgReactionMs) {
    if (lapses >= 5 || microsleeps >= 2 || avgReactionMs > 500) {
        return 'alto_riesgo';
    }
    if (lapses <= 1 && microsleeps === 0) {
        return 'bajo_riesgo';
    }
    return 'riesgo_medio';
}

// ============================================
// RUTAS ESPECÍFICAS (antes de /:id para evitar conflicto)
// ============================================

// PUT /api/users/profile - Empleado edita su propio perfil
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { phone, position } = req.body;

        const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        await pool.execute(
            'UPDATE users SET phone = ?, position = ? WHERE id = ?',
            [phone || existing[0].phone, position || existing[0].position, userId]
        );

        res.json({ message: 'Perfil actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// GET /api/users/fatigue-status - Obtener último test del usuario logueado
router.get('/fatigue-status', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [tests] = await pool.execute(
            'SELECT * FROM fatigue_tests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (tests.length === 0) {
            return res.json({ has_test: false });
        }

        res.json({
            has_test: true,
            last_test: tests[0]
        });
    } catch (error) {
        console.error('Error al obtener estado de fatiga:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// GET /api/users/test-availability - Verificar si el test está disponible
// Bloqueado: domingo 22:00 a lunes 07:00 (hora Chile)
router.get('/test-availability', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const chileTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
        const dayOfWeek = chileTime.getDay();
        const hour = chileTime.getHours();

        let isBlocked = false;
        let message = '';

        if (dayOfWeek === 0 && hour >= 22) {
            isBlocked = true;
            message = 'El test no está disponible los domingos después de las 22:00 hrs. Podrás realizarlo a partir de las 07:00 hrs del lunes.';
        }

        if (dayOfWeek === 1 && hour < 7) {
            isBlocked = true;
            message = 'El test no está disponible hasta las 07:00 hrs del lunes.';
        }

        res.json({
            available: !isBlocked,
            message: isBlocked ? message : 'Test disponible.',
            server_time: chileTime.toISOString()
        });
    } catch (error) {
        console.error('Error al verificar disponibilidad:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// POST /api/users/fatigue-test - Guardar resultado del test PVT
router.post('/fatigue-test', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { reactions, time_window_seconds } = req.body;

        if (!reactions || !Array.isArray(reactions) || reactions.length === 0) {
            return res.status(400).json({ error: 'Datos del test incompletos. Se requiere array de reacciones.' });
        }

        if (!time_window_seconds) {
            return res.status(400).json({ error: 'Se requiere la duración del test.' });
        }

        let lapses = 0;
        let microsleeps = 0;
        let falseStarts = 0;
        const validReactions = [];

        const processedReactions = reactions.map(r => {
            const rt = r.reaction_ms;
            const isLapse = rt !== null && rt > PVT_THRESHOLDS.LAPSE_MS;
            const isMicrosleep = rt !== null && rt > PVT_THRESHOLDS.MICROSLEEP_MS;
            const isFalseStart = rt !== null && rt < PVT_THRESHOLDS.FALSE_START_MS;

            if (isLapse) lapses++;
            if (isMicrosleep) microsleeps++;
            if (isFalseStart) falseStarts++;

            if (rt !== null && !isFalseStart) {
                validReactions.push(rt);
            }

            return {
                stimulus_number: r.stimulus_number,
                reaction_ms: rt,
                is_lapse: isLapse ? 1 : 0,
                is_microsleep: isMicrosleep ? 1 : 0,
                is_false_start: isFalseStart ? 1 : 0
            };
        });

        const avgReactionMs = validReactions.length > 0
            ? Math.round(validReactions.reduce((a, b) => a + b, 0) / validReactions.length)
            : 0;
        const minReactionMs = validReactions.length > 0
            ? Math.min(...validReactions)
            : null;
        const maxReactionMs = validReactions.length > 0
            ? Math.max(...validReactions)
            : null;

        const riskLevel = classifyRisk(lapses, microsleeps, avgReactionMs);

        const [testResult] = await pool.execute(
            `INSERT INTO fatigue_tests 
             (user_id, total_stimuli, lapses, microsleeps, \`false_starts\`, avg_reaction_ms, min_reaction_ms, max_reaction_ms, risk_level, time_window_seconds) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, reactions.length, lapses, microsleeps, falseStarts, avgReactionMs, minReactionMs, maxReactionMs, riskLevel, time_window_seconds]
        );

        const testId = testResult.insertId;

        for (const reaction of processedReactions) {
            await pool.execute(
                `INSERT INTO fatigue_reactions (test_id, stimulus_number, reaction_ms, is_lapse, is_microsleep, is_false_start)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [testId, reaction.stimulus_number, reaction.reaction_ms, reaction.is_lapse, reaction.is_microsleep, reaction.is_false_start]
            );
        }

        res.json({
            message: 'Test PVT registrado exitosamente.',
            result: {
                total_stimuli: reactions.length,
                lapses,
                microsleeps,
                false_starts: falseStarts,
                avg_reaction_ms: avgReactionMs,
                min_reaction_ms: minReactionMs,
                max_reaction_ms: maxReactionMs,
                risk_level: riskLevel,
                time_window_seconds
            }
        });
    } catch (error) {
        console.error('Error al guardar test PVT:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// ============================================
// RUTAS CON PARÁMETRO /:id (al final para evitar conflicto)
// ============================================

// GET /api/users/:id - Datos públicos del empleado (para la tarjeta digital)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.execute(
            'SELECT id, full_name, phone, position, rut, photo_url, header_url, email FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const user = users[0];

        const qrCode = await generateQR(user.id);
        const cardUrl = getCardUrl(user.id);

        res.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                position: user.position,
                rut: user.rut,
                photo_url: user.photo_url,
                header_url: user.header_url,
                email: user.email
            },
            qr_code: qrCode,
            card_url: cardUrl
        });
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// GET /api/users/:id/vcf - Descargar VCF del empleado
router.get('/:id/vcf', async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.execute(
            'SELECT full_name, phone, position, email, photo_url FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const vcfContent = generateVCF(users[0]);

        res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${users[0].full_name.replace(/\s+/g, '_')}.vcf`);
        res.send(vcfContent);
    } catch (error) {
        console.error('Error al generar VCF:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

module.exports = router;
