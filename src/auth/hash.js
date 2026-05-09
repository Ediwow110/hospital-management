'use strict';

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('hashPassword: plain password is required');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string' || hash.length === 0) {
    return false;
  }
  return bcrypt.compare(plain, hash);
}

module.exports = { SALT_ROUNDS, hashPassword, verifyPassword };
