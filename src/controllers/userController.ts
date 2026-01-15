import { NextFunction } from "express";
import { AppError } from "../middleware/error";
import { Request, Response } from "express";
import { requireAuth } from "../consts/utils";

export class UserController {
  constructor() { }

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      return res.status(200).json({ user });
    } catch (err) {
      return next(err);
    }
  };

  coachOnly = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      return res.status(200).json({
        message: "coach access granted",
        user
      });
    } catch (err) {
      return next(err);
    }
  };
}
