const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(candidate, stored) {
  if (!stored) return false;
  if (stored.startsWith('$2')) {
    return bcrypt.compare(candidate, stored);
  }
  return candidate === stored;
}

async function upgradeLegacyPassword(user, plainPassword) {
  if (user.password && !user.password.startsWith('$2')) {
    user.password = await hashPassword(plainPassword);
    await user.save();
  }
}

module.exports = { hashPassword, comparePassword, upgradeLegacyPassword };
