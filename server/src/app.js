import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { ErrorHandler } from './middleware/ErrorHandler.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);

app.use(ErrorHandler.notFound);
app.use(ErrorHandler.handle);

export default app;
