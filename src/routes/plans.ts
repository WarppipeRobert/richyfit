import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate";
import { PlanController } from "../controllers/planController";


const router = Router();
const planController = new PlanController();

router.use(authenticate(), authorize(["coach"]));

router.get("/:planId", planController.getNested);
router.post("/:planId/workouts", planController.addWorkoutToPlan);

export default router;
