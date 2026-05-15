import { Request, Response } from "express";
import * as UsuarioModel from "../models/usuarioModel";

export const list = async (req: Request, res: Response) => {
  try {
    const usuarios = await UsuarioModel.getAll();
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

export const get = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const usuario = await UsuarioModel.getById(id);
    if (!usuario)
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre || !email)
      return res.status(400).json({ error: "Datos incompletos" });
    const id = await UsuarioModel.create({ nombre, email });
    res.status(201).json({ id, nombre, email });
  } catch (err: any) {
    console.error("create user error:", err);
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(400).json({ error: "Email ya existe" });
    res.status(500).json({ error: "Error al crear usuario" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { nombre, email } = req.body;
    const ok = await UsuarioModel.update(id, { nombre, email });
    if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ id, nombre, email });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
};

export const removeUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await UsuarioModel.remove(id);
    if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
};
