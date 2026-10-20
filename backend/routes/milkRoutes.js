
const express = require("express");
const router = express.Router();

const MilkRecord = require("../models/MilkRecord");
const auth = require("../middleware/auth");

// सर्व Milk Records मिळवणे
// फक्त Login केलेल्या आणि मंजूर User ला प्रवेश
router.get("/", auth, async (req, res) => {
    try {
        const records = await MilkRecord.find({
            ownerId: req.user.id
        }).sort({ date: -1, createdAt: -1 });

        res.status(200).json(records);
    } catch (error) {
        console.error("Get Milk Records Error:", error);

        res.status(500).json({
            message: "Milk Records मिळवताना त्रुटी आली."
        });
    }
});

// नवीन Milk Record सेव्ह करणे
// Milk Records पेजवर दर भरणे आवश्यक नाही.
router.post("/", auth, async (req, res) => {
    try {
        const { date, morningMilk, eveningMilk } = req.body;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "कृपया योग्य तारीख निवडा."
            });
        }

        const morning = Number(morningMilk);
        const evening = Number(eveningMilk);

        if (
            morningMilk === undefined ||
            eveningMilk === undefined ||
            morningMilk === "" ||
            eveningMilk === "" ||
            !Number.isFinite(morning) ||
            !Number.isFinite(evening) ||
            morning < 0 ||
            evening < 0
        ) {
            return res.status(400).json({
                message: "सकाळचे आणि संध्याकाळचे दूध योग्य प्रमाणात भरा."
            });
        }

        const totalMilk = Number(
            (morning + evening).toFixed(2)
        );

        const record = await MilkRecord.create({
            ownerId: req.user.id,
            date,
            morningMilk: morning,
            eveningMilk: evening,
            totalMilk
        });

        res.status(201).json({
            message: "दूध रेकॉर्ड यशस्वीरित्या सेव्ह झाले.",
            record
        });
    } catch (error) {
        console.error("Save Milk Record Error:", error);

        res.status(500).json({
            message: "दूध रेकॉर्ड सेव्ह करताना त्रुटी आली."
        });
    }
});

// Reports पेजवरून एका दिवसाचा दूध दर सेव्ह करणे
router.put("/rate", auth, async (req, res) => {
    try {
        const { date, milkRate } = req.body;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "कृपया योग्य तारीख निवडा."
            });
        }

        if (
            milkRate === undefined ||
            milkRate === "" ||
            !Number.isFinite(Number(milkRate)) ||
            Number(milkRate) < 0
        ) {
            return res.status(400).json({
                message: "कृपया योग्य दूध विक्री दर भरा."
            });
        }

        const rate = Number(milkRate);

        // फक्त सध्याच्या User च्या त्या दिवसाच्या नोंदी
        const records = await MilkRecord.find({
            ownerId: req.user.id,
            date
        });

        if (records.length === 0) {
            return res.status(404).json({
                message: "या तारखेची दूध नोंद सापडली नाही."
            });
        }

        for (const record of records) {
            record.milkRate = rate;

            record.income = Number(
                (Number(record.totalMilk) * rate).toFixed(2)
            );

            await record.save();
        }

        res.status(200).json({
            message: "दूध दर आणि उत्पन्न यशस्वीरित्या सेव्ह झाले.",
            date,
            milkRate: rate,
            totalIncome: Number(
                records.reduce(
                    (sum, record) => sum + Number(record.income || 0),
                    0
                ).toFixed(2)
            )
        });
    } catch (error) {
        console.error("Save Milk Rate Error:", error);

        res.status(500).json({
            message: "दूध दर सेव्ह करताना त्रुटी आली."
        });
    }
});

module.exports = router;
