
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const FinancialRecord = require("../models/FinancialRecord");
const auth = require("../middleware/auth");

// Login केलेल्या आणि approved Owner/User साठी प्रवेश
router.use(auth);

// ==========================================
// 1. सर्व आर्थिक नोंदी मिळवा
// GET /api/financial-records
// ==========================================
router.get("/", async (req, res) => {
    try {
        const records = await FinancialRecord.find({
            ownerId: req.user.id
        }).sort({ date: -1, createdAt: -1 });

        return res.json(records);
    } catch (error) {
        console.error("Get Financial Records Error:", error.message);

        return res.status(500).json({
            message: "आर्थिक नोंदी मिळवताना समस्या आली."
        });
    }
});

// ==========================================
// 2. उत्पन्न, खर्च आणि नफा/तोटा
// GET /api/financial-records/summary
// ==========================================
router.get("/summary", async (req, res) => {
    try {
        const result = await FinancialRecord.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(req.user.id)
                }
            },
            {
                $group: {
                    _id: "$type",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const income = result.find(item => item._id === "income");
        const expense = result.find(item => item._id === "expense");

        const totalIncome = income ? income.total : 0;
        const totalExpense = expense ? expense.total : 0;

        return res.json({
            totalIncome,
            totalExpense,
            profitLoss: totalIncome - totalExpense,
            totalRecords: result.reduce(
                (sum, item) => sum + item.count,
                0
            )
        });
    } catch (error) {
        console.error("Financial Summary Error:", error.message);

        return res.status(500).json({
            message: "आर्थिक हिशोब मिळवताना समस्या आली."
        });
    }
});

// ==========================================
// 3. नवीन उत्पन्न किंवा खर्च नोंदवा
// POST /api/financial-records
// ==========================================
router.post("/", async (req, res) => {
    try {
        const {
            type,
            category,
            amount,
            date,
            description,
            paymentMethod
        } = req.body;

        if (!["income", "expense"].includes(type)) {
            return res.status(400).json({
                message: "उत्पन्न किंवा खर्चाचा योग्य प्रकार निवडा."
            });
        }

        if (
            typeof category !== "string" ||
            !category.trim()
        ) {
            return res.status(400).json({
                message: "कृपया प्रकार / कारण भरा."
            });
        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                message: "रक्कम शून्यापेक्षा जास्त असावी."
            });
        }

        const recordDate = date ? new Date(date) : new Date();

        if (Number.isNaN(recordDate.getTime())) {
            return res.status(400).json({
                message: "कृपया योग्य तारीख निवडा."
            });
        }

        const record = await FinancialRecord.create({
            ownerId: req.user.id,
            type,
            category: category.trim(),
            amount: numericAmount,
            date: recordDate,
            description: description || "",
            paymentMethod: paymentMethod || "cash"
        });

        return res.status(201).json({
            message: "आर्थिक नोंद यशस्वीरित्या जतन झाली.",
            record
        });
    } catch (error) {
        console.error("Add Financial Record Error:", error.message);

        return res.status(500).json({
            message: "नोंद जतन करताना समस्या आली."
        });
    }
});

// ==========================================
// 4. आर्थिक नोंद Update करा
// PUT /api/financial-records/:id
// ==========================================
router.put("/:id", async (req, res) => {
    try {
        const {
            type,
            category,
            amount,
            date,
            description,
            paymentMethod
        } = req.body;

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "नोंदीचा ID योग्य नाही."
            });
        }

        if (
            type !== undefined &&
            !["income", "expense"].includes(type)
        ) {
            return res.status(400).json({
                message: "नोंदीचा प्रकार योग्य नाही."
            });
        }

        if (
            category !== undefined &&
            (typeof category !== "string" || !category.trim())
        ) {
            return res.status(400).json({
                message: "प्रकार / कारण रिकामे ठेवू नका."
            });
        }

        if (
            amount !== undefined &&
            (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
        ) {
            return res.status(400).json({
                message: "रक्कम शून्यापेक्षा जास्त असावी."
            });
        }

        if (
            date !== undefined &&
            Number.isNaN(new Date(date).getTime())
        ) {
            return res.status(400).json({
                message: "तारीख योग्य नाही."
            });
        }

        const updates = {};

        if (type !== undefined) updates.type = type;
        if (category !== undefined) updates.category = category.trim();
        if (amount !== undefined) updates.amount = Number(amount);
        if (date !== undefined) updates.date = new Date(date);
        if (description !== undefined) updates.description = description;
        if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;

        const record = await FinancialRecord.findOneAndUpdate(
            {
                _id: req.params.id,
                ownerId: req.user.id
            },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!record) {
            return res.status(404).json({
                message: "नोंद सापडली नाही."
            });
        }

        return res.json({
            message: "नोंद यशस्वीरित्या Update झाली.",
            record
        });
    } catch (error) {
        console.error("Update Financial Record Error:", error.message);

        return res.status(500).json({
            message: "नोंद Update करताना समस्या आली."
        });
    }
});

// ==========================================
// 5. आर्थिक नोंद Delete करा
// DELETE /api/financial-records/:id
// ==========================================
router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "नोंदीचा ID योग्य नाही."
            });
        }

        const record = await FinancialRecord.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.id
        });

        if (!record) {
            return res.status(404).json({
                message: "नोंद सापडली नाही."
            });
        }

        return res.json({
            message: "नोंद यशस्वीरित्या Delete झाली."
        });
    } catch (error) {
        console.error("Delete Financial Record Error:", error.message);

        return res.status(500).json({
            message: "नोंद Delete करताना समस्या आली."
        });
    }
});

module.exports = router;
