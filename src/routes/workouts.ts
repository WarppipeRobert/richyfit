
import { Router } from "express";

import { PlanController } from "../controllers/planController";
import { authenticate, authorize } from "../middleware/authenticate";

const router = Router();
const planController = new PlanController();

router.use(authenticate(), authorize(["coach"]));

router.post("/:workoutId/items", planController.addItemToWorkouts);

export default router;
