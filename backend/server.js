import dotenv from 'dotenv';

import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { closeDatabase, connectDatabase } from './config/db.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import onboardingRouter from './routes/onboarding.js';
import readingsRouter from './routes/readings.js';
import notificationsRouter from './routes/notifications.js';
import { createRecommendationsRouter } from './routes/recommendations.js';
import usersRouter from './routes/users.js';

dotenv.config({ override: true });

const requiredEnvironment = ['MONGODB_URI', 'OPENAI_API_KEY', 'AUTH_TOKEN_SECRET'];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);
if (missingEnvironment.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missingEnvironment.join(', ')}`);
    process.exit(1);
}

const recommendationsRouter = createRecommendationsRouter(process.env.OPENAI_API_KEY);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 3000;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
    const mongoConnected = mongoose.connection.readyState === 1;
    res.status(mongoConnected ? 200 : 503).json({
        status: mongoConnected ? 'ok' : 'unavailable',
        server: 'ok',
        database: mongoConnected ? 'connected' : 'disconnected'
    });
});

app.use('/api', (req, res, next) => {
    if (req.path === '/auth/admin-login' || mongoose.connection.readyState === 1) return next();
    res.status(503).json({ error: 'The database is unavailable. Check the database connection and try again.' });
});

app.use('/api/readings', readingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/user/onboarding', onboardingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/recommendations', recommendationsRouter);

const frontendPages = [
    'index.html', 'login.html', 'forgot-password.html', 'reset-password.html', 'signup.html', 'onboarding.html', 'dashboard.html',
    'consumption.html', 'alerts.html', 'reports.html', 'profile.html',
    'admin-login.html', 'admin.html'
];
for (const page of frontendPages) {
    app.get(`/${page}`, (req, res) => res.sendFile(path.join(projectDirectory, page)));
}
app.get('/', (req, res) => res.sendFile(path.join(projectDirectory, 'index.html')));
app.use('/css', express.static(path.join(projectDirectory, 'css'), { dotfiles: 'deny' }));
app.use('/script', express.static(path.join(projectDirectory, 'script'), { dotfiles: 'deny' }));

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
});

app.use((req, res) => {
    res.status(404).send('Page not found.');
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    if (status >= 500) {
        console.error(`[api] Request failed: ${error.name || 'UnknownError'}`);
    }

    const message = error.type === 'entity.parse.failed'
        ? 'Request body must contain valid JSON.'
        : (error.expose ? error.message : status === 400 ? 'The submitted data is invalid.' : 'An unexpected server error occurred.');
    res.status(error.type === 'entity.parse.failed' ? 400 : status).json({ error: message });
});

let server;
let shuttingDown = false;

async function connectDatabaseWithRetry() {
    let retryDelay = 5000;
    while (!shuttingDown && mongoose.connection.readyState !== 1) {
        try {
            await connectDatabase();
        } catch (error) {
            console.error(`[startup] Database connection failed (${error.name || 'Error'}); retrying in ${Math.round(retryDelay / 1000)} seconds`);
        }
        if (mongoose.connection.readyState === 1 || shuttingDown) return;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, 60000);
    }
}

function startServer() {
    server = app.listen(port);
    server.once('listening', () => {
        console.info(`[server] SECMS is available at http://localhost:${port}`);
    });
    server.once('error', async (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`[server] Port ${port} is already in use. Stop the existing server or set PORT to an available port.`);
        } else {
            console.error(`[server] Could not listen on port ${port}: ${error.code || error.name || 'UnknownError'}`);
        }
        await closeDatabase().catch(() => {});
        process.exitCode = 1;
    });
    void connectDatabaseWithRetry();
}

async function shutdown(signal) {
    shuttingDown = true;
    console.info(`[server] ${signal} received; closing gracefully`);
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await closeDatabase();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

startServer();
