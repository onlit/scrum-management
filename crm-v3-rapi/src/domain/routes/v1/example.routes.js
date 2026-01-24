/**
 * Example Domain Routes
 *
 * This is an example of custom domain routes.
 * Rename this file to create your own routes (e.g., reports.routes.js).
 *
 * Route Naming Convention:
 * - Filename determines route prefix: reports.routes.js -> /api/v1/reports
 * - Use kebab-case: employee-reports.routes.js -> /api/v1/employee-reports
 *
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module domain/routes/v1/example.routes
 */

const express = require('express');
const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');
const prisma = require('#configs/prisma.js');

const router = express.Router();

/**
 * GET /api/v1/example
 *
 * List all examples (public endpoint with auth).
 */
router.get(
  '/',
  auth,
  wrapExpressAsync(async (req, res) => {
    const { page = 1, pageSize = 10 } = req.query;

    // Example: paginated list
    const results = await prisma.example.findMany({
      skip: (page - 1) * pageSize,
      take: Number(pageSize),
      where: {
        deleted: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = await prisma.example.count({
      where: { deleted: null },
    });

    res.json({
      results,
      totalCount,
      pageCount: Math.ceil(totalCount / pageSize),
      currentPage: Number(page),
      perPage: Number(pageSize),
    });
  }, 'example_list')
);

/**
 * GET /api/v1/example/:id
 *
 * Get single example by ID (protected endpoint).
 */
router.get(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(async (req, res) => {
    const { id } = req.params;

    const result = await prisma.example.findFirst({
      where: {
        id,
        deleted: null,
      },
    });

    if (!result) {
      return res.status(404).json({ error: 'Example not found' });
    }

    res.json(result);
  }, 'example_get')
);

/**
 * POST /api/v1/example
 *
 * Create new example (protected endpoint).
 */
router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(async (req, res) => {
    const { name, description } = req.body;

    const result = await prisma.example.create({
      data: {
        name,
        description,
        createdBy: req.user.id,
        clientId: req.user.client?.id,
      },
    });

    res.status(201).json(result);
  }, 'example_create')
);

/**
 * DELETE /api/v1/example/:id
 *
 * Soft delete example (protected endpoint).
 */
router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(async (req, res) => {
    const { id } = req.params;

    await prisma.example.updateMany({
      where: {
        id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        deletedBy: req.user.id,
      },
    });

    res.json({ id });
  }, 'example_delete')
);

/**
 * Custom action example.
 *
 * POST /api/v1/example/:id/duplicate
 */
router.post(
  '/:id/duplicate',
  auth,
  protect,
  wrapExpressAsync(async (req, res) => {
    const { id } = req.params;

    const original = await prisma.example.findFirst({
      where: { id, deleted: null },
    });

    if (!original) {
      return res.status(404).json({ error: 'Example not found' });
    }

    const duplicate = await prisma.example.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        createdBy: req.user.id,
        clientId: req.user.client?.id,
      },
    });

    res.status(201).json(duplicate);
  }, 'example_duplicate')
);

module.exports = router;
