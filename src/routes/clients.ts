import { Router } from "express";

import { authenticate, authorize } from "../middleware/authenticate";
import { ClientController } from "../controllers/clientController";
import { InsightController } from "../controllers/insightController";

const router = Router();
const clientController = new ClientController();
const insightController = new InsightController();

// ✅ all routes require auth + coach role
router.use(authenticate(), authorize(["coach"]));

router.post("/", clientController.create);
router.get("/", clientController.list);
router.get("/:clientId", clientController.getById);
router.post("/:clientId/insights", insightController.enqueue);
router.get("/:clientId/insights", insightController.get);

export default router;
