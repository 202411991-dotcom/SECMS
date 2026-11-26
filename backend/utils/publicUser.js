export function toPublicUser(user) {
    return {
        id: String(user._id),
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        billStatus: user.billStatus,
        previousReading: user.previousReading,
        presentReading: user.presentReading,
        ratePerKwh: user.ratePerKwh,
        completeAddress: user.completeAddress,
        phoneNumber: user.phoneNumber,
        electricityProvider: user.electricityProvider,
        initialConsumptionKwh: user.initialConsumptionKwh,
        consumptionBaselineKwh: user.consumptionBaselineKwh,
        estimatedInitialBill: user.estimatedInitialBill,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        dateCreated: user.createdAt
            ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : '',
        phone: user.phoneNumber,
        address: user.completeAddress,
        provider: user.electricityProvider
    };
}
