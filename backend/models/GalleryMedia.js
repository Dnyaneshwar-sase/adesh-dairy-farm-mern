
const mongoose = require("mongoose");

const galleryMediaSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: "",
            trim: true
        },
        mediaType: {
            type: String,
            enum: ["image", "video"],
            required: true
        },
        filename: {
            type: String,
            required: true
        },
        filePath: {
            type: String,
            required: true
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("GalleryMedia", galleryMediaSchema);
