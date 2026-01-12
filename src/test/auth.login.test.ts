process.env.JWT_SECRET = "test_secret";
process.env.JWT_ACCESS_TTL = "15m";

import { AuthService } from "../services/authService";
import type { UserRepository } from "../repositories/userRepository";
import { AppError } from "../middleware/error";
import bcrypt from "bcryptjs";

function makeRepo(user: {
  id: string;
  email: string;
  role: "coach" | "client";
  password: string;
  created_at?: string;
}): UserRepository {
  const password_hash = bcrypt.hashSync(user.password, 12);

  // minimal shape to satisfy AuthService usage
  return {
    findByEmail: jest.fn(async (email: string) => {
      if (email !== user.email.toLowerCase()) return null;
      return {
        id: user.id,
        email: user.email.toLowerCase(),
        role: user.role,
        password_hash,
        created_at: user.created_at ?? new Date().toISOString()
      };
    })
    // other methods not used in login tests
  } as unknown as UserRepository;
}

describe("AuthService.login", () => {
  test("login success returns accessToken and basic user info", async () => {
    const repo = makeRepo({
      id: "11111111-1111-1111-1111-111111111111",
      email: "test@example.com",
      role: "client",
      password: "password123"
    });

    const svc = new AuthService(repo);

    const res = await svc.login({ email: "test@example.com", password: "password123" });

    expect(typeof res.accessToken).toBe("string");
    expect(res.accessToken.length).toBeGreaterThan(20);

    // basic user info (no password_hash)
    expect(res.user).toEqual(
      expect.objectContaining({
        id: "11111111-1111-1111-1111-111111111111",
        email: "test@example.com",
        role: "client"
      })
    );
    expect((res.user as any).password_hash).toBeUndefined();

    // ensure repo called correctly
    expect((repo.findByEmail as jest.Mock).mock.calls[0][0]).toBe("test@example.com");
  });

  test("login failure with wrong password throws 401 AppError", async () => {
    const repo = makeRepo({
      id: "22222222-2222-2222-2222-222222222222",
      email: "test@example.com",
      role: "coach",
      password: "correct-password"
    });

    const svc = new AuthService(repo);

    await expect(svc.login({ email: "test@example.com", password: "wrong-password" })).rejects.toMatchObject({
      status: 401
    });

    await expect(svc.login({ email: "test@example.com", password: "wrong-password" })).rejects.toBeInstanceOf(
      AppError
    );
  });
});
