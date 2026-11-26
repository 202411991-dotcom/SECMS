import mongoose from 'mongoose';

const applianceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    kwh: { type: Number, min: 0, default: 0 },
    estimatedCost: { type: Number, min: 0, default: 0 }
}, { _id: false });

const energyReadingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kwh: { type: Number, required: true, min: 0 },
    estimatedCost: { type: Number, min: 0, default: 0 },
    previousReading: { type: Number, min: 0, default: null },
    presentReading: { type: Number, min: 0, default: null },
    ratePerKwh: { type: Number, min: 0, default: null },
    peakHours: {
        type: [{ type: String, trim: true, maxlength: 80 }],
        default: []
    },
    appliances: { type: [applianceSchema], default: [] },
    timestamp: { type: Date, default: Date.now }
}, {
    timestamps: true,
    versionKey: false
});

energyReadingSchema.index({ timestamp: -1 });
energyReadingSchema.index({ userId: 1, timestamp: -1 });

const EnergyReading = mongoose.model('EnergyReading', energyReadingSchema);

export default EnergyReading;
