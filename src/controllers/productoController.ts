import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import * as model from "../models/productoModel";

const MAX_NOMBRE_LEN = 150;

export const getAll = async (_req: Request, res: Response) => {
  try {
    const products = await model.getAll();
    return res.json(products);
  } catch (err) {
    console.error("Error fetching productos:", err);
    return res.status(500).json({ error: "Error obteniendo productos" });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const prod = await model.getById(id);
    if (!prod) return res.status(404).json({ error: "No encontrado" });
    return res.json(prod);
  } catch (err) {
    console.error("Error fetching producto by id:", err);
    return res.status(500).json({ error: "Error obteniendo producto" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    // helper: remove uploaded file if present
    const removeUploaded = () => {
      try {
        const f = (req as any).file;
        if (f && f.filename) {
          const p = path.resolve(__dirname, "..", "productos", f.filename);
          if (fs.existsSync(p)) {
            fs.unlinkSync(p);
          }
        }
      } catch (e) {
        console.error("Error removing uploaded file:", e);
      }
    };

    const { nombre, descripcion } = req.body;
    if (!nombre) {
      removeUploaded();
      return res.status(400).json({ error: "El campo 'nombre' es requerido" });
    }

    if (typeof nombre === "string" && nombre.length > MAX_NOMBRE_LEN) {
      removeUploaded();
      return res
        .status(400)
        .json({
          error: `El campo 'nombre' excede el máximo de ${MAX_NOMBRE_LEN} caracteres`,
        });
    }

    // detectar campo precio (case-insensitive) o tomar req.body.precio
    const bodyKeys = Object.keys(req.body || {});
    let rawPrecio: any =
      (req.body && (req.body.precio ?? req.body.Precio)) ?? undefined;
    if (rawPrecio === undefined) {
      // buscar una clave parecida a 'precio' (case-insensitive)
      const key = bodyKeys.find(
        (k) => k.toLowerCase() === "precio" || k.toLowerCase() === "price",
      );
      if (key) rawPrecio = req.body[key];
    }
    if (rawPrecio === undefined) {
      console.log("create: body keys=", bodyKeys, "body=", req.body);
      removeUploaded();
      return res
        .status(400)
        .json({ error: "El campo 'precio' es requerido", fields: bodyKeys });
    }

    // normalizar varios formatos: 1.234.567,89  or 1,234,567.89 or 1200,50
    let s = String(rawPrecio).trim();
    // if contains both '.' and ',', assume '.' thousands and ',' decimal
    if (s.includes(".") && s.includes(",")) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else if (s.includes(".") && !s.includes(",")) {
      // only dots: try to detect whether last dot is decimal separator
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount === 1) {
        // single dot, likely decimal separator: keep as is
        // nothing
      } else {
        // multiple dots: determine fraction length after last dot
        const lastDot = s.lastIndexOf(".");
        const fracLen = s.length - lastDot - 1;
        if (fracLen > 0 && fracLen <= 4) {
          // treat last dot as decimal separator, remove other dots
          const origFracLen = fracLen;
          const withoutDots = s.replace(/\./g, "");
          // rebuild placing decimal before the last origFracLen digits
          s =
            withoutDots.slice(0, withoutDots.length - origFracLen) +
            "." +
            withoutDots.slice(-origFracLen);
        } else {
          // ambiguous: remove all dots (treat as thousand separators)
          s = s.replace(/\./g, "");
        }
      }
    } else if (s.includes(",") && !s.includes(".")) {
      const commaCount = (s.match(/,/g) || []).length;
      const lastComma = s.lastIndexOf(",");
      const fracLen = s.length - lastComma - 1;

      // If the segment after the last comma has length 3, it's very likely a thousands
      // separator (e.g. "1,900" -> 1900). In that case remove all commas.
      if (fracLen === 3) {
        s = s.replace(/,/g, "");
      } else if (fracLen > 0 && fracLen <= 4) {
        // treat last comma as decimal separator, remove other commas
        const origFracLen = fracLen;
        const withoutCommas = s.replace(/,/g, "");
        s =
          withoutCommas.slice(0, withoutCommas.length - origFracLen) +
          "." +
          withoutCommas.slice(-origFracLen);
      } else {
        // fallback: remove commas
        s = s.replace(/,/g, "");
      }
    }
    // remove any non-digit except dot and minus
    s = s.replace(/[^0-9.\-]/g, "");
    const precioNum = parseFloat(s);
    if (Number.isNaN(precioNum)) {
      removeUploaded();
      return res.status(400).json({
        error: "El campo 'precio' debe ser un número",
        raw: rawPrecio,
      });
    }

    let imagenPath: string | null = null;
    if ((req as any).file) {
      imagenPath = `/productos/${(req as any).file.filename}`;
    }

    const id = await model.create({
      nombre,
      precio: precioNum,
      imagen: imagenPath,
      descripcion: descripcion ?? null,
    });
    return res.status(201).json({
      idProducto: id,
      nombre,
      precio: precioNum,
      imagen: imagenPath,
      descripcion: descripcion ?? null,
    });
  } catch (err) {
    // if an error occurs after multer saved the file, remove it to avoid orphan files
    try {
      const f = (req as any).file;
      if (f && f.filename) {
        const p = path.resolve(__dirname, "..", "productos", f.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch (e) {
      console.error("Error removing uploaded file after create error:", e);
    }
    console.error("Error creando producto:", err);
    return res
      .status(500)
      .json({ error: "Error creando producto", details: String(err) });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await model.getById(id);
    if (!existing) return res.status(404).json({ error: "No encontrado" });

    if (existing.imagen) {
      const filename = path.basename(existing.imagen);
      const possible = [
        path.resolve(__dirname, "..", "productos", filename),
        path.resolve(__dirname, "..", "uploads", filename),
        path.resolve(__dirname, "..", "products", filename),
      ];
      for (const p of possible) {
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch (e) {
            console.error("Error deleting file", p, e);
          }
          break;
        }
      }
    }

    const ok = await model.remove(id);
    if (ok) return res.json({ deleted: true });
    return res.status(500).json({ error: "No se pudo eliminar" });
  } catch (err) {
    console.error("Error eliminando producto:", err);
    return res.status(500).json({ error: "Error eliminando producto" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await model.getById(id);
    if (!existing) return res.status(404).json({ error: "No encontrado" });

    // Determine new values, falling back to existing
    const nombre = req.body.nombre ?? existing.nombre;
    const descripcion = req.body.descripcion ?? existing.descripcion;

    if (
      req.body &&
      typeof req.body.nombre === "string" &&
      req.body.nombre.length > MAX_NOMBRE_LEN
    ) {
      return res
        .status(400)
        .json({
          error: `El campo 'nombre' excede el máximo de ${MAX_NOMBRE_LEN} caracteres`,
        });
    }

    // precio parsing (same logic as create) if provided
    let precioNum = existing.precio;
    if (req.body && (req.body.precio ?? req.body.Precio) !== undefined) {
      let rawPrecio: any = req.body.precio ?? req.body.Precio;
      if (rawPrecio === undefined) {
        const keys = Object.keys(req.body || {});
        const key = keys.find(
          (k) => k.toLowerCase() === "precio" || k.toLowerCase() === "price",
        );
        if (key) rawPrecio = req.body[key];
      }
      if (rawPrecio !== undefined) {
        let s = String(rawPrecio).trim();
        if (s.includes(".") && s.includes(",")) {
          s = s.replace(/\./g, "").replace(/,/g, ".");
        } else if (s.includes(".") && !s.includes(",")) {
          const dotCount = (s.match(/\./g) || []).length;
          if (dotCount === 1) {
          } else {
            const lastDot = s.lastIndexOf(".");
            const fracLen = s.length - lastDot - 1;
            if (fracLen > 0 && fracLen <= 4) {
              const origFracLen = fracLen;
              const withoutDots = s.replace(/\./g, "");
              s =
                withoutDots.slice(0, withoutDots.length - origFracLen) +
                "." +
                withoutDots.slice(-origFracLen);
            } else {
              s = s.replace(/\./g, "");
            }
          }
        } else if (s.includes(",") && !s.includes(".")) {
          const lastComma = s.lastIndexOf(",");
          const fracLen = s.length - lastComma - 1;
          if (fracLen === 3) {
            s = s.replace(/,/g, "");
          } else if (fracLen > 0 && fracLen <= 4) {
            const origFracLen = fracLen;
            const withoutCommas = s.replace(/,/g, "");
            s =
              withoutCommas.slice(0, withoutCommas.length - origFracLen) +
              "." +
              withoutCommas.slice(-origFracLen);
          } else {
            s = s.replace(/,/g, "");
          }
        }
        s = s.replace(/[^0-9.\-]/g, "");
        const parsed = parseFloat(s);
        if (Number.isNaN(parsed))
          return res
            .status(400)
            .json({ error: "El campo 'precio' debe ser un número" });
        precioNum = parsed;
      }
    }

    let imagenPath = existing.imagen ?? null;
    if ((req as any).file) {
      // delete old image file if exists
      if (existing.imagen) {
        const filename = path.basename(existing.imagen);
        const possible = [
          path.resolve(__dirname, "..", "productos", filename),
          path.resolve(__dirname, "..", "uploads", filename),
          path.resolve(__dirname, "..", "products", filename),
        ];
        for (const p of possible) {
          if (fs.existsSync(p)) {
            try {
              fs.unlinkSync(p);
            } catch (e) {
              console.error("Error deleting old file", p, e);
            }
            break;
          }
        }
      }
      imagenPath = `/productos/${(req as any).file.filename}`;
    }

    const ok = await model.update(id, {
      nombre,
      precio: precioNum,
      imagen: imagenPath,
      descripcion,
    });
    if (!ok) {
      // remove newly uploaded file if present (to avoid orphan files)
      try {
        const f = (req as any).file;
        if (f && f.filename) {
          const p = path.resolve(__dirname, "..", "productos", f.filename);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      } catch (e) {
        console.error("Error removing uploaded file after failed update:", e);
      }
      return res.status(500).json({ error: "No se pudo actualizar" });
    }
    const updated = await model.getById(id);
    return res.json(updated);
  } catch (err) {
    // remove newly uploaded file if an exception occurred
    try {
      const f = (req as any).file;
      if (f && f.filename) {
        const p = path.resolve(__dirname, "..", "productos", f.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch (e) {
      console.error("Error removing uploaded file after update exception:", e);
    }
    console.error("Error actualizando producto:", err);
    return res.status(500).json({ error: "Error actualizando producto" });
  }
};
