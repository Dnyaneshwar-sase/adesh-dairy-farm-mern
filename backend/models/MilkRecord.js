
const mongoose = require("mongoose");

const milkRecordSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        date: {
            type: String,
            required: true,
            trim: true
        },

        morningMilk: {
            type: Number,
            required: true,
            min: 0
        },

        eveningMilk: {
            type: Number,
            required: true,
            min: 0
        },

        totalMilk: {
            type: Number,
            required: true,
            min: 0
        },

        milkRate: {
            type: Number,
            min: 0
        },

        income: {
            type: Number,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

milkRecordSchema.index({ ownerId: 1, date: -1 });

module.exports = mongoose.model("MilkRecord", milkRecordSchema);