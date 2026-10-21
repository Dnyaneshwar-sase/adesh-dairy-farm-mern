
const express = require("express");
const multer = require("multer");
const path = require("path");

const GalleryMedia = require("../models/GalleryMedia");
const ownerAuth = require("../middleware/ownerAuth");

const router = express.Router();

const allowedExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".webm", ".mov"
]);

// फोटो किंवा व्हिडिओ server disk वर न ठेवता memory मध्ये घ्या.
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

        return cb(
            new Error("फक्त समर्थित फोटो किंवा व्हिडिओ अपलोड करा.")
        );
    }
});

// Public Gallery — कोणालाही पाहता येईल
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
                url: item.filePath || ""
            }))
        });
    } catch (error) {
        console.error("Gallery Fetch Error:", error);

        res.status(500).json({
            success: false,
            message: "Gallery मिळवता आली नाही."
        });
    }
});

// Upload — फक्त मंजूर Owner
router.post("/upload", ownerAuth, (req, res, next) => {
    upload.single("media")(req, res, error => {
        if (error) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "फोटो किंवा व्हिडिओचा आकार 4 MB पेक्षा कमी असावा."
                    : error.message || "फाइल Upload करता आली नाही.";

            return res.status(400).json({
                success: false,
                message
            });
        }

        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "फोटो किंवा व्हिडिओ निवडा."
            });
        }

        const { title, description } = req.body;

        if (typeof title !== "string" || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "शीर्षक आवश्यक आहे."
            });
        }

        const mediaType = req.file.mimetype.startsWith("video/")
            ? "video"
            : "image";

        // फाइलचे bytes Base64 मध्ये रूपांतरित करून MongoDB मध्ये ठेवा.
        const base64 = req.file.buffer.toString("base64");
        const filePath = `data:${req.file.mimetype};base64,${base64}`;

        const item = await GalleryMedia.create({
            title: title.trim(),
            description:
                typeof description === "string"
                    ? description.trim()
                    : "",
            mediaType,
            filename: req.file.originalname,
            filePath,
            uploadedBy: req.user.id
        });

        return res.status(201).json({
            success: true,
            message: "फोटो किंवा व्हिडिओ यशस्वीपणे Save झाला.",
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
        console.error("Gallery Upload Error:", error);

        return res.status(500).json({
            success: false,
            message: "फाइल Save करता आली नाही. Backend logs तपासा."
        });
    }
});

// Delete — फक्त मंजूर Owner
router.delete("/:id", ownerAuth, async (req, res) => {
    try {
        const item = await GalleryMedia.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Gallery मधील फाइल सापडली नाही."
            });
        }

        await GalleryMedia.findByIdAndDelete(item._id);

        return res.json({
            success: true,
            message: "Gallery मधील फाइल Delete झाली."
        });
    } catch (error) {
        console.error("Gallery Delete Error:", error);

        return res.status(500).json({
            success: false,
            message: "फाइल Delete करता आली नाही."
        });
    }
});

module.exports = router;
