
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const BreedingRecord = require("../models/BreedingRecord");
const Cow = require("../models/Cow");
const auth = require("../middleware/auth");

router.use(auth);

// ========================================
// DATE VALIDATION
// ========================================

const isValidDate = (date) => {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
};

// ========================================
// ADD DAYS TO DATE
// ========================================

const addDays = (date, days) => {
    const result = new Date(`${date}T00:00:00.000Z`);

    result.setUTCDate(result.getUTCDate() + days);

    return result.toISOString().slice(0, 10);
};

// ========================================
// ADD MONTHS WITHOUT DATE OVERFLOW
// AI Date + 9 Months + 9 Days
// ========================================

const addMonthsClamped = (dateString, months) => {
    const date = new Date(`${dateString}T00:00:00.000Z`);

    const originalDay = date.getUTCDate();

    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);

    const lastDay = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            0
        )
    ).getUTCDate();

    date.setUTCDate(Math.min(originalDay, lastDay));

    return date.toISOString().slice(0, 10);
};

// ========================================
// CALCULATE REMINDER DATES
// ========================================

const calculateDates = (aiDate) => {
    if (!aiDate) {
        return {
            aiReminderDate: "",
            expectedCalvingDate: ""
        };
    }

    const aiReminderDate = addDays(aiDate, 21);

    const nineMonthsDate = addMonthsClamped(aiDate, 9);

    const expectedCalvingDate = addDays(nineMonthsDate, 9);

    return {
        aiReminderDate,
        expectedCalvingDate
    };
};

// ========================================
// RESET EMAIL REMINDER FLAGS
// ========================================

const resetReminderFlags = (record) => {
    record.aiEmailSent = false;
    record.heatEmailSent = false;
    record.calvingEmailSent = false;
    record.pregnancyTestEmailSent = false;
    record.calving15DayEmailSent = false;
    record.calving9DayEmailSent = false;
    record.calvingDueDayEmailSent = false;
    record.lastPregnancyReminderDate = null;
};

// ========================================
// UPDATE COW PREGNANCY STATUS
// ========================================

const updateCowStatus = async (cowId, ownerId, status) => {
    await Cow.findOneAndUpdate(
        {
            _id: cowId,
            ownerId
        },
        {
            $set: {
                pregnancyStatus: status
            }
        }
    );
};

// ========================================
// CHECK DATE FIELDS
// ========================================

const validateDates = (dates) => {
    for (const [label, date] of dates) {
        if (date !== "" && !isValidDate(date)) {
            return `${label} योग्य स्वरूपात भरा (YYYY-MM-DD).`;
        }
    }

    return null;
};

// ========================================
// GET ALL BREEDING RECORDS
// ========================================

router.get("/", async (req, res) => {
    try {
        const records = await BreedingRecord.find({
            ownerId: req.user.id
        })
            .populate(
                "cowId",
                "name cowTag breed pregnancyStatus photo"
            )
            .sort({ createdAt: -1 });

        res.json(records);
    } catch (error) {
        console.error("Get Breeding Records Error:", error);

        res.status(500).json({
            message: "Breeding Records मिळवताना त्रुटी आली."
        });
    }
});

// ========================================
// GET SINGLE BREEDING RECORD
// ========================================

router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Breeding Record ID योग्य नाही."
            });
        }

        const record = await BreedingRecord.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        }).populate(
            "cowId",
            "name cowTag breed pregnancyStatus photo"
        );

        if (!record) {
            return res.status(404).json({
                message: "Breeding Record सापडला नाही."
            });
        }

        res.json(record);
    } catch (error) {
        console.error("Get Breeding Record Error:", error);

        res.status(500).json({
            message: "Breeding Record मिळवता आला नाही."
        });
    }
});

// ========================================
// CREATE BREEDING RECORD
// ========================================

router.post("/", async (req, res) => {
    try {
        const {
            cowId,
            heatDate = "",
            aiDate = "",
            pregnancyStatus = "तपासणी बाकी",
            pregnancyCheckDate = ""
        } = req.body;

        if (!mongoose.isValidObjectId(cowId)) {
            return res.status(400).json({
                message: "कृपया योग्य गाय निवडा."
            });
        }

        const cow = await Cow.findOne({
            _id: cowId,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "निवडलेली गाय सापडली नाही."
            });
        }

        const dateError = validateDates([
            ["Heat Date", heatDate],
            ["AI Date", aiDate],
            ["Pregnancy Check Date", pregnancyCheckDate]
        ]);

        if (dateError) {
            return res.status(400).json({
                message: dateError
            });
        }

        const dates = calculateDates(aiDate);

        const record = await BreedingRecord.create({
            ownerId: req.user.id,
            cowId,
            heatDate,
            aiDate,
            ...dates,
            pregnancyStatus,
            pregnancyCheckDate
        });

        await updateCowStatus(
            cowId,
            req.user.id,
            pregnancyStatus
        );

        res.status(201).json({
            message: "Breeding Record यशस्वीरित्या जतन झाला.",
            record
        });
    } catch (error) {
        console.error("Add Breeding Record Error:", error);

        res.status(500).json({
            message: "Breeding Record जतन करताना त्रुटी आली."
        });
    }
});

// ========================================
// UPDATE BREEDING RECORD
// ========================================

router.put("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Breeding Record ID योग्य नाही."
            });
        }

        const record = await BreedingRecord.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!record) {
            return res.status(404).json({
                message: "Breeding Record सापडला नाही."
            });
        }

        const oldCowId = record.cowId.toString();

        const newCowId = req.body.cowId || oldCowId;

        if (!mongoose.isValidObjectId(newCowId)) {
            return res.status(400).json({
                message: "कृपया योग्य गाय निवडा."
            });
        }

        const cow = await Cow.findOne({
            _id: newCowId,
            ownerId: req.user.id
        });

        if (!cow) {
            return res.status(404).json({
                message: "निवडलेली गाय सापडली नाही."
            });
        }

        const heatDate =
            req.body.heatDate ?? record.heatDate;

        const aiDate =
            req.body.aiDate ?? record.aiDate;

        const pregnancyStatus =
            req.body.pregnancyStatus ?? record.pregnancyStatus;

        const pregnancyCheckDate =
            req.body.pregnancyCheckDate ??
            record.pregnancyCheckDate;

        const dateError = validateDates([
            ["Heat Date", heatDate],
            ["AI Date", aiDate],
            ["Pregnancy Check Date", pregnancyCheckDate]
        ]);

        if (dateError) {
            return res.status(400).json({
                message: dateError
            });
        }

        const aiDateChanged = aiDate !== record.aiDate;
        const cowChanged = newCowId !== oldCowId;

        record.cowId = newCowId;
        record.heatDate = heatDate;
        record.aiDate = aiDate;
        record.pregnancyStatus = pregnancyStatus;
        record.pregnancyCheckDate = pregnancyCheckDate;

        Object.assign(record, calculateDates(aiDate));

        // AI Date बदलल्यास जुने reminder flags reset करा.
        if (aiDateChanged) {
            resetReminderFlags(record);
        }

        await record.save();

        await updateCowStatus(
            newCowId,
            req.user.id,
            pregnancyStatus
        );

        // गाय बदलली असल्यास जुन्या गायीचा status
        // तिच्या नवीनतम Breeding Record नुसार ठरवा.
        if (cowChanged) {
            const latestOldRecord = await BreedingRecord.findOne({
                ownerId: req.user.id,
                cowId: oldCowId
            }).sort({ createdAt: -1 });

            await updateCowStatus(
                oldCowId,
                req.user.id,
                latestOldRecord
                    ? latestOldRecord.pregnancyStatus
                    : "तपासणी बाकी"
            );
        }

        res.json({
            message: "Breeding Record यशस्वीरित्या Update झाला.",
            record
        });
    } catch (error) {
        console.error("Update Breeding Record Error:", error);

        res.status(500).json({
            message: "Breeding Record Update करताना त्रुटी आली."
        });
    }
});

// ========================================
// DELETE BREEDING RECORD
// ========================================

router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Breeding Record ID योग्य नाही."
            });
        }

        const record = await BreedingRecord.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!record) {
            return res.status(404).json({
                message: "Breeding Record सापडला नाही."
            });
        }

        const cowId = record.cowId.toString();

        await record.deleteOne();

        const latestRecord = await BreedingRecord.findOne({
            ownerId: req.user.id,
            cowId
        }).sort({ createdAt: -1 });

        await updateCowStatus(
            cowId,
            req.user.id,
            latestRecord
                ? latestRecord.pregnancyStatus
                : "तपासणी बाकी"
        );

        res.json({
            message: "Breeding Record यशस्वीरित्या Delete झाला."
        });
    } catch (error) {
        console.error("Delete Breeding Record Error:", error);

        res.status(500).json({
            message: "Breeding Record Delete करताना त्रुटी आली."
        });
    }
});

module.exports = router;
