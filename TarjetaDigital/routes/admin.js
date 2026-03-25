// Rutas de administración
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/authMiddleware');
const { uploadBase64Image, deleteImage } = require('../services/cloudinaryService');
const { validateRut, formatRut } = require('../services/rutValidator');
const { exportToCSV } = require('../services/exportService');
const XLSX = require('xlsx');

// Para manejar body grandes (imágenes en base64)
router.use(express.json({ limit: '10mb' }));

// Aplicar middleware de admin a todas las rutas
router.use(requireAdmin);

// ============================================
// Etiquetas de riesgo para reportes
// ============================================
const RISK_LABELS = {
    'bajo_riesgo': 'Bajo Riesgo',
    'riesgo_medio': 'Riesgo Medio',
    'alto_riesgo': 'Alto Riesgo'
};

// GET /api/admin/employees - Listar empleados con estado de documentos
router.get('/employees', async (req, res) => {
    try {
        const [employees] = await pool.execute(
            'SELECT id, username, email, full_name, phone, position, rut, photo_url, header_url, created_at FROM users WHERE role = ? ORDER BY full_name ASC',
            ['employee']
        );

        const [documents] = await pool.execute('SELECT * FROM documents ORDER BY id ASC');
        const [reads] = await pool.execute('SELECT * FROM document_reads');

        // Obtener último test de fatiga de cada empleado (nuevo esquema)
        const [fatigueTests] = await pool.execute(
            `SELECT ft.* FROM fatigue_tests ft
             INNER JOIN (SELECT user_id, MAX(created_at) as max_date FROM fatigue_tests GROUP BY user_id) latest
             ON ft.user_id = latest.user_id AND ft.created_at = latest.max_date`
        );

        const employeesWithReads = employees.map(emp => ({
            ...emp,
            document_reads: reads.filter(r => r.user_id === emp.id),
            last_fatigue_test: fatigueTests.find(t => t.user_id === emp.id) || null
        }));

        res.json({ employees: employeesWithReads, documents });
    } catch (error) {
        console.error('Error al listar empleados:', error);
        res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
});

// GET /api/admin/employees/search - Buscar empleados
router.get('/employees/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Parámetro de búsqueda requerido.' });
        }

        const searchTerm = `%${q}%`;
        const [employees] = await pool.execute(
            `SELECT id, username, email, full_name, phone, position, rut, photo_url, header_url, created_at 
       FROM users 
       WHERE role = 'employee' 
         AND (full_name LIKE ? OR username LIKE ? OR email LIKE ? OR rut LIKE ? OR position LIKE ?)
       ORDER BY full_name ASC`,
            [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
        );

        const [documents] = await pool.execute('SELECT * FROM documents ORDER BY id ASC');
        const [reads] = await pool.execute('SELECT * FROM document_reads');

        // Obtener último test de fatiga de cada empleado (nuevo esquema)
        const [fatigueTests] = await pool.execute(
            `SELECT ft.* FROM fatigue_tests ft
             INNER JOIN (SELECT user_id, MAX(created_at) as max_date FROM fatigue_tests GROUP BY user_id) latest
             ON ft.user_id = latest.user_id AND ft.created_at = latest.max_date`
        );

        const employeesWithReads = employees.map(emp => ({
            ...emp,
            document_reads: reads.filter(r => r.user_id === emp.id),
            last_fatigue_test: fatigueTests.find(t => t.user_id === emp.id) || null
        }));

        res.json({ employees: employeesWithReads, documents });
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// GET /api/admin/employees/export - Exportar a CSV
router.get('/employees/export', async (req, res) => {
    try {
        const [employees] = await pool.execute(
            'SELECT id, username, email, full_name, phone, position, rut FROM users WHERE role = ? ORDER BY full_name ASC',
            ['employee']
        );

        const [documents] = await pool.execute('SELECT * FROM documents ORDER BY id ASC');
        const [reads] = await pool.execute('SELECT * FROM document_reads');

        const employeesWithReads = employees.map(emp => ({
            ...emp,
            document_reads: reads.filter(r => r.user_id === emp.id)
        }));

        const csv = exportToCSV(employeesWithReads, documents);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=empleados.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error al exportar:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// ============================================
// REPORTES PVT
// ============================================

// GET /api/admin/reports/daily - Reporte diario (Excel)
// Query params: date (YYYY-MM-DD)
router.get('/reports/daily', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Se requiere el parámetro date (YYYY-MM-DD).' });
        }

        // Obtener todos los tests del día seleccionado con datos del empleado
        const [tests] = await pool.execute(
            `SELECT ft.*, u.full_name, u.rut, u.position
             FROM fatigue_tests ft
             INNER JOIN users u ON ft.user_id = u.id
             WHERE DATE(ft.created_at) = ?
             ORDER BY ft.created_at ASC`,
            [date]
        );

        // Construir datos para Excel
        const rows = tests.map(test => ({
            'RUT': test.rut || '',
            'NOMBRE': test.full_name,
            'CARGO': test.position || '',
            'CONCLUSIÓN TEST': RISK_LABELS[test.risk_level] || test.risk_level,
            'RT PROMEDIO (ms)': test.avg_reaction_ms,
            'LAPSOS': test.lapses,
            'MICROSUEÑOS': test.microsleeps,
            'FECHA/HORA DEL TEST': new Date(test.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
        }));

        // Crear libro Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        // Ajustar ancho de columnas
        ws['!cols'] = [
            { wch: 14 },  // RUT
            { wch: 30 },  // NOMBRE
            { wch: 20 },  // CARGO
            { wch: 18 },  // CONCLUSIÓN TEST
            { wch: 18 },  // RT PROMEDIO
            { wch: 10 },  // LAPSOS
            { wch: 14 },  // MICROSUEÑOS
            { wch: 22 }   // FECHA/HORA
        ];

        // Aplicar colores a la columna de conclusión (columna D, índice 3)
        const dataStartRow = 2; // fila 1 es cabecera
        tests.forEach((test, index) => {
            const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + index - 1, c: 3 });
            if (!ws[cellRef]) return;

            let color;
            if (test.risk_level === 'bajo_riesgo') {
                color = '10B981'; // verde
            } else if (test.risk_level === 'riesgo_medio') {
                color = 'F59E0B'; // naranja
            } else {
                color = 'EF4444'; // rojo
            }

            ws[cellRef].s = {
                font: { bold: true, color: { rgb: color } }
            };
        });

        const dateFormatted = date.replace(/-/g, '');
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Diario');

        // Generar buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_Diario_PVT_${dateFormatted}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('Error al generar reporte diario:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// GET /api/admin/reports/weekly - Reporte semanal (Excel)
// Query params: week_start (YYYY-MM-DD, lunes de la semana)
router.get('/reports/weekly', async (req, res) => {
    try {
        const { week_start } = req.query;
        if (!week_start) {
            return res.status(400).json({ error: 'Se requiere el parámetro week_start (YYYY-MM-DD).' });
        }

        // Calcular fin de semana (domingo)
        const weekStartDate = new Date(week_start + 'T00:00:00');
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEnd = weekEndDate.toISOString().split('T')[0];

        // Obtener todos los empleados
        const [employees] = await pool.execute(
            `SELECT id, full_name, rut, position, created_at FROM users WHERE role = 'employee' ORDER BY full_name ASC`
        );

        // Obtener todos los tests de la semana
        const [weeklyTests] = await pool.execute(
            `SELECT ft.*, u.full_name, u.rut, u.position, u.created_at as user_created_at
             FROM fatigue_tests ft
             INNER JOIN users u ON ft.user_id = u.id
             WHERE DATE(ft.created_at) >= ? AND DATE(ft.created_at) <= ?
             ORDER BY u.full_name ASC, ft.created_at DESC`,
            [week_start, weekEnd]
        );

        // Obtener último test de cada empleado (de toda la vida, no solo de la semana)
        const [lastTests] = await pool.execute(
            `SELECT ft.* FROM fatigue_tests ft
             INNER JOIN (SELECT user_id, MAX(created_at) as max_date FROM fatigue_tests GROUP BY user_id) latest
             ON ft.user_id = latest.user_id AND ft.created_at = latest.max_date`
        );

        // Construir datos del reporte
        const rows = employees.map(emp => {
            // Tests de este empleado en la semana
            const empTests = weeklyTests.filter(t => t.user_id === emp.id);
            const totalTests = empTests.length;

            // Último test del empleado (de toda la vida)
            const lastTest = lastTests.find(t => t.user_id === emp.id);

            // Calcular porcentajes de riesgo de la semana
            const arCount = empTests.filter(t => t.risk_level === 'alto_riesgo').length;
            const rmCount = empTests.filter(t => t.risk_level === 'riesgo_medio').length;
            const brCount = empTests.filter(t => t.risk_level === 'bajo_riesgo').length;

            const arPercent = totalTests > 0 ? parseFloat(((arCount / totalTests) * 100).toFixed(1)) : 0;
            const rmPercent = totalTests > 0 ? parseFloat(((rmCount / totalTests) * 100).toFixed(1)) : 0;
            const brPercent = totalTests > 0 ? parseFloat(((brCount / totalTests) * 100).toFixed(1)) : 0;

            return {
                'RUT': emp.rut || '',
                'NOMBRE': emp.full_name,
                'CARGO': emp.position || '',
                'FECHA HORA ÚLTIMO TEST': lastTest
                    ? new Date(lastTest.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
                    : 'Sin test',
                'CONCLUSIÓN ÚLTIMO TEST': lastTest
                    ? RISK_LABELS[lastTest.risk_level] || lastTest.risk_level
                    : 'Sin test',
                'PERCEPCIÓN DEL RIESGO (AR%)': arPercent,
                'PERCEPCIÓN DEL RIESGO (RM%)': rmPercent,
                'PERCEPCIÓN DEL RIESGO (BR%)': brPercent,
                'TOTAL TEST REALIZADOS': totalTests,
                'FECHA DE ENROLAMIENTO': new Date(emp.created_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })
            };
        });

        // Crear libro Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        // Ajustar ancho de columnas
        ws['!cols'] = [
            { wch: 14 },  // RUT
            { wch: 30 },  // NOMBRE
            { wch: 20 },  // CARGO
            { wch: 22 },  // FECHA HORA ÚLTIMO TEST
            { wch: 22 },  // CONCLUSIÓN ÚLTIMO TEST
            { wch: 22 },  // AR%
            { wch: 22 },  // RM%
            { wch: 22 },  // BR%
            { wch: 20 },  // TOTAL TESTS
            { wch: 20 }   // FECHA ENROLAMIENTO
        ];

        // Aplicar colores a la columna de conclusión (columna E, índice 4)
        const dataStartRow = 2;
        rows.forEach((row, index) => {
            const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + index - 1, c: 4 });
            if (!ws[cellRef]) return;

            const lastTest = lastTests.find(t => t.user_id === employees[index].id);
            if (!lastTest) return;

            let color;
            if (lastTest.risk_level === 'bajo_riesgo') {
                color = '10B981';
            } else if (lastTest.risk_level === 'riesgo_medio') {
                color = 'F59E0B';
            } else {
                color = 'EF4444';
            }

            ws[cellRef].s = {
                font: { bold: true, color: { rgb: color } }
            };
        });

        const startFormatted = week_start.replace(/-/g, '');
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Semanal');

        // Generar buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_Semanal_PVT_${startFormatted}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('Error al generar reporte semanal:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// POST /api/admin/employees - Crear empleado (recibe JSON con base64)
router.post('/employees', async (req, res) => {
    try {
        const { username, password, full_name, email, phone, position, rut, photo_base64, header_base64 } = req.body;

        // Validaciones
        if (!username || !password || !full_name) {
            return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos.' });
        }

        // Validar RUT si se proporcionó
        if (rut) {
            if (!validateRut(rut)) {
                return res.status(400).json({ error: 'RUT inválido.' });
            }
        }

        // Verificar que no exista el username
        const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Ya existe un usuario con ese nombre de usuario.' });
        }

        // Subir foto de perfil a Cloudinary si se proporcionó
        let photoUrl = null;
        if (photo_base64) {
            photoUrl = await uploadBase64Image(photo_base64, 'tarjeta-digital/fotos');
        }

        // Subir header a Cloudinary si se proporcionó
        let headerUrl = null;
        if (header_base64) {
            headerUrl = await uploadBase64Image(header_base64, 'tarjeta-digital/headers');
        }

        // Hash de contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Formatear RUT
        const formattedRut = rut ? formatRut(rut) : null;

        // Insertar en BD
        const [result] = await pool.execute(
            `INSERT INTO users (username, password, full_name, email, phone, position, rut, photo_url, header_url, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'employee')`,
            [username, hashedPassword, full_name, email || null, phone || null, position || null, formattedRut, photoUrl, headerUrl]
        );

        res.status(201).json({
            message: 'Empleado creado exitosamente.',
            employee: {
                id: result.insertId,
                username,
                full_name,
                email,
                phone,
                position,
                rut: formattedRut,
                photo_url: photoUrl,
                header_url: headerUrl
            }
        });
    } catch (error) {
        console.error('Error al crear empleado:', error);
        res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
});

// PUT /api/admin/employees/:id - Editar empleado (recibe JSON con base64)
router.put('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, phone, position, rut, email, username, photo_base64, header_base64 } = req.body;

        // Verificar que exista
        const [existing] = await pool.execute('SELECT * FROM users WHERE id = ? AND role = ?', [id, 'employee']);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        // Validar RUT si se proporcionó
        if (rut && !validateRut(rut)) {
            return res.status(400).json({ error: 'RUT inválido.' });
        }

        // Subir nueva foto si se proporcionó como base64
        let photoUrl = existing[0].photo_url;
        if (photo_base64) {
            if (photoUrl) await deleteImage(photoUrl);
            photoUrl = await uploadBase64Image(photo_base64, 'tarjeta-digital/fotos');
        }

        // Subir nuevo header si se proporcionó como base64
        let headerUrl = existing[0].header_url;
        if (header_base64) {
            if (headerUrl) await deleteImage(headerUrl);
            headerUrl = await uploadBase64Image(header_base64, 'tarjeta-digital/headers');
        }

        const formattedRut = rut ? formatRut(rut) : existing[0].rut;

        await pool.execute(
            `UPDATE users SET full_name = ?, phone = ?, position = ?, rut = ?, photo_url = ?, header_url = ?, email = ?, username = ?
       WHERE id = ? AND role = 'employee'`,
            [
                full_name || existing[0].full_name,
                phone || existing[0].phone,
                position || existing[0].position,
                formattedRut,
                photoUrl,
                headerUrl,
                email || existing[0].email,
                username || existing[0].username,
                id
            ]
        );

        res.json({ message: 'Empleado actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar empleado:', error);
        res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
});

// DELETE /api/admin/employees/:id - Eliminar empleado
router.delete('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.execute('SELECT photo_url, header_url FROM users WHERE id = ? AND role = ?', [id, 'employee']);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        if (existing[0].photo_url) {
            await deleteImage(existing[0].photo_url);
        }
        if (existing[0].header_url) {
            await deleteImage(existing[0].header_url);
        }

        await pool.execute('DELETE FROM users WHERE id = ? AND role = ?', [id, 'employee']);

        res.json({ message: 'Empleado eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar empleado:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

module.exports = router;
