import { Router } from "express";
import upload from "../config/multer";
import {
  getAll,
  create,
  remove,
  getById,
  update,
} from "../controllers/productoController";

const router = Router();

router.get("/", getAll);
router.post("/", upload.single("imagen"), create);
router.get("/:id", getById);
router.put("/:id", upload.single("imagen"), update);
router.delete("/:id", remove);

export default router;
