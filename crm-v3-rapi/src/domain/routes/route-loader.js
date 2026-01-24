/**
 * Domain Route Loader
 *
 * Auto-discovers and loads custom routes from domain/routes directory.
 * These routes are preserved across regeneration.
 *
 * @module domain/routes/route-loader
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * Load all domain routes.
 * @param {string} routesDir - Path to domain routes directory
 * @returns {express.Router} Combined router with all domain routes
 */
function loadDomainRoutes(routesDir) {
  const router = express.Router();

  if (!fs.existsSync(routesDir)) {
    console.log('[DomainRoutes] No domain routes directory found');
    return router;
  }

  const files = fs.readdirSync(routesDir);
  const routeFiles = files.filter((f) => f.endsWith('.routes.js'));

  for (const file of routeFiles) {
    try {
      const routePath = path.join(routesDir, file);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const routeModule = require(routePath);

      // Get router from module (supports default export, router property, or direct export)
      const subRouter = routeModule.default || routeModule.router || routeModule;

      if (typeof subRouter === 'function' || subRouter instanceof express.Router) {
        // Extract prefix from filename: employee-custom.routes.js -> /employee-custom
        const prefix = `/${file.replace('.routes.js', '')}`;
        router.use(prefix, subRouter);
        console.log(`[DomainRoutes] Loaded: ${prefix}`);
      } else {
        console.warn(`[DomainRoutes] Invalid route module: ${file}`);
      }
    } catch (error) {
      console.error(`[DomainRoutes] Failed to load ${file}:`, error.message);
    }
  }

  return router;
}

/**
 * Create a domain route file (stub).
 * @param {string} routesDir - Directory to create the file in
 * @param {string} name - Route name (e.g., 'employee-reports')
 * @returns {string} Path to created file
 */
function createDomainRouteStub(routesDir, name) {
  const filePath = path.join(routesDir, `${name}.routes.js`);

  if (fs.existsSync(filePath)) {
    throw new Error(`Route file already exists: ${filePath}`);
  }

  const stub = `/**
 * ${name} Routes
 *
 * Custom domain routes for ${name}.
 * This file is NEVER overwritten by the generator.
 *
 * @module domain/routes/${name}.routes
 */

const express = require('express');
// const { protect } = require('#middlewares/protect.js');
// const { wrapAsync } = require('#middlewares/wrapAsync.js');

const router = express.Router();

// Example route
// router.get('/', protect, wrapAsync(async (req, res) => {
//   res.json({ message: 'Hello from ${name}' });
// }));

module.exports = router;
`;

  fs.mkdirSync(routesDir, { recursive: true });
  fs.writeFileSync(filePath, stub);

  return filePath;
}

/**
 * Get list of all domain route files.
 * @param {string} routesDir - Path to domain routes directory
 * @returns {string[]} List of route file names
 */
function listDomainRoutes(routesDir) {
  if (!fs.existsSync(routesDir)) {
    return [];
  }

  const files = fs.readdirSync(routesDir);
  return files.filter((f) => f.endsWith('.routes.js'));
}

module.exports = {
  loadDomainRoutes,
  createDomainRouteStub,
  listDomainRoutes,
};
