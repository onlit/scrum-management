/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines an Express Router instance that handles file uploads for importing records.
 * It imports necessary middleware functions for authentication, authorization, and wrapping asynchronous operations,
 * as well as a controller function for handling the import operation.
 *
 * The module uses multer middleware to handle file uploads. Uploaded files are stored in the 'uploads/' directory
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
const { Router } = require('express');
const multer = require('multer');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');
const { importRecords } = require('#controllers/import.controller.js');

const router = Router();

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

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, 'uploads/');
    },
    filename(req, file, cb) {
      // Generate secure filename with sanitized original name
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const ext = path.extname(file.originalname);
      cb(null, `${timestamp}_${randomSuffix}_${sanitizedName}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only allow 1 file
  },
});

router.post(
  '/:modelName',
  auth,
  protect,
  upload.single('file'),
  wrapExpressAsync(importRecords, 'import_records')
);

module.exports = router;
