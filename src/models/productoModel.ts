import pool from "../config/db";

export interface Producto {
  idProducto?: number;
  nombre: string;
  precio: number;
  imagen?: string | null;
  descripcion?: string | null;
}

export const getAll = async (): Promise<Producto[]> => {
  const [rows] = await pool.query(
    "SELECT idProducto, nombre, precio, imagen, descripcion FROM productos",
  );
  return rows as Producto[];
};

export const create = async (p: Producto): Promise<number> => {
  const [result] = await pool.query(
    "INSERT INTO productos (nombre, precio, imagen, descripcion) VALUES (?, ?, ?, ?)",
    [p.nombre, p.precio, p.imagen, p.descripcion],
  );
  // @ts-ignore
  return (result as any).insertId as number;
};

export const remove = async (id: number): Promise<boolean> => {
  const [result] = await pool.query(
    "DELETE FROM productos WHERE idProducto = ?",
    [id],
  );
  // @ts-ignore
  return (result as any).affectedRows > 0;
};

export const getById = async (id: number): Promise<Producto | null> => {
  const [rows] = await pool.query(
    "SELECT idProducto, nombre, precio, imagen, descripcion FROM productos WHERE idProducto = ?",
    [id],
  );
  const res = (rows as any[]) || [];
  return res.length ? (res[0] as Producto) : null;
};

export const update = async (
  id: number,
  p: Partial<Producto>,
): Promise<boolean> => {
  // Fetch existing to fill missing values
  const existing = await getById(id);
  if (!existing) return false;
  const nombre = p.nombre ?? existing.nombre;
  const precio = p.precio ?? existing.precio;
  const imagen = p.imagen ?? existing.imagen ?? null;
  const descripcion = p.descripcion ?? existing.descripcion ?? null;

  const [result] = await pool.query(
    "UPDATE productos SET nombre = ?, precio = ?, imagen = ?, descripcion = ? WHERE idProducto = ?",
    [nombre, precio, imagen, descripcion, id],
  );
  // @ts-ignore
  return (result as any).affectedRows > 0;
};
