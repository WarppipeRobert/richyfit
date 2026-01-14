import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middleware/error";
import { PlanService } from "../services/planService";

const createPlanSchema = z.object({
  title: z.string().min(1).max(200),
  startDate: z.string().optional(), // ISO date string; stored as DATE
  endDate: z.string().optional()
});

const addWorkoutSchema = z.object({
  scheduledDay: z.number().int().min(1).max(7),
  title: z.string().min(1).max(200)
});

const addItemSchema = z.object({
  exerciseName: z.string().min(1).max(200),
  sets: z.number().int().min(1).max(100),
  reps: z.number().int().min(1).max(500).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(5000).optional()
});

const planIdParams = z.object({ planId: z.uuid() });
const clientIdParams = z.object({ clientId: z.uuid() });
const workoutIdParams = z.object({ workoutId: z.uuid() });

export class PlanController {
  constructor(private readonly service: PlanService = new PlanService()) { }

  createForClient = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const p = clientIdParams.safeParse(req.params);
      if (!p.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const b = createPlanSchema.safeParse(req.body);
      if (!b.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const result = await this.service.createPlanForClient(req.user.id, p.data.clientId, b.data);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  getNested = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const p = planIdParams.safeParse(req.params);
      if (!p.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const result = await this.service.fetchPlanNested(req.user.id, p.data.planId);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  addWorkoutToPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const p = planIdParams.safeParse(req.params);
      if (!p.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const b = addWorkoutSchema.safeParse(req.body);
      if (!b.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const result = await this.service.addWorkoutToPlan(req.user.id, p.data.planId, b.data);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  addItemToWorkouts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const p = workoutIdParams.safeParse(req.params);
      if (!p.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const b = addItemSchema.safeParse(req.body);
      if (!b.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const result = await this.service.addItemToWorkout(req.user.id, p.data.workoutId, b.data);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };
}
