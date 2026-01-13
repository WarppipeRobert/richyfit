import { NextFunction } from "express";
import { AppError } from "../middleware/error";
import { Request, Response } from "express";

export class UserController {
  constructor() { }

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);
      }
      return res.status(200).json({ user: req.user });
    } catch (err) {
      return next(err);
    }
  };

  coachOnly = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);
      return res.status(200).json({
        message: "coach access granted",
        user: req.user
      });
    } catch (err) {
      return next(err);
    }
  };
}
