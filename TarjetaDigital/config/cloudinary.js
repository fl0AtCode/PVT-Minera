// Configuración de Cloudinary - Hardcodeado
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dfczxcczj',
    api_key: '276461757631327',
    api_secret: '3nS_RmR0z9IYZbOjh8MEzVwMOWw'
});

module.exports = cloudinary;
