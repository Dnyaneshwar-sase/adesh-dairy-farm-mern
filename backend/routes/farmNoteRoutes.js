
const express = require("express");
const mongoose = require("mongoose");

const FarmNote = require("../models/FarmNote");
const auth = require("../middleware/auth");

const router = express.Router();

// सर्व routes साठी Login आणि approved account आवश्यक
router.use(auth);

// ==========================================
// 1. स्वतःच्या सर्व Notes मिळवा
// GET /api/farm-notes
// ==========================================
router.get("/", async (req, res) => {
    try {
        const notes = await FarmNote.find({
            ownerId: req.user.id
        }).sort({ createdAt: -1 });

        return res.status(200).json(notes);
    } catch (error) {
        console.error("Fetch Farm Notes Error:", error.message);

        return res.status(500).json({
            message: "Notes मिळवताना समस्या आली."
        });
    }
});

// ==========================================
// 2. नवीन Note Save करा
// POST /api/farm-notes
// ==========================================
router.post("/", async (req, res) => {
    try {
        const { title, content } = req.body;

        if (
            typeof title !== "string" ||
            typeof content !== "string" ||
            !title.trim() ||
            !content.trim()
        ) {
            return res.status(400).json({
                message: "कृपया Note चे नाव आणि माहिती लिहा."
            });
        }

        const note = await FarmNote.create({
            ownerId: req.user.id,
            title: title.trim(),
            content: content.trim()
        });

        return res.status(201).json({
            message: "Note यशस्वीपणे Save झाली!",
            note
        });
    } catch (error) {
        console.error("Save Farm Note Error:", error.message);

        return res.status(500).json({
            message: "Note Save करताना समस्या आली."
        });
    }
});

// ==========================================
// 3. स्वतःची Note Delete करा
// DELETE /api/farm-notes/:id
// ==========================================
router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Note ID चुकीची आहे."
            });
        }

        const note = await FarmNote.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!note) {
            return res.status(404).json({
                message: "Note सापडली नाही किंवा तुम्हाला ती Delete करण्याची परवानगी नाही."
            });
        }

        return res.status(200).json({
            message: "Note Delete झाली."
        });
    } catch (error) {
        console.error("Delete Farm Note Error:", error.message);

        return res.status(500).json({
            message: "Note Delete करताना समस्या आली."
        });
    }
});

module.exports = router;
