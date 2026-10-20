const mongoose = require("mongoose");

const feedRecordSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    feedName: {
      type: String,
      required: true,
      trim: true
    },

    transactionType: {
      type: String,
      enum: ["purchase", "usage", "farm-stock", "farm-usage"],
      required: true
    },

    feedSource: {
      type: String,
      enum: ["purchased", "farm-grown"],
      default: "purchased"
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01
    },

    unit: {
      type: String,
      enum: ["kg", "quintal", "bag", "liter", "guntha"],
      required: true
    },

    // चाऱ्याचे क्षेत्रफळ नेहमी गुंठ्यांमध्ये
    fieldAreaGuntha: {
      type: Number,
      default: 0,
      min: 0
    },

    rate: {
      type: Number,
      default: 0,
      min: 0
    },

    amount: {
      type: Number,
      default: 0,
      min: 0
    },

    date: {
      type: Date,
      default: Date.now,
      required: true
    },

    supplier: {
      type: String,
      trim: true,
      default: ""
    },

    description: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeedRecord", feedRecordSchema);