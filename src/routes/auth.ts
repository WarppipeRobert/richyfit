
import { Router } from "express";
import { AuthController } from "../controller.ts/authController";
import { authenticate } from "../middleware/authenticate";

const router = Router();
const controller = new AuthController();

router.post("/register", controller.register);
router.post("/login", controller.login);

router.get("/me", authenticate(), controller.me);

export default router;
