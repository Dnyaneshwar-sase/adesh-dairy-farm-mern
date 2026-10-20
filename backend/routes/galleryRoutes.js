
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const GalleryMedia = require("../models/GalleryMedia");
const ownerAuth = require("../middleware/ownerAuth");

const router = express.Router();

// Upload folder path
const uploadDir = path.join(__dirname, "..", "uploads", "gallery");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

        cb(null, uniqueName);
    }
});

const allowedExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".webm", ".mov"
]);

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isImage = file.mimetype.startsWith("image/");
        const isVideo = file.mimetype.startsWith("video/");

        if (allowedExtensions.has(ext) && (isImage || isVideo)) {
            return cb(null, true);
        }

        cb(new Error("फक्त समर्थित फोटो किंवा व्हिडिओ अपलोड करा."));
    }
});

// Public Gallery: Login आवश्यक नाही
router.get("/", async (req, res) => {
    try {
        const media = await GalleryMedia.find()
            .select("-__v")
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            media: media.map(item => ({
                ...item,
                url: `/uploads/gallery/${encodeURIComponent(item.filename)}`
            }))
        });
    } catch (error) {
        console.error("Gallery Fetch Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Gallery मिळवता आली नाही."
        });
    }
});

// Upload: फक्त Owner
router.post(
    "/upload",
    ownerAuth,
    upload.single("media"),
    async (req, res) => {
        let savedPath;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "फोटो किंवा व्हिडिओ निवडा."
                });
            }

            savedPath = req.file.path;

            const { title, description } = req.body;

            if (!title || !title.trim()) {
                fs.unlink(savedPath, () => {});
                return res.status(400).json({
                    success: false,
                    message: "शीर्षक आवश्यक आहे."
                });
            }

            const mediaType = req.file.mimetype.startsWith("video/")
                ? "video"
                : "image";

            const item = await GalleryMedia.create({
                title: title.trim(),
                description: description?.trim() || "",
                mediaType,
                filename: req.file.filename,
                filePath: `/uploads/gallery/${req.file.filename}`,
                uploadedBy: req.user.id
            });

            res.status(201).json({
                success: true,
                message: "फाइल यशस्वीपणे अपलोड झाली.",
                media: {
                    id: item._id,
                    title: item.title,
                    description: item.description,
                    mediaType: item.mediaType,
                    url: item.filePath,
                    createdAt: item.createdAt
                }
            });
        } catch (error) {
            if (savedPath) {
                fs.unlink(savedPath, () => {});
            }

            console.error("Gallery Upload Error:", error.message);
            res.status(500).json({
                success: false,
                message: "फाइल अपलोड करता आली नाही."
            });
        }
    }
);

// Delete: फक्त Owner
router.delete("/:id", ownerAuth, async (req, res) => {
    try {
        const item = await GalleryMedia.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Gallery मधील फाइल सापडली नाही."
            });
        }

        // उपलब्ध local storage मधील फाइलही हटवण्याचा प्रयत्न
        const filePath = path.join(uploadDir, path.basename(item.filename));

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await GalleryMedia.findByIdAndDelete(item._id);

        res.json({
            success: true,
            message: "Gallery मधील फाइल Delete झाली."
        });
    } catch (error) {
        console.error("Gallery Delete Error:", error.message);

        res.status(400).json({
            success: false,
            message: "फाइल Delete करता आली नाही."
        });
    }
});

// Upload साठी Multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "फाइलचा आकार 100 MB पेक्षा कमी असावा."
            : "फाइल अपलोड करताना समस्या आली.";

        return res.status(400).json({
            success: false,
            message
        });
    }

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "अपलोड अयशस्वी."
        });
    }

    next();
});

module.exports = router;
