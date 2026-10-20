
const mongoose = require("mongoose");

const salaryPaymentSchema = new mongoose.Schema(
    {
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12
        },
        year: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        paymentDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        paymentMode: {
            type: String,
            enum: ["Cash", "UPI", "Bank Transfer", "Other"],
            default: "Cash"
        },
        workDays: {
            type: Number,
            default: 0,
            min: 0
        },
        note: {
            type: String,
            trim: true,
            default: ""
        }
    },
    { timestamps: true }
);

const workerSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        mobileNumber: {
            type: String,
            trim: true,
            default: ""
        },
        workType: {
            type: String,
            required: true,
            trim: true
        },
        salaryType: {
            type: String,
            enum: ["Monthly", "Daily"],
            required: true
        },
        monthlySalary: {
            type: Number,
            default: 0,
            min: 0
        },
        dailyWage: {
            type: Number,
            default: 0,
            min: 0
        },
        joiningDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active"
        },
        notes: {
            type: String,
            trim: true,
            default: ""
        },
        payments: {
            type: [salaryPaymentSchema],
            default: []
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Worker", workerSchema);
