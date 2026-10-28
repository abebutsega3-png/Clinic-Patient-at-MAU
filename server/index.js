import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { fileURLToPath } from 'url';
import connectToDB from './db/db.js';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import clinicHeadRoutes from './router/ClinicHeadRoutes.js';
import clinicHeadApprovalRoutes from './router/clinicheadapprovalRoutes.js';
import authRoutes from './router/AuthRoutes.js';
import staffRosterRoutes from './router/staffrosterRoutes.js';
import clinicHeadPharmacyRoutes from './router/clinicheadPharmacyRoutes.js';
import clinicHeadReportRoutes from './router/clinicheadreportRoutes.js';
import clinicHeadSettingsRoutes from './router/clinicheadSettingsRoutes.js';
import publicClinicRoutes from './router/publicClinicRoutes.js';
import adminDashboardRoutes from './router/adminDashboardRoutes.js';
import adminUserRoutes from './router/adminUserRoutes.js';
import rolePermissionRoutes from './router/rolePermissionRoutes.js';
import departmentRoutes from './router/departmentRoutes.js';
import masterDataRoutes from './router/masterDataRoutes.js';
import cardRoomRoutes from './router/cardRoomRoutes.js';
import { seedRolesAndPermissions } from './module/seedRolesAndPermissions.js';
import { seedMasterDataDefaults } from './module/masterDataCatalog.js';

// 1. Routes (የተጨመሩ Route Imports - የራስህን የፋይል መንገዶች አስገባ)
// ለምሳሌ: import authRouter from './routes/auth.js';
// import patientRouter from './routes/patient.js';

// dotenv config
dotenv.config({
  path: fileURLToPath(new URL('./.env', import.meta.url)),
});

const app = express();
const httpServer = http.createServer(app);

// Socket.io Setup
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', clinicHeadRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/roles', rolePermissionRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/approvals', clinicHeadApprovalRoutes);
app.use('/api/roster', staffRosterRoutes);
app.use('/api/pharmacy', clinicHeadPharmacyRoutes);
app.use('/api/reports', clinicHeadReportRoutes);
app.use('/api/clinic-head/settings', clinicHeadSettingsRoutes);
app.use('/api/public/clinic', publicClinicRoutes);
app.use('/api/card-room', cardRoomRoutes);

// ----------------------------------------------------
// 2. API Routes እዚህ ላይ መግባት አለባቸው!
// (የምትጠቀምባቸውን Routes ከዚህ በታች አክላቸው)
// app.use('/api/auth', authRouter);
// app.use('/api/patients', patientRouter);
// ----------------------------------------------------

// Test Route (ዳታቤዝ እና Server በትክክል መስራቱን በብሮውዘር ለመሞከር)
app.get('/', (req, res) => {
  res.send('Clinic Management API is running...');
});

// Global 404 handler (ከ API Routes በኋላ መሆን አለበት)
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);

  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

// Server Setup
const PORT = Number(process.env.BACKEND_PORT || process.env.PORT || 5000);
let shuttingDown = false;

const formatError = (error) => (
  error instanceof Error ? error.stack || error.message : String(error)
);

const handleFatalError = async (source, error) => {
  console.error(`${source}:`, formatError(error));
  if (shuttingDown) return;
  shuttingDown = true;

  const shutdownTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out; forcing process exit.');
    process.exit(1);
  }, 10000);

  try {
    await new Promise((resolve) => io.close(resolve));
    await mongoose.disconnect();
  } catch (shutdownError) {
    console.error('Error during fatal-error shutdown:', formatError(shutdownError));
  } finally {
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  void handleFatalError('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  void handleFatalError('Unhandled promise rejection', reason);
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Unable to start the HTTP server:', error.stack || error);
  }
  process.exitCode = 1;
});

// Database connection & Server Start
const startServer = async () => {
  try {
    // 1. መጀመሪያ ከ MongoDB ጋር ይገናኛል
    console.log('Connecting to MongoDB...');
    await connectToDB();
    console.log('MongoDB connection established.');
    await seedRolesAndPermissions();
    await seedMasterDataDefaults();

    // 2. ከዳታቤዝ ከተገናኘ በኋላ Server ይነሳል
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', formatError(error));
  }
};

startServer();