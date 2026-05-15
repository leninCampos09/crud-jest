import pool from "../config/db";

export interface Usuario {
  id?: number;
  nombre: string;
  email: string;
}

export const getAll = async (): Promise<Usuario[]> => {
  const [rows] = await pool.query("SELECT id, nombre, email FROM usuarios");
  return rows as Usuario[];
};

export const getById = async (id: number): Promise<Usuario | null> => {
  const [rows] = await pool.query(
    "SELECT id, nombre, email FROM usuarios WHERE id = ?",
    [id],
  );
  const result = (rows as any[]) || [];
  return result.length ? (result[0] as Usuario) : null;
};

export const create = async (usuario: Usuario): Promise<number> => {
  const [result] = await pool.query(
    "INSERT INTO usuarios (nombre, email) VALUES (?, ?)",
    [usuario.nombre, usuario.email],
  );
  // @ts-ignore
  return (result as any).insertId as number;
};

export const update = async (
  id: number,
  usuario: Partial<Usuario>,
): Promise<boolean> => {
  const [result] = await pool.query(
    "UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?",
    [usuario.nombre, usuario.email, id],
  );
  // @ts-ignore
  return (result as any).affectedRows > 0;
};

export const remove = async (id: number): Promise<boolean> => {
  const [result] = await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
  // @ts-ignore
  return (result as any).affectedRows > 0;
};
