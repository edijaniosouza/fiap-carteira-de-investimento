import "server-only";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export function hash_password(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verify_password(password: string, password_hash: string): Promise<boolean> {
  return bcrypt.compare(password, password_hash);
}
