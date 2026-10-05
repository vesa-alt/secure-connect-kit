#!/usr/bin/env node
// Usage: node src/auth/hash-password.mjs "my-password"
// Prints the encoded value to put in ADMIN_PASSWORD_HASH.
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node hash-password.mjs "<password>"');
  process.exit(1);
}
const iterations = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
console.log(`pbkdf2_sha256$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}`);
