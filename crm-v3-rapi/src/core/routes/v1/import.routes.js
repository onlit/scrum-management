/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module exports a factory function that creates an Express Router instance for handling
 * file uploads for importing records. It supports dependency injection for the auth middleware,
 * enabling testing with mock authentication.
 *
 * The module uses multer middleware to handle file uploads. Uploaded files are stored in the 'tmp/' directory
 * with a unique filename generated based on the current timestamp and the original filename's extension.
 *
 * The router defines the following route:
 * - POST '/:modelName': Route for importing records of the specified model. Requires authentication and protection middleware.
 *   It uses multer middleware to handle file uploads, expecting a single file with the field name 'file'.
 *   The imported records are processed by the importRecords controller function.
 *
 * The route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations and properly catch and propagate
 * errors to the error handling middleware.
 *
 *
 */

const path = require('path');
const dotenv = require('dotenv');
const { Router } = require('express');
const multer = require('multer');

const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');
const { importRecords } = require('#core/controllers/import.controller.js');

dotenv.config();

// Allowed file types for security
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/json',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = ['.csv', '.json', '.txt', '.xls', '.xlsx'];

// File validation function
function fileFilter(req, file, cb) {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
    );
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(
        `Invalid file extension: ${ext}. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  }

  // Validate filename to prevent directory traversal
  if (
    file.originalname.includes('..') ||
    file.originalname.includes('/') ||
    file.originalname.includes('\\')
  ) {
    return cb(new Error('Invalid filename: contains dangerous characters'));
  }

  cb(null, true);
}

const MAX_IMPORT_UPLOAD_MB = Number(process.env.MAX_IMPORT_UPLOAD_MB || 2048); // default 2GB
const MAX_IMPORT_UPLOAD_BYTES = Math.max(1, MAX_IMPORT_UPLOAD_MB) * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, '/tmp/');
    },
    filename(req, file, cb) {
      // Generate secure filename with sanitized original name
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      cb(null, `${timestamp}_${randomSuffix}_${sanitizedName}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: MAX_IMPORT_UPLOAD_BYTES,
    files: 1, // Only allow 1 file
  },
});

/**
 * Creates import routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createImportRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/:modelName',
    auth,
    protect,
    upload.single('file'),
    wrapExpressAsync(importRecords, 'import_records')
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createImportRoutes;
module.exports.router = createImportRoutes();
