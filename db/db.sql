-- Script para crear la base de datos y la tabla `usuarios`
CREATE DATABASE IF NOT EXISTS tarea_poo;
USE tarea_poo;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
