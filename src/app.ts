import express from "express";
import dotenv from "dotenv";
import usuarioRoutes from "./routes/usuarioRoutes";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/usuarios", usuarioRoutes);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () =>
    console.log(`Server running on http://localhost:${port}`),
  );
}

export default app;
