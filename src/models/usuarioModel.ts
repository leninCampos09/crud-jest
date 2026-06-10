import pool from "../config/db";

export interface Usuario {
  id?: number;
  nombre: string;
  email: string;
  avatar?: string | null;
}

let _columnCache: string[] | null = null;
const hasColumn = async (col: string) => {
  if (!_columnCache) {
    const [cols] = await pool.query("SHOW COLUMNS FROM usuarios");
    _columnCache = (cols as any[]).map((c) => c.Field);
  }
  return _columnCache.includes(col);
};

export const getAll = async (): Promise<Usuario[]> => {
  const useAvatar = await hasColumn("avatar");
  const useImagen = !useAvatar && (await hasColumn("imagen"));
  if (useAvatar) {
    const [rows] = await pool.query(
      "SELECT id, nombre, email, avatar FROM usuarios",
    );
    return rows as Usuario[];
  }
  if (useImagen) {
    const [rows] = await pool.query(
      "SELECT id, nombre, email, imagen AS avatar FROM usuarios",
    );
    return rows as Usuario[];
  }
  const [rows] = await pool.query("SELECT id, nombre, email FROM usuarios");
  // map to include avatar null
  return (rows as any[]).map((r) => ({ ...r, avatar: null }));
};

export const getById = async (id: number): Promise<Usuario | null> => {
  const useAvatar = await hasColumn("avatar");
  const useImagen = !useAvatar && (await hasColumn("imagen"));
  let rows: any[] = [];
  if (useAvatar) {
    const [r] = await pool.query(
      "SELECT id, nombre, email, avatar FROM usuarios WHERE id = ?",
      [id],
    );
    rows = r as any[];
  } else if (useImagen) {
    const [r] = await pool.query(
      "SELECT id, nombre, email, imagen AS avatar FROM usuarios WHERE id = ?",
      [id],
    );
    rows = r as any[];
  } else {
    const [r] = await pool.query(
      "SELECT id, nombre, email FROM usuarios WHERE id = ?",
      [id],
    );
    rows = (r as any[]).map((x) => ({ ...x, avatar: null }));
  }
  const result = rows || [];
  return result.length ? (result[0] as Usuario) : null;
};

export const create = async (usuario: Usuario): Promise<number> => {
  const useAvatar = await hasColumn("avatar");
  const useImagen = !useAvatar && (await hasColumn("imagen"));
  let result: any;
  if (useAvatar) {
    [result] = await pool.query(
      "INSERT INTO usuarios (nombre, email, avatar) VALUES (?, ?, ?)",
      [usuario.nombre, usuario.email, usuario.avatar || null],
    );
  } else if (useImagen) {
    [result] = await pool.query(
      "INSERT INTO usuarios (nombre, email, imagen) VALUES (?, ?, ?)",
      [usuario.nombre, usuario.email, usuario.avatar || null],
    );
  } else {
    [result] = await pool.query(
      "INSERT INTO usuarios (nombre, email) VALUES (?, ?)",
      [usuario.nombre, usuario.email],
    );
  }
  // @ts-ignore
  return (result as any).insertId as number;
};

export const update = async (
  id: number,
  usuario: Partial<Usuario>,
): Promise<boolean> => {
  // construir SQL dinámico para no sobreescribir avatar cuando no se provee
  const params: any[] = [];
  let sql = "UPDATE usuarios SET ";
  const sets: string[] = [];
  if (usuario.nombre !== undefined) {
    sets.push("nombre = ?");
    params.push(usuario.nombre);
  }
  if (usuario.email !== undefined) {
    sets.push("email = ?");
    params.push(usuario.email);
  }
  if (usuario.avatar !== undefined) {
    const useAvatar = await hasColumn("avatar");
    const useImagen = !useAvatar && (await hasColumn("imagen"));
    if (useAvatar) {
      sets.push("avatar = ?");
      params.push(usuario.avatar);
    } else if (useImagen) {
      sets.push("imagen = ?");
      params.push(usuario.avatar);
    }
    // otherwise ignore avatar if no column exists
  }
  if (sets.length === 0) return false;
  sql += sets.join(", ") + " WHERE id = ?";
  params.push(id);
  const [result] = await pool.query(sql, params);
  // @ts-ignore
  return (result as any).affectedRows > 0;
};

export const remove = async (id: number): Promise<boolean> => {
  const [result] = await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
  // @ts-ignore
  return (result as any).affectedRows > 0;
};
