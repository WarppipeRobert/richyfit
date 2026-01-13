import { Router } from "express";
import { UserController } from "../controller.ts/userController";
import { authenticate, authorize } from "../middleware/authenticate";

const router = Router();
const controller = new UserController();

router.get("/me", authenticate(), controller.me);
router.get("/coach-only", authenticate(), authorize(["coach"]), controller.coachOnly);

export default router;
