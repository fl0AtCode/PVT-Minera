-- ============================================
-- ESQUEMA SQL - Tarjeta Digital
-- Ejecutar en phpMyAdmin de Hostinger
-- Base de datos: u413558808_PruebaTarjetas
-- ============================================

-- Tabla de usuarios (admin y empleados)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  position VARCHAR(255) DEFAULT NULL,
  rut VARCHAR(12) DEFAULT NULL,
  photo_url VARCHAR(500) DEFAULT NULL,
  role ENUM('admin', 'employee') DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de documentos PDF
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  cloudinary_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de confirmaciones de lectura (irreversible)
CREATE TABLE IF NOT EXISTS document_reads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  document_id INT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE KEY unique_read (user_id, document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Crear usuario administrador
-- Usuario: admin | Contraseña: Test123!
INSERT INTO users (username, password, full_name, role) VALUES (
  'admin',
  '$2b$10$svhCxxeP/RWcThGKLcLY/uIjICukQ8tJwoH5hJj8QqwU1StgvYvnO',
  'Administrador',
  'admin'
);

-- Tabla de tests de fatiga PVT (nuevo esquema con métricas reales)
CREATE TABLE IF NOT EXISTS fatigue_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_stimuli INT NOT NULL COMMENT 'Cantidad total de estímulos mostrados',
  lapses INT NOT NULL DEFAULT 0 COMMENT 'Reacciones > 500ms',
  microsleeps INT NOT NULL DEFAULT 0 COMMENT 'Reacciones > 3000ms',
  false_starts INT NOT NULL DEFAULT 0 COMMENT 'Reacciones < 100ms',
  avg_reaction_ms INT NOT NULL COMMENT 'Promedio de tiempo de reacción en ms',
  min_reaction_ms INT DEFAULT NULL,
  max_reaction_ms INT DEFAULT NULL,
  risk_level ENUM('bajo_riesgo','riesgo_medio','alto_riesgo') NOT NULL,
  time_window_seconds INT NOT NULL DEFAULT 180,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de reacciones individuales PVT
CREATE TABLE IF NOT EXISTS fatigue_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  test_id INT NOT NULL,
  stimulus_number INT NOT NULL,
  reaction_ms INT DEFAULT NULL,
  is_lapse TINYINT(1) NOT NULL DEFAULT 0,
  is_microsleep TINYINT(1) NOT NULL DEFAULT 0,
  is_false_start TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (test_id) REFERENCES fatigue_tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar los 2 documentos PDF
INSERT INTO documents (title, cloudinary_url) VALUES
  ('Difusión PLANESI', 'https://res.cloudinary.com/dfczxcczj/image/upload/Presentacion_Planesi_w6vfkt.pdf'),
  ('Protocolo de Vigilancia - Exposición a Sílice', 'https://res.cloudinary.com/dfczxcczj/image/upload/Protocolo_de_vigilancia_del_ambiente_de_trabajo_y_de_la_salud_de_los_trabajadores_con_exposici%C3%B3n_a_silice_mvlkku.pdf');
