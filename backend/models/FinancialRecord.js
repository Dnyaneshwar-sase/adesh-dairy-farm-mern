
const mongoose = require("mongoose");

const financialRecordSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
            index: true
        },

        type: {
            type: String,
            required: true,
            enum: ["income", "expense"]
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        amount: {
            type: Number,
            required: true,
            min: [0.01, "रक्कम शून्यापेक्षा जास्त असावी."]
        },

        date: {
            type: Date,
            required: true,
            default: Date.now
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        paymentMethod: {
            type: String,
            enum: ["cash", "online", "bank", "other"],
            default: "cash"
        }
    },
    {
        timestamps: true
    }
);

financialRecordSchema.index({
    ownerId: 1,
    date: -1
});

module.exports = mongoose.model(
    "FinancialRecord",
    financialRecordSchema
);
