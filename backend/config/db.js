import mongoose from 'mongoose';

const connection = mongoose.connection;

connection.on('connected', () => {
    console.info('[db] MongoDB connected');
});

connection.on('error', (error) => {
    console.error(`[db] MongoDB connection error: ${error.name || 'UnknownError'}`);
});

connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
});

export async function connectDatabase() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    });
}

export async function closeDatabase() {
    if (connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}
