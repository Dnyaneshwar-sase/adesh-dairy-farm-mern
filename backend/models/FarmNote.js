
const mongoose = require("mongoose");

const farmNoteSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        title: {
            type: String,
            required: [true, "Note चे नाव आवश्यक आहे"],
            trim: true,
            maxlength: 255
        },

        content: {
            type: String,
            required: [true, "Note ची माहिती आवश्यक आहे"],
            trim: true
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false
        }
    }
);

module.exports = mongoose.model("FarmNote", farmNoteSchema);
