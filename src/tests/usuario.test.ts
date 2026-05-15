import request from "supertest";
import app from "../app";

jest.mock("../models/usuarioModel");
const UsuarioModel = require("../models/usuarioModel");

describe("Usuarios API", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("GET /usuarios - lista usuarios", async () => {
    UsuarioModel.getAll.mockResolvedValue([
      { id: 1, nombre: "Juan", email: "j@ej.com" },
    ]);
    const res = await request(app).get("/usuarios");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombre).toBe("Juan");
  });

  test("GET /usuarios/:id - usuario existente", async () => {
    UsuarioModel.getById.mockResolvedValue({
      id: 2,
      nombre: "Ana",
      email: "a@ej.com",
    });
    const res = await request(app).get("/usuarios/2");
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Ana");
  });

  test("GET /usuarios/:id - no encontrado", async () => {
    UsuarioModel.getById.mockResolvedValue(null);
    const res = await request(app).get("/usuarios/999");
    expect(res.status).toBe(404);
  });

  test("POST /usuarios - crear usuario", async () => {
    UsuarioModel.create.mockResolvedValue(5);
    const res = await request(app)
      .post("/usuarios")
      .send({ nombre: "Luis", email: "l@e.com" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(5);
  });

  test("PUT /usuarios/:id - actualizar usuario", async () => {
    UsuarioModel.update.mockResolvedValue(true);
    const res = await request(app)
      .put("/usuarios/3")
      .send({ nombre: "Nuevo", email: "n@e.com" });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Nuevo");
  });

  test("DELETE /usuarios/:id - eliminar usuario", async () => {
    UsuarioModel.remove.mockResolvedValue(true);
    const res = await request(app).delete("/usuarios/3");
    expect(res.status).toBe(204);
  });
});
