import { Router } from "express";
import { AppError } from "../middleware/error";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import plansRouter from "./plans";
import workoutsRouter from "./workouts";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Hello from Express + TypeScript! 🎉" });
});

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/clients", clientsRouter);
router.use("/plans", plansRouter);
router.use("/workouts", workoutsRouter);

router.get("/boom", () => {
  throw new AppError("BAD_REQUEST", "You hit the boom route", 400);
});

export default router;
