import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middleware/error";
import { PlanService } from "../services/planService";
import { requireAuth, parseOrThrow } from "../consts/utils";

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
      const user = requireAuth(req.user);
      const params = parseOrThrow(clientIdParams, req.params);
      const body = parseOrThrow(createPlanSchema, req.body);

      const result = await this.service.createPlanForClient(user.id, params.clientId, body);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  getNested = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      const params = parseOrThrow(planIdParams, req.params);

      const result = await this.service.fetchPlanNested(user.id, params.planId);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  addWorkoutToPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      const params = parseOrThrow(planIdParams, req.params);
      const body = parseOrThrow(addWorkoutSchema, req.body);

      const result = await this.service.addWorkoutToPlan(user.id, params.planId, body);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  addItemToWorkouts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      const params = parseOrThrow(workoutIdParams, req.params);
      const body = parseOrThrow(addItemSchema, req.body);

      const result = await this.service.addItemToWorkout(user.id, params.workoutId, body);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };
}
