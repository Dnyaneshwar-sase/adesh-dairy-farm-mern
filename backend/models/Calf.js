
const mongoose = require("mongoose");

const calfSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        calfTag: {
            type: String,
            required: true,
            trim: true
        },

        name: {
            type: String,
            trim: true,
            default: ""
        },

        breed: {
            type: String,
            trim: true,
            default: ""
        },

        dateOfBirth: {
            type: String,
            default: ""
        },

        healthStatus: {
            type: String,
            default: "Healthy"
        },

        motherCowTag: {
            type: String,
            trim: true,
            default: ""
        },

        photo: {
            type: String,
            default: "/images/default-calf.png"
        }
    },
    {
        timestamps: true
    }
);

// एका Owner च्या दोन वासरांचे Tag Number सारखे नसावेत.
calfSchema.index(
    { ownerId: 1, calfTag: 1 },
    { unique: true }
);

module.exports = mongoose.model("Calf", calfSchema);
