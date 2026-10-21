
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const Calf = require("../models/Calf");
const ownerAuth = require("../middleware/ownerAuth");

const router = express.Router();

// फोटो server च्या disk वर न ठेवता memory मध्ये घ्या.
const upload = multer({
    storage: multer.memoryStorage(),
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

// सर्व वासरांची माहिती
router.get("/", ownerAuth, async (req, res) => {
    try {
        const calves = await Calf.find({
            ownerId: req.user.id
        }).sort({ createdAt: -1 });

        res.json({
            totalCalves: calves.length,
            calves
        });
    } catch (error) {
        console.error("Fetch Calves Error:", error);

        res.status(500).json({
            message: "वासरांची माहिती मिळवताना समस्या आली."
        });
    }
});

// नवीन वासराची नोंद
router.post("/", ownerAuth, (req, res, next) => {
    upload.single("photo")(req, res, (error) => {
        if (error) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "फोटोचा आकार 5 MB पेक्षा कमी असावा."
                    : error.message || "फोटो Upload करताना समस्या आली.";

            return res.status(400).json({ message });
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
            return res.status(400).json({
                message: "वासराचा Tag Number आवश्यक आहे."
            });
        }

        // फोटो MongoDB मध्ये Data URL स्वरूपात साठवा.
        let photo = "/images/default-calf.png";

        if (req.file) {
            const mimeType = req.file.mimetype;
            const base64 = req.file.buffer.toString("base64");

            photo = `data:${mimeType};base64,${base64}`;
        }

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

        return res.status(201).json({
            message: "वासराची नोंद यशस्वी झाली!",
            calf
        });

    } catch (error) {
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

        console.error("Create Calf Error:", error);

        return res.status(500).json({
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

        return res.json({
            message: "वासराची नोंद Delete झाली."
        });

    } catch (error) {
        console.error("Delete Calf Error:", error);

        return res.status(500).json({
            message: "वासराची नोंद Delete करताना समस्या आली."
        });
    }
});

module.exports = router;
