// Servicio de validación de RUT chileno (Módulo 11)

/**
 * Valida un RUT chileno completo (8 dígitos + dígito verificador = 9 dígitos)
 * @param {string} rut - RUT sin puntos ni guión (solo 9 dígitos)
 * @returns {boolean} true si el RUT es válido
 */
function validateRut(rut) {
    // Limpiar cualquier carácter que no sea número o K
    const cleanRut = String(rut).replace(/[^0-9kK]/g, '');

    if (cleanRut.length !== 9) return false;

    const body = cleanRut.slice(0, -1);
    const expectedDv = cleanRut.slice(-1).toUpperCase();

    // Calcular dígito verificador con módulo 11
    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);
    let calculatedDv;

    if (remainder === 11) calculatedDv = '0';
    else if (remainder === 10) calculatedDv = 'K';
    else calculatedDv = String(remainder);

    return expectedDv === calculatedDv;
}

/**
 * Formatea un RUT: 123456789 → 12.345.678-9
 * @param {string} rut - RUT sin formato (9 dígitos)
 * @returns {string} RUT formateado
 */
function formatRut(rut) {
    const cleanRut = String(rut).replace(/[^0-9kK]/g, '');
    if (cleanRut.length !== 9) return rut;

    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    // Formatear con puntos: 12.345.678
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${formatted}-${dv}`;
}

/**
 * Limpia un RUT formateado: 12.345.678-9 → 123456789
 * @param {string} rut - RUT formateado
 * @returns {string} RUT sin formato
 */
function cleanRut(rut) {
    return String(rut).replace(/[^0-9kK]/g, '');
}

module.exports = { validateRut, formatRut, cleanRut };
