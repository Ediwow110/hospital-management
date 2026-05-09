'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { ROLE_PERMISSIONS } = require('../core/permissions');
const { AppContext } = require('../core/AppContext');

/**
 * AuthService — JWT-based authentication with bcrypt password verification.
  * PR #9: replaced insecure base64 token auth with proper JWT + bcrypt.
