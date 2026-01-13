
import { Router } from "express";
import { AuthController } from "../controller.ts/authController";
import { authenticate, authorize } from "../middleware/authenticate";

const router = Router();
const controller = new AuthController();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

router.post("/logout-all", authenticate(), controller.logout);

export default router;
