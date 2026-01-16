
import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { authenticate } from "../middleware/authenticate";
import { rateLimit } from "../middleware/rateLimit";
import { keyByEmail, keyByIp } from "../consts/rateLimitKeys";

const router = Router();
const controller = new AuthController();

const AUTH_WINDOW_SECONDS = Number(process.env.RL_AUTH_WINDOW_SECONDS ?? 900); // 15m
const AUTH_MAX_PER_IP = Number(process.env.RL_AUTH_MAX_PER_IP ?? 20);
const AUTH_MAX_PER_EMAIL = Number(process.env.RL_AUTH_MAX_PER_EMAIL ?? 10);

router.post(
  "/register",
  rateLimit({
    prefix: "rl_auth_ip_register",
    windowSeconds: AUTH_WINDOW_SECONDS,
    max: AUTH_MAX_PER_IP,
    key: keyByIp
  }),
  rateLimit({
    prefix: "rl_auth_email_register",
    windowSeconds: AUTH_WINDOW_SECONDS,
    max: AUTH_MAX_PER_EMAIL,
    key: keyByEmail
  }),
  controller.register
);
router.post(
  "/login",
  rateLimit({
    prefix: "rl_auth_ip_login",
    windowSeconds: AUTH_WINDOW_SECONDS,
    max: AUTH_MAX_PER_IP,
    key: keyByIp
  }),
  rateLimit({
    prefix: "rl_auth_email_login",
    windowSeconds: AUTH_WINDOW_SECONDS,
    max: AUTH_MAX_PER_EMAIL,
    key: keyByEmail
  }),
  controller.login
);

router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

router.post("/logout-all", authenticate(), controller.logout);

export default router;
