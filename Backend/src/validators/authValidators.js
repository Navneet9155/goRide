const { z } = require("zod");
const { GENDER } = require("../constants/enums");

const registerPassengerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be 10 digits"),
  password: z.string().min(8),
  gender: z.enum(Object.values(GENDER)).optional(),
  emergencyContactName: z.string().max(60).optional(),
  emergencyContactPhone: z
    .string()
    .regex(/^[0-9]{10}$/, "Emergency contact phone must be 10 digits")
    .optional()
    .or(z.literal("")),
  emergencyContactEmail: z
    .string()
    .email("Enter a valid emergency contact email")
    .optional()
    .or(z.literal("")),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  gender: z.enum(Object.values(GENDER)).optional(),
  profileImage: z.string().url().optional(),
  preferredPaymentMethod: z.enum(["cash", "online"]).optional(),
  safetyPreferences: z.object({ shareTripStatus: z.boolean().optional(), sosConfirmation: z.boolean().optional() }).optional(),
  preferences: z.object({ language: z.string().max(10).optional(), notificationsEnabled: z.boolean().optional(), communicationPreference: z.enum(["push", "sms", "email"]).optional() }).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6),
  newPassword: z.string().min(8),
});

module.exports = { registerPassengerSchema, loginSchema, updateProfileSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
