import bcrypt from "bcryptjs";

const COST = process.env.NODE_ENV === "test" ? 4 : 11;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
