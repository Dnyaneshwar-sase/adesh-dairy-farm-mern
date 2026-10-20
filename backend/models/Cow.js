
const mongoose = require("mongoose");

const cowSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        cowTag: {
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

        pregnancyStatus: {
            type: String,
            default: "Not Pregnant"
        },

        photo: {
            type: String,
            default: "/images/default-cow.png"
        }
    },
    {
        timestamps: true
    }
);

// एका Owner च्या दोन गायींचा Tag Number सारखा नसावा.
cowSchema.index(
    { ownerId: 1, cowTag: 1 },
    { unique: true }
);

module.exports = mongoose.model("Cow", cowSchema);
