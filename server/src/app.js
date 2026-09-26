import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { healthRoutes } from './routes/HealthRoutes.js';
import { authRoutes } from './routes/AuthRoutes.js';
import { uploadRoutes } from './routes/UploadRoutes.js';
import { ErrorHandler } from './middleware/ErrorHandler.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

for (const routes of [healthRoutes, authRoutes, uploadRoutes]) {
  app.use(routes.basePath, routes.router);
}

app.use(ErrorHandler.notFound);
app.use(ErrorHandler.handle);

export default app;
