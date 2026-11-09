const { z } = require("zod");
const { GENDER, VEHICLE_TYPES } = require("../constants/enums");

const registerDriverSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10}$/),
  password: z.string().min(8),
  gender: z.enum(Object.values(GENDER)).optional(),
  vehicleType: z.enum(VEHICLE_TYPES),
  vehicleModel: z.string().min(1),
  vehicleNumber: z.string().min(4),
  vehicleColor: z.string().optional(),
  licenseNumber: z.string().min(4),
});

const updateDriverProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  vehicleModel: z.string().min(1).optional(),
  profileImage: z.string().url().optional(),
  vehicleMake: z.string().max(80).optional(),
  vehicleColor: z.string().max(40).optional(),
  vehicleRegistrationDetails: z.string().max(200).optional(),
  licenseExpiryDate: z.string().datetime().optional(),
  documents: z.object({
    drivingLicense: z.string().url().optional(), registrationCertificate: z.string().url().optional(),
    insurance: z.string().url().optional(), permit: z.string().url().optional(),
    pollutionCertificate: z.string().url().optional(), other: z.string().url().optional(),
  }).optional(),
  emergencyContacts: z.array(z.object({ name: z.string().min(2), phone: z.string().regex(/^[0-9]{10}$/), email: z.string().email().optional() })).max(5).optional(),
  safetyPreferences: z.object({ shareTripStatus: z.boolean().optional(), sosConfirmation: z.boolean().optional() }).optional(),
  preferences: z.object({ language: z.string().max(10).optional(), notificationsEnabled: z.boolean().optional(), communicationPreference: z.enum(["push", "sms", "email"]).optional() }).optional(),
});

const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const payoutProfileSchema = z.object({
  accountHolderName: z.string().min(2).max(120),
  bankAccountNumber: z.string().min(6).max(30).optional(),
  ifsc: z.string().min(6).max(20).optional(),
  upiId: z.string().min(3).max(120).optional(),
  preferredMethod: z.enum(["bank", "upi"]).optional(),
});

const withdrawalSchema = z.object({ amount: z.number().positive() });

module.exports = { registerDriverSchema, updateDriverProfileSchema, locationUpdateSchema, payoutProfileSchema, withdrawalSchema };
