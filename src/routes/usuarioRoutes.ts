import { Router } from "express";
import * as UsuarioController from "../controllers/usuarioController";

const router = Router();

router.get("/", UsuarioController.list);
router.get("/:id", UsuarioController.get);
router.post("/", UsuarioController.create);
router.put("/:id", UsuarioController.updateUser);
router.delete("/:id", UsuarioController.removeUser);

export default router;
