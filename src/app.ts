import express from "express";
import path from "path";
import dotenv from "dotenv";
import usuarioRoutes from "./routes/usuarioRoutes";
import productoRoutes from "./routes/productoRoutes";

dotenv.config();

const app = express();
app.use(express.json());

// servir frontend estático (carpeta public en la raíz del proyecto)
app.use(express.static(path.join(__dirname, "..", "public")));

// servir imágenes subidas desde src/productos en la ruta /productos
app.use("/productos", express.static(path.join(__dirname, "productos")));
// servir imágenes subidas desde src/uploads en la ruta /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/usuarios", usuarioRoutes);
app.use("/productos", productoRoutes);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () =>
    console.log(`Server running on http://localhost:${port}`),
  );
}

export default app;
