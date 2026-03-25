// Servicio de generación de archivos VCF (vCard)

/**
 * Genera un string VCF con los datos del empleado
 * @param {Object} user - Datos del usuario
 * @param {string} user.full_name - Nombre completo
 * @param {string} user.phone - Teléfono
 * @param {string} user.position - Cargo
 * @param {string} user.email - Email
 * @param {string} user.photo_url - URL de la foto
 * @returns {string} Contenido del archivo VCF
 */
function generateVCF(user) {
    // Separar nombre y apellido (asume "Nombre Apellido")
    const nameParts = user.full_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const companyName = 'Nombre empresa (test)';

    const vcf = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${user.full_name}`,
        `N:${lastName};${firstName};;;`,
        `ORG:${companyName}`,
        `TITLE:${user.position || ''}`,
        `TEL;TYPE=CELL:${user.phone || ''}`,
        `EMAIL:${user.email || ''}`,
        user.photo_url ? `PHOTO;VALUE=URI:${user.photo_url}` : '',
        'END:VCARD'
    ].filter(line => line !== '').join('\r\n');

    return vcf;
}

module.exports = { generateVCF };
