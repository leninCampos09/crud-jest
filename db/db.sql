-- Script para crear la base de datos y la tabla `usuarios`
CREATE DATABASE IF NOT EXISTS tarea_poo;
USE tarea_poo;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para productos con imagen (ruta almacenada)
CREATE TABLE IF NOT EXISTS productos (
  idProducto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  precio DECIMAL(8,4) NOT NULL,
  imagen VARCHAR(200) NULL,
  descripcion VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
