import { Router } from "express";

import { authenticate, authorize } from "../middleware/authenticate";
import { ClientController } from "../controllers/clientController";

const router = Router();
const controller = new ClientController();

// ✅ all routes require auth + coach role
router.use(authenticate(), authorize(["coach"]));

router.post("/", controller.create);
router.get("/", controller.list);
router.get("/:clientId", controller.getById);

export default router;
