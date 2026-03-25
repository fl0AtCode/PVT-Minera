-- ============================================
-- MIGRACIÓN: Overhaul del Test PVT
-- Ejecutar en phpMyAdmin de Hostinger
-- Base de datos: u413558808_PruebaTarjetas
-- ============================================

-- 1. Eliminar tabla vieja de tests de fatiga
DROP TABLE IF EXISTS fatigue_tests;

-- 2. Crear tabla de tests de fatiga (nuevo esquema con métricas reales)
CREATE TABLE IF NOT EXISTS fatigue_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_stimuli INT NOT NULL,
  lapses INT NOT NULL DEFAULT 0,
  microsleeps INT NOT NULL DEFAULT 0,
  `false_starts` INT NOT NULL DEFAULT 0,
  avg_reaction_ms INT NOT NULL,
  min_reaction_ms INT DEFAULT NULL,
  max_reaction_ms INT DEFAULT NULL,
  risk_level ENUM('bajo_riesgo','riesgo_medio','alto_riesgo') NOT NULL,
  time_window_seconds INT NOT NULL DEFAULT 180,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Crear tabla de reacciones individuales
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

-- 4. Índices para rendimiento en reportes
CREATE INDEX idx_fatigue_tests_user_date ON fatigue_tests (user_id, created_at);
CREATE INDEX idx_fatigue_tests_created ON fatigue_tests (created_at);
CREATE INDEX idx_fatigue_reactions_test ON fatigue_reactions (test_id);
