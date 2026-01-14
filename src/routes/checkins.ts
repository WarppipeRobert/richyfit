import { Router } from "express";
import { authenticate, authorize } from "../middleware/authenticate";
import { CheckinController } from "../controller.ts/checkinController";

const router = Router();
const controller = new CheckinController();

// Coach-only for now (preferred approach)
router.use(authenticate(), authorize(["coach"]));

router.post("/clients/:clientId/checkins", controller.upsert);
router.get("/clients/:clientId/checkins", controller.list);

export default router;
