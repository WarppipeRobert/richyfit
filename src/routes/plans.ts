import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate";
import { PlanController } from "../controllers/planController";


const router = Router();
const planController = new PlanController();

router.use(authenticate(), authorize(["coach"]));

router.get("/plans/:planId", planController.getNested);
router.post("/plans/:planId/workouts", planController.addWorkoutToPlan);
router.post("/workouts/:workoutId/items", planController.addItemToWorkouts);
router.post("/clients/:clientId/plans", planController.createForClient);

export default router;
