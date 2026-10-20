
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const GalleryMedia = require("../models/GalleryMedia");
const ownerAuth = require("../middleware/ownerAuth");
const cloudinary = require("../cloudinary");

const router = express.Router();

const allowedExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".webm", ".mov"
]);

// Vercel request-size मर्यादा लक्षात घेऊन 4 MB पर्यंत
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 4 * 1024 * 1024
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

// Memory मधून Cloudinary वर Upload
function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const resourceType = file.mimetype.startsWith("video/")
            ? "video"
            : "image";

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "adesh-dairy-gallery",
                resource_type: resourceType
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }

                resolve(result);
            }
        );

        stream.end(file.buffer);
    });
}

// Public Gallery
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
                // नवीन Cloudinary फाइलसाठी secure URL.
                // जुन्या local नोंदींसाठी जुना path.
                url: item.filePath && item.filePath.startsWith("https://")
                    ? item.filePath
                    : `/uploads/gallery/${encodeURIComponent(item.filename)}`
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
        let uploadedAsset;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "फोटो किंवा व्हिडिओ निवडा."
                });
            }

            const { title, description } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "शीर्षक आवश्यक आहे."
                });
            }

            uploadedAsset = await uploadToCloudinary(req.file);

            const mediaType = req.file.mimetype.startsWith("video/")
                ? "video"
                : "image";

            const item = await GalleryMedia.create({
                title: title.trim(),
                description: description?.trim() || "",
                mediaType,
                // Cloudinary public_id filename मध्ये साठवतो
                filename: uploadedAsset.public_id,
                filePath: uploadedAsset.secure_url,
                uploadedBy: req.user.id
            });

            res.status(201).json({
                success: true,
                message: "फाइल Cloudinary वर यशस्वीपणे अपलोड झाली.",
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
            // Database save अयशस्वी झाल्यास अपलोड केलेली फाइल हटवण्याचा प्रयत्न
            if (uploadedAsset?.public_id) {
                try {
                    await cloudinary.uploader.destroy(
                        uploadedAsset.public_id,
                        {
                            resource_type: uploadedAsset.resource_type || "image"
                        }
                    );
                } catch (cleanupError) {
                    console.error(
                        "Cloudinary Cleanup Error:",
                        cleanupError.message
                    );
                }
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

        // नवीन Cloudinary फाइल असल्यास Cloudinary मधून हटवा
        if (item.filePath && item.filePath.startsWith("https://")) {
            const result = await cloudinary.uploader.destroy(
                item.filename,
                {
                    resource_type: item.mediaType === "video"
                        ? "video"
                        : "image"
                }
            );

            if (result.result !== "ok" && result.result !== "not found") {
                return res.status(502).json({
                    success: false,
                    message: "Cloudinary मधील फाइल हटवता आली नाही."
                });
            }
        } else {
            // जुन्या local फाइलसाठी उपलब्ध असल्यासच हटवण्याचा प्रयत्न
            const uploadDir = path.join(
                __dirname,
                "..",
                "uploads",
                "gallery"
            );

            const localPath = path.join(
                uploadDir,
                path.basename(item.filename)
            );

            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        }

        await GalleryMedia.findByIdAndDelete(item._id);

        res.json({
            success: true,
            message: "Gallery मधील फाइल यशस्वीपणे Delete झाली."
        });
    } catch (error) {
        console.error("Gallery Delete Error:", error.message);

        res.status(500).json({
            success: false,
            message: "फाइल Delete करता आली नाही."
        });
    }
});

// Multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "फाइलचा आकार 4 MB पेक्षा कमी असावा."
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
