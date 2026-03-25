// Servicio de generación de código QR
const QRCode = require('qrcode');

// URL base del sitio
const BASE_URL = 'https://lightskyblue-turtle-331350.hostingersite.com';

/**
 * Genera un QR como Data URL (base64) que apunta al perfil del empleado
 * @param {number} userId - ID del usuario
 * @returns {Promise<string>} Data URL del QR en formato PNG
 */
async function generateQR(userId) {
    const url = `${BASE_URL}/card.html?id=${userId}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
            dark: '#1a1a2e',
            light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
    });
    return qrDataUrl;
}

/**
 * Retorna la URL pública de la tarjeta digital
 * @param {number} userId
 * @returns {string}
 */
function getCardUrl(userId) {
    return `${BASE_URL}/card.html?id=${userId}`;
}

module.exports = { generateQR, getCardUrl, BASE_URL };
