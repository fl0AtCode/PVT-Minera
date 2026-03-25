// Servicio de Cloudinary - Subida de imágenes
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

/**
 * Sube una imagen a Cloudinary desde un buffer (Multer)
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} folder - Carpeta destino en Cloudinary
 * @param {Object} options - Opciones adicionales de transformación
 * @returns {Promise<string>} URL de la imagen subida
 */
async function uploadImage(fileBuffer, folder = 'tarjeta-digital/fotos', options = {}) {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: folder,
            resource_type: 'image',
            ...options
        };

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        const readable = new Readable();
        readable.push(fileBuffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
}

/**
 * Sube una imagen desde base64 a Cloudinary
 * @param {string} base64Data - Data URL en base64 (data:image/jpeg;base64,...)
 * @param {string} folder - Carpeta destino en Cloudinary
 * @returns {Promise<string>} URL de la imagen subida
 */
async function uploadBase64Image(base64Data, folder = 'tarjeta-digital/fotos') {
    try {
        const result = await cloudinary.uploader.upload(base64Data, {
            folder: folder,
            resource_type: 'image'
        });
        return result.secure_url;
    } catch (error) {
        console.error('Error al subir imagen base64:', error);
        throw error;
    }
}

/**
 * Elimina una imagen de Cloudinary por su URL
 * @param {string} url - URL de la imagen
 */
async function deleteImage(url) {
    try {
        // Extraer public_id de la URL
        const parts = url.split('/');
        const folderAndFile = parts.slice(parts.indexOf('tarjeta-digital')).join('/');
        const publicId = folderAndFile.replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Error al eliminar imagen de Cloudinary:', error);
    }
}

module.exports = { uploadImage, uploadBase64Image, deleteImage };
