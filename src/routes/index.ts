import { Router } from "express";
import { AppError } from "../middleware/error";
import healthRouter from "./health";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Hello from Express + TypeScript! 🎉" });
});

router.use("/health", healthRouter);

router.get("/boom", () => {
  throw new AppError("BAD_REQUEST", "You hit the boom route", 400);
});

export default router;
