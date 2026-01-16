import { Router } from "express";

import { authenticate, authorize } from "../middleware/authenticate";
import { ClientController } from "../controllers/clientController";
import { InsightController } from "../controllers/insightController";
import { UploadController } from "../controllers/uploadController";
import { CheckinController } from "../controllers/checkinController";
import { PlanController } from "../controllers/planController";
import { idempotency } from "../middleware/idempotency";
import { rateLimit } from "../middleware/rateLimit";
import { keyByUser } from "../consts/rateLimitKeys";

const router = Router();
const clientController = new ClientController();
const insightController = new InsightController();
const uploadController = new UploadController();
const checkinController = new CheckinController();
const planController = new PlanController();

// ✅ all routes require auth + coach role
router.use(authenticate(), authorize(["coach"]));

const WRITE_WINDOW_SECONDS = Number(process.env.RL_WRITE_WINDOW_SECONDS ?? 60);
const WRITE_MAX = Number(process.env.RL_WRITE_MAX ?? 60);

const READ_WINDOW_SECONDS = Number(process.env.RL_READ_WINDOW_SECONDS ?? 60);
const READ_MAX = Number(process.env.RL_READ_MAX ?? 300);

const writeLimit = rateLimit({
  prefix: "rl_write_user",
  windowSeconds: WRITE_WINDOW_SECONDS,
  max: WRITE_MAX,
  key: keyByUser
});

const readLimit = rateLimit({
  prefix: "rl_read_user",
  windowSeconds: READ_WINDOW_SECONDS,
  max: READ_MAX,
  key: keyByUser
});

router.post("/", writeLimit, idempotency("POST:/clients"), clientController.create);
router.post("/:clientId/insights", writeLimit, insightController.enqueue);
router.post("/:clientId/uploads", writeLimit, uploadController.createUploadUrl);
router.post("/:clientId/checkins", writeLimit, idempotency("POST:/clients/:clientId/checkins"), checkinController.upsert);
router.post("/:clientId/plans", writeLimit, idempotency("POST:/clients/:clientId/plans"), planController.createForClient);


router.get("/", readLimit, clientController.list);
router.get("/:clientId", readLimit, clientController.getById);
router.get("/:clientId/insights", readLimit, insightController.get);
router.get("/:clientId/uploads", readLimit, uploadController.listUploads);
router.get("/:clientId/checkins", readLimit, checkinController.list);


export default router;
