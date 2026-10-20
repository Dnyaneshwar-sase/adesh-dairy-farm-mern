
const mongoose = require("mongoose");

const breedingRecordSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        cowId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Cow",
            required: true,
            index: true
        },

        heatDate: {
            type: String,
            default: ""
        },

        aiDate: {
            type: String,
            default: ""
        },

        aiReminderDate: {
            type: String,
            default: ""
        },

        pregnancyStatus: {
            type: String,
            default: "तपासणी बाकी"
        },

        pregnancyCheckDate: {
            type: String,
            default: ""
        },

        expectedCalvingDate: {
            type: String,
            default: ""
        },

        aiEmailSent: {
            type: Boolean,
            default: false
        },

        heatEmailSent: {
            type: Boolean,
            default: false
        },

        calvingEmailSent: {
            type: Boolean,
            default: false
        },

        pregnancyTestEmailSent: {
            type: Boolean,
            default: false
        },

        calving15DayEmailSent: {
            type: Boolean,
            default: false
        },

        calving9DayEmailSent: {
            type: Boolean,
            default: false
        },

        calvingDueDayEmailSent: {
            type: Boolean,
            default: false
        },

        lastPregnancyReminderDate: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

breedingRecordSchema.index({
    ownerId: 1,
    aiDate: -1
});

module.exports = mongoose.model(
    "BreedingRecord",
    breedingRecordSchema
);
