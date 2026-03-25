// Servicio de exportación a CSV

/**
 * Genera contenido CSV a partir de datos de empleados con estado de documentos
 * @param {Array} employees - Array de objetos con datos de empleados
 * @param {Array} documents - Array de documentos disponibles
 * @returns {string} Contenido CSV
 */
function exportToCSV(employees, documents) {
    // Cabeceras
    const docHeaders = documents.map(d => `Doc: ${d.title}`);
    const headers = ['Nombre', 'Usuario', 'Email', 'Teléfono', 'Cargo', 'RUT', ...docHeaders];

    // Filas
    const rows = employees.map(emp => {
        const docStatuses = documents.map(doc => {
            const read = emp.document_reads?.find(r => r.document_id === doc.id);
            return read ? `Leído (${new Date(read.read_at).toLocaleString('es-CL')})` : 'No leído';
        });
        return [
            emp.full_name,
            emp.username || '',
            emp.email,
            emp.phone || '',
            emp.position || '',
            emp.rut || '',
            ...docStatuses
        ];
    });

    // Escapar campos para CSV
    const escapeField = (field) => {
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvLines = [
        headers.map(escapeField).join(','),
        ...rows.map(row => row.map(escapeField).join(','))
    ];

    // BOM para que Excel reconozca UTF-8
    return '\uFEFF' + csvLines.join('\n');
}

module.exports = { exportToCSV };
