
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Calf = require("../models/Calf");
const ownerAuth = require("../middleware/ownerAuth");

const router = express.Router();

// Backend uploads folder तयार करणे
const uploadDir = path.join(__dirname, "../uploads");



// फोटो कोणत्या नावाने आणि कुठे Save करायचा
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const uniqueName =
            "calf-" + Date.now() + "-" +
            Math.round(Math.random() * 1e9) + extension;

        cb(null, uniqueName);
    }
});

// फक्त Image files स्वीकारणे
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("कृपया योग्य Image फाइल निवडा."));
        }
    }
});

// सर्व वासरांची माहिती आणि एकूण संख्या
router.get("/", ownerAuth, async (req, res) => {
    try {
        const ownerId = req.user.id;

        const calves = await Calf.find({ ownerId })
            .sort({ createdAt: -1 });

        res.json({
            totalCalves: calves.length,
            calves
        });
    } catch (error) {
        console.error("Fetch Calves Error:", error.message);

        res.status(500).json({
            message: "वासरांची माहिती मिळवताना समस्या आली."
        });
    }
});

// नवीन वासराची नोंद आणि फोटो Upload
router.post("/", ownerAuth, (req, res, next) => {
    upload.single("photo")(req, res, (error) => {
        if (error) {
            if (error instanceof multer.MulterError) {
                const message = error.code === "LIMIT_FILE_SIZE"
                    ? "फोटोचा आकार 5 MB पेक्षा कमी असावा."
                    : "फोटो Upload करताना समस्या आली.";

                return res.status(400).json({ message });
            }

            return res.status(400).json({
                message: error.message || "फोटो योग्य नाही."
            });
        }

        next();
    });
}, async (req, res) => {
    try {
        const {
            calfTag,
            name,
            breed,
            dateOfBirth,
            healthStatus,
            motherCowTag
        } = req.body;

        if (
            typeof calfTag !== "string" ||
            !calfTag.trim()
        ) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }

            return res.status(400).json({
                message: "वासराचा Tag Number आवश्यक आहे."
            });
        }

        // फोटो निवडला नसेल तर Default फोटोचा path
        const photo = req.file
            ? `/uploads/${req.file.filename}`
            : "images/.default-calf.png";

        const calf = await Calf.create({
            ownerId: req.user.id,
            calfTag: calfTag.trim(),
            name,
            breed,
            dateOfBirth,
            healthStatus,
            motherCowTag,
            photo
        });

        res.status(201).json({
            message: "वासराची नोंद यशस्वी झाली!",
            calf
        });
    } catch (error) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        if (error.code === 11000) {
            return res.status(409).json({
                message: "हा Tag Number आधीपासून नोंदवलेला आहे."
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: "वासराची माहिती तपासा."
            });
        }

        console.error("Create Calf Error:", error.message);

        res.status(500).json({
            message: "वासराची नोंद करताना समस्या आली."
        });
    }
});

// वासराची नोंद Delete करणे
router.delete("/:id", ownerAuth, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "वासराची ID चुकीची आहे."
            });
        }

        const calf = await Calf.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!calf) {
            return res.status(404).json({
                message: "वासराची नोंद सापडली नाही."
            });
        }

        res.json({
            message: "वासराची नोंद Delete झाली."
        });
    } catch (error) {
        console.error("Delete Calf Error:", error.message);

        res.status(500).json({
            message: "वासराची नोंद Delete करताना समस्या आली."
        });
    }
});

module.exports = router;
