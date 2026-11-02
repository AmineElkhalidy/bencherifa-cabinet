import bcrypt from "bcryptjs";

const ROUNDS = 12;

// Precomputed valid bcrypt hash (rounds=12) used for constant-time dummy
// verification when a username does not exist, preventing timing enumeration.
const DUMMY_BCRYPT_HASH =
  "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oL23/V/C.";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function verifyDummyPassword(plain: string) {
  return bcrypt.compare(plain, DUMMY_BCRYPT_HASH);
}
