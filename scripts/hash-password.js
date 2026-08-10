#!/usr/bin/env node
// Generates a bcrypt hash for ADMIN_PASSWORD_HASH.
//
// Usage: npm run hash-password -- "your-long-password"

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- \"your-long-password\"");
  process.exit(1);
}

if (password.length < 12) {
  console.error("Choose a password with at least 12 characters.");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));
