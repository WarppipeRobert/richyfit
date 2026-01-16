// routes/docs.ts
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openapi } from "../docs/openapi";

const router = Router();

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(openapi);
});

router.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    swaggerOptions: {
      persistAuthorization: true
    }
  })
);

export default router;
