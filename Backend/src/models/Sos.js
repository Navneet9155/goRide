const mongoose = require("mongoose");
const { SOS_STATUS } = require("../constants/enums");

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const sosSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, index: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
    triggeredBy: { type: String, enum: ["passenger", "driver"], required: true, index: true },
    location: { type: geoPointSchema, required: true },
    nearestPoliceStation: {
      name: String, address: String, phone: String, latitude: Number, longitude: Number, distanceMetres: Number,
    },
    delivery: {
      attemptedAt: Date,
      contacts: [{ name: String, phone: String, sms: String, whatsapp: String }],
      dispatchSms: String,
      dispatchWhatsApp: String,
    },
    status: { type: String, enum: Object.values(SOS_STATUS), default: SOS_STATUS.TRIGGERED },
    triggeredAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sos", sosSchema);
