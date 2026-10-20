
const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const Cow = require("../models/Cow");
const ownerAuth = require("../middleware/ownerAuth");
const auth = require("../middleware/auth");

// फोटो upload करण्याची सेटिंग
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const uniqueName =
            "cow-" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            extension;

        cb(null, uniqueName);
    }
});

// फक्त image files स्वीकारा
const imageFilter = (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("कृपया फक्त फोटो निवडा."));
    }
};

const upload = multer({
    storage,
    fileFilter: imageFilter
});

// सर्व routes साठी Login आणि Owner authentication आवश्यक
router.use(auth);


// ==========================================
// 1. सर्व गायी मिळवा
// GET /api/cows
// ==========================================
router.get("/", async (req, res) => {
    try {
        const cows = await Cow.find({
            ownerId: req.user.id
        }).sort({ createdAt: -1 });

        res.json(cows);
    } catch (error) {
        console.error("Get Cows Error:", error.message);

        res.status(500).json({
            message: "गायींची यादी मिळवताना समस्या आली."
        });
    }
});


// ==========================================
// 2. एका गायीची माहिती मिळवा
// GET /api/cows/:id
// ==========================================
router.get("/:id", async (req, res) => {
    try {
        const cow = await Cow.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "गाय सापडली नाही."
            });
        }

        res.json(cow);
    } catch (error) {
        console.error("Get Cow Error:", error.message);

        res.status(400).json({
            message: "गायीची माहिती मिळवता आली नाही."
        });
    }
});


// ==========================================
// 3. नवीन गाय जोडा
// POST /api/cows
// ==========================================
router.post("/", upload.single("photoFile"), async (req, res) => {
    try {
        const {
            cowTag,
            name,
            breed,
            dateOfBirth,
            healthStatus
        } = req.body;

        if (!cowTag || !cowTag.trim()) {
            return res.status(400).json({
                message: "गाय ID / Tag Number भरणे आवश्यक आहे."
            });
        }

        const photo = req.file
            ? "/uploads/" + req.file.filename
            : "/images/default-cow.png";

        const cow = await Cow.create({
            ownerId: req.user.id,
            cowTag: cowTag.trim(),
            name: name || "",
            breed: breed || "",
            dateOfBirth: dateOfBirth || "",
            healthStatus: healthStatus || "निरोगी",
            pregnancyStatus: "Not Pregnant",
            photo: photo
        });

        res.status(201).json({
            message: "गाय यशस्वीरित्या जतन झाली.",
            cow: cow
        });

    } catch (error) {
        console.error("Add Cow Error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "हा Tag Number तुमच्या दुसऱ्या गायीला दिलेला आहे."
            });
        }

        res.status(500).json({
            message: "गाय जतन करताना समस्या आली."
        });
    }
});


// ==========================================
// 4. गायीची माहिती Update करा
// PUT /api/cows/:id
// ==========================================
router.put("/:id", upload.single("photoFile"), async (req, res) => {
    try {
        const cow = await Cow.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "गाय सापडली नाही किंवा परवानगी नाही."
            });
        }

        const {
            cowTag,
            name,
            breed,
            dateOfBirth,
            healthStatus
        } = req.body;

        if (!cowTag || !cowTag.trim()) {
            return res.status(400).json({
                message: "गाय ID / Tag Number भरणे आवश्यक आहे."
            });
        }

        // फक्त निवडलेल्या गायीची माहिती बदला
        cow.cowTag = cowTag.trim();
        cow.name = name || "";
        cow.breed = breed || "";
        cow.dateOfBirth = dateOfBirth || "";
        cow.healthStatus = healthStatus || "निरोगी";

        // नवीन फोटो दिला असेल तरच फोटोचा path बदला.
        // नवीन फोटो नसेल तर जुना फोटो कायम राहील.
        if (req.file) {
            cow.photo = "/uploads/" + req.file.filename;
        }

        // pregnancyStatus इथे बदलत नाही; जुनी स्थिती कायम राहते.
        await cow.save();

        res.json({
            message: "गायीची माहिती यशस्वीरित्या Update झाली.",
            cow: cow
        });

    } catch (error) {
        console.error("Update Cow Error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "हा Tag Number तुमच्या दुसऱ्या गायीला दिलेला आहे."
            });
        }

        res.status(500).json({
            message: "गायीची माहिती Update करताना समस्या आली."
        });
    }
});


// ==========================================
// 5. गाय Delete करा
// DELETE /api/cows/:id
// ==========================================
router.delete("/:id", async (req, res) => {
    try {
        const cow = await Cow.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "गाय सापडली नाही किंवा परवानगी नाही."
            });
        }

        res.json({
            message: "गाय यशस्वीरित्या Delete झाली."
        });

    } catch (error) {
        console.error("Delete Cow Error:", error.message);

        res.status(400).json({
            message: "गाय Delete करता आली नाही."
        });
    }
});

module.exports = router;
