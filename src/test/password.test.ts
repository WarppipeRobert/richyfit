import bcrypt from "bcryptjs";

describe("password hash/verify", () => {
  test("hash then verify works", async () => {
    const password = "password123!";
    const hash = await bcrypt.hash(password, 12);

    expect(hash).toBeTruthy();
    expect(hash).not.toEqual(password);

    const ok = await bcrypt.compare(password, hash);
    expect(ok).toBe(true);

    const bad = await bcrypt.compare("wrong-password", hash);
    expect(bad).toBe(false);
  });
});
