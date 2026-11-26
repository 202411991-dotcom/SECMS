import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    accountNumber: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    resetPasswordToken: { type: String, select: false, default: undefined },
    resetPasswordExpires: { type: Date, select: false, default: undefined },
    role: { type: String, enum: ['user'], default: 'user', immutable: true },
    accountStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },
    billStatus: { type: String, enum: ['pending', 'paid', 'not-paid'], default: 'pending' },
    previousReading: { type: Number, min: 0, default: null },
    presentReading: { type: Number, min: 0, default: null },
    ratePerKwh: { type: Number, min: 0, default: null },
    completeAddress: { type: String, trim: true, maxlength: 500, default: '' },
    phoneNumber: { type: String, trim: true, maxlength: 30, default: '' },
    electricityProvider: { type: String, trim: true, maxlength: 120, default: '' },
    initialConsumptionKwh: { type: Number, min: 0, default: null },
    consumptionBaselineKwh: { type: Number, min: 0, default: null },
    estimatedInitialBill: { type: Number, min: 0, default: null },
    isProfileComplete: { type: Boolean, default: false }
}, {
    timestamps: true,
    versionKey: false
});

const User = mongoose.model('User', userSchema);

export default User;
