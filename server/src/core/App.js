import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { ErrorHandler } from '../middleware/ErrorHandler.js';
import { areaRoutes } from '../routes/AreaRoutes.js';
import { authRoutes } from '../routes/AuthRoutes.js';
import { hazardEventRoutes } from '../routes/HazardEventRoutes.js';
import { healthRoutes } from '../routes/HealthRoutes.js';
import { notificationRoutes } from '../routes/NotificationRoutes.js';
import { organisationRoutes } from '../routes/OrganisationRoutes.js';
import { uploadRoutes } from '../routes/UploadRoutes.js';

// Builds the Express application: global middleware first, then every route
// group, then the 404 and error handlers. Express runs handlers in the order
// they were added, so that order is part of the behaviour.
export class App {
  #express = express();

  constructor(
    routeGroups = [healthRoutes, authRoutes, uploadRoutes, areaRoutes, notificationRoutes],
    routeGroups = [
      healthRoutes,
      authRoutes,
      uploadRoutes,
      areaRoutes,
      hazardEventRoutes,
      organisationRoutes,
    ],
  ) {
    this.#registerMiddleware();
    this.#registerRoutes(routeGroups);
    this.#registerErrorHandlers();
  }

  get express() {
    return this.#express;
  }

  #registerMiddleware() {
    this.#express.use(helmet());
    this.#express.use(cors());
    this.#express.use(express.json());
    this.#express.use(morgan('dev'));
  }

  #registerRoutes(routeGroups) {
    for (const routes of routeGroups) {
      this.#express.use(routes.basePath, routes.router);
    }
  }

  #registerErrorHandlers() {
    this.#express.use(ErrorHandler.notFound);
    this.#express.use(ErrorHandler.handle);
  }
}

// The built Express application — what Server listens with and what tests
// hand to supertest.
export const app = new App().express;
