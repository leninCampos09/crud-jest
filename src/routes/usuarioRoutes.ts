import { Router } from "express";
import * as UsuarioController from "../controllers/usuarioController";
import upload from "../config/multer";

const router = Router();

router.get("/", UsuarioController.list);
router.get("/:id", UsuarioController.get);
router.post("/", upload.single("avatar"), UsuarioController.create);
router.put("/:id", upload.single("avatar"), UsuarioController.updateUser);
router.delete("/:id", UsuarioController.removeUser);

export default router;
