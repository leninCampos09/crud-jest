import multer from "multer";
import path from "path";
import fs from "fs";

const productosDir = path.resolve(__dirname, "..", "productos");
const uploadsDir = path.resolve(__dirname, "..", "uploads");

// asegurar que los directorios existen (productos, uploads)
[productosDir, uploadsDir].forEach((d) => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // si el campo es 'avatar' usar uploads, si no usar productos
    // esto permite reutilizar el mismo middleware para distintos campos
    const dest = _file.fieldname === "avatar" ? uploadsDir : productosDir;
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({ storage });

export default upload;
