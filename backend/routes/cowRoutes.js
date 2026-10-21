
const express = require("express");
const multer = require("multer");
const Cow = require("../models/Cow");
const auth = require("../middleware/auth");

const router = express.Router();

// Protect all cow routes
router.use(auth);

// Vercel-compatible photo upload using memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed"), false);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter
});

// Convert uploaded image to Base64
const getPhotoData = (file) => {
    if (!file) return null;

    const mimeType = file.mimetype;
    const base64 = file.buffer.toString("base64");

    return `data:${mimeType};base64,${base64}`;
};

// GET: Get all cows for logged-in owner
router.get("/", async (req, res) => {
    try {
        const cows = await Cow.find({
            ownerId: req.user.id
        }).sort({ createdAt: -1 });

        return res.status(200).json(cows);
    } catch (error) {
        console.error("Get cows error:", error);
        return res.status(500).json({
            message: "Failed to fetch cows",
            error: error.message
        });
    }
});

// GET: Get one cow
router.get("/:id", async (req, res) => {
    try {
        const cow = await Cow.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "Cow not found"
            });
        }

        return res.status(200).json(cow);
    } catch (error) {
        console.error("Get cow error:", error);
        return res.status(500).json({
            message: "Failed to fetch cow",
            error: error.message
        });
    }
});

// POST: Add new cow
router.post("/", upload.single("photoFile"), async (req, res) => {
    try {
        const {
            cowTag,
            name,
            breed,
            dateOfBirth,
            healthStatus,
            pregnancyStatus
        } = req.body;

        if (!cowTag || !cowTag.trim()) {
            return res.status(400).json({
                message: "Cow tag is required"
            });
        }

        const existingCow = await Cow.findOne({
            ownerId: req.user.id,
            cowTag: cowTag.trim()
        });

        if (existingCow) {
            return res.status(409).json({
                message: "This cow tag already exists"
            });
        }

        const photo =
            getPhotoData(req.file) || "/images/default-cow.png";

        const cow = await Cow.create({
            ownerId: req.user.id,
            cowTag: cowTag.trim(),
            name: name || "",
            breed: breed || "",
            dateOfBirth: dateOfBirth || null,
            healthStatus: healthStatus || "निरोगी",
            pregnancyStatus: pregnancyStatus || "Not Pregnant",
            photo
        });

        return res.status(201).json({
            message: "Cow added successfully",
            cow
        });
    } catch (error) {
        console.error("Add cow error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This cow tag already exists"
            });
        }

        return res.status(500).json({
            message: "Failed to add cow",
            error: error.message
        });
    }
});

// PUT: Update cow
router.put("/:id", upload.single("photoFile"), async (req, res) => {
    try {
        const {
            cowTag,
            name,
            breed,
            dateOfBirth,
            healthStatus,
            pregnancyStatus
        } = req.body;

        const updateData = {};

        if (cowTag !== undefined) updateData.cowTag = cowTag.trim();
        if (name !== undefined) updateData.name = name;
        if (breed !== undefined) updateData.breed = breed;
        if (dateOfBirth !== undefined) {
            updateData.dateOfBirth = dateOfBirth || null;
        }
        if (healthStatus !== undefined) {
            updateData.healthStatus = healthStatus;
        }
        if (pregnancyStatus !== undefined) {
            updateData.pregnancyStatus = pregnancyStatus;
        }

        // Update photo only when a new photo is uploaded
        if (req.file) {
            updateData.photo = getPhotoData(req.file);
        }

        const cow = await Cow.findOneAndUpdate(
            {
                _id: req.params.id,
                ownerId: req.user.id
            },
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        );

        if (!cow) {
            return res.status(404).json({
                message: "Cow not found"
            });
        }

        return res.status(200).json({
            message: "Cow updated successfully",
            cow
        });
    } catch (error) {
        console.error("Update cow error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This cow tag already exists"
            });
        }

        return res.status(500).json({
            message: "Failed to update cow",
            error: error.message
        });
    }
});

// DELETE: Delete cow
router.delete("/:id", async (req, res) => {
    try {
        const cow = await Cow.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "Cow not found"
            });
        }

        return res.status(200).json({
            message: "Cow deleted successfully"
        });
    } catch (error) {
        console.error("Delete cow error:", error);

        return res.status(500).json({
            message: "Failed to delete cow",
            error: error.message
        });
    }
});

// Handle upload errors
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            message:
                err.code === "LIMIT_FILE_SIZE"
                    ? "Image size must be 5 MB or less"
                    : err.message
        });
    }

    if (err) {
        return res.status(400).json({
            message: err.message || "File upload failed"
        });
    }

    next();
});

module.exports = router;
