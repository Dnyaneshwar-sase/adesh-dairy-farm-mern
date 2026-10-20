
const express = require("express");
const mongoose = require("mongoose");
const Worker = require("../models/Worker");
const auth = require("../middleware/auth");

const router = express.Router();

// सर्व API साठी Owner Authentication
router.use(auth);

function getOwnerId(req) {
    return req.user?.id || req.user?._id;
}

// कामगारांची यादी आणि पगाराचा सारांश
router.get("/", async (req, res) => {
    try {
        const ownerId = getOwnerId(req);

        if (!ownerId) {
            return res.status(401).json({
                message: "Owner authentication required"
            });
        }

        const workers = await Worker.find({ ownerId })
            .sort({ createdAt: -1 })
            .lean();

        const month = Number(req.query.month) || new Date().getMonth() + 1;
        const year = Number(req.query.year) || new Date().getFullYear();

        const result = workers.map((worker) => {
            const payments = (worker.payments || []).filter(
                (payment) =>
                    payment.month === month &&
                    payment.year === year
            );

            const paidSalary = payments.reduce(
                (sum, payment) => sum + Number(payment.amount || 0),
                0
            );

            const expectedSalary =
                worker.salaryType === "Monthly"
                    ? Number(worker.monthlySalary || 0)
                    : payments.reduce(
                        (sum, payment) =>
                            sum +
                            Number(payment.workDays || 0) *
                            Number(worker.dailyWage || 0),
                        0
                    );

            return {
                ...worker,
                monthlySummary: {
                    expectedSalary,
                    paidSalary,
                    remainingSalary: Math.max(
                        0,
                        expectedSalary - paidSalary
                    )
                }
            };
        });

        const activeWorkers = result.filter(
            (worker) => worker.status === "Active"
        );

        res.json({
            workers: result,
            summary: {
                totalWorkers: result.length,
                activeWorkers: activeWorkers.length,
                expectedSalary: result.reduce(
                    (sum, worker) =>
                        sum + worker.monthlySummary.expectedSalary,
                    0
                ),
                paidSalary: result.reduce(
                    (sum, worker) =>
                        sum + worker.monthlySummary.paidSalary,
                    0
                ),
                remainingSalary: result.reduce(
                    (sum, worker) =>
                        sum + worker.monthlySummary.remainingSalary,
                    0
                ),
                month,
                year
            }
        });
    } catch (error) {
        console.error("Fetch workers error:", error);
        res.status(500).json({
            message: "कामगारांची माहिती मिळवता आली नाही."
        });
    }
});

// नवीन कामगार नोंदणी
router.post("/", async (req, res) => {
    try {
        const ownerId = getOwnerId(req);
        const {
            name,
            mobileNumber,
            workType,
            salaryType,
            monthlySalary,
            dailyWage,
            joiningDate,
            notes
        } = req.body;

        if (!name?.trim() || !workType?.trim()) {
            return res.status(400).json({
                message: "कामगाराचे नाव आणि कामाचा प्रकार आवश्यक आहे."
            });
        }

        if (!["Monthly", "Daily"].includes(salaryType)) {
            return res.status(400).json({
                message: "पगाराचा योग्य प्रकार निवडा."
            });
        }

        const salary = Number(
            salaryType === "Monthly" ? monthlySalary : dailyWage
        );

        if (!Number.isFinite(salary) || salary < 0) {
            return res.status(400).json({
                message: "पगाराची रक्कम योग्य भरा."
            });
        }

        const worker = await Worker.create({
            ownerId,
            name: name.trim(),
            mobileNumber,
            workType: workType.trim(),
            salaryType,
            monthlySalary:
                salaryType === "Monthly" ? salary : 0,
            dailyWage:
                salaryType === "Daily" ? salary : 0,
            joiningDate: joiningDate || undefined,
            notes
        });

        res.status(201).json({
            message: "कामगाराची नोंदणी यशस्वी झाली.",
            worker
        });
    } catch (error) {
        console.error("Create worker error:", error);
        res.status(500).json({
            message: "कामगाराची नोंदणी करता आली नाही."
        });
    }
});

// कामगाराची माहिती बदलणे
router.put("/:id", async (req, res) => {
    try {
        const ownerId = getOwnerId(req);
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "कामगाराची ID योग्य नाही."
            });
        }

        const allowedFields = [
            "name",
            "mobileNumber",
            "workType",
            "salaryType",
            "monthlySalary",
            "dailyWage",
            "joiningDate",
            "status",
            "notes"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (
            updates.salaryType !== undefined &&
            !["Monthly", "Daily"].includes(updates.salaryType)
        ) {
            return res.status(400).json({
                message: "पगाराचा प्रकार योग्य नाही."
            });
        }

        if (
            updates.status !== undefined &&
            !["Active", "Inactive"].includes(updates.status)
        ) {
            return res.status(400).json({
                message: "कामगाराची स्थिती योग्य नाही."
            });
        }

        for (const field of ["monthlySalary", "dailyWage"]) {
            if (updates[field] !== undefined) {
                updates[field] = Number(updates[field]);

                if (
                    !Number.isFinite(updates[field]) ||
                    updates[field] < 0
                ) {
                    return res.status(400).json({
                        message: "पगाराची रक्कम योग्य नाही."
                    });
                }
            }
        }

        const worker = await Worker.findOneAndUpdate(
            { _id: id, ownerId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!worker) {
            return res.status(404).json({
                message: "कामगार सापडला नाही."
            });
        }

        res.json({
            message: "कामगाराची माहिती अपडेट झाली.",
            worker
        });
    } catch (error) {
        console.error("Update worker error:", error);
        res.status(500).json({
            message: "माहिती अपडेट करता आली नाही."
        });
    }
});

// कामगार Delete करणे
router.delete("/:id", async (req, res) => {
    try {
        const ownerId = getOwnerId(req);
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "कामगाराची ID योग्य नाही."
            });
        }

        const worker = await Worker.findOneAndDelete({
            _id: id,
            ownerId
        });

        if (!worker) {
            return res.status(404).json({
                message: "कामगार सापडला नाही."
            });
        }

        res.json({
            message: "कामगाराची नोंद Delete झाली."
        });
    } catch (error) {
        console.error("Delete worker error:", error);
        res.status(500).json({
            message: "कामगार Delete करता आला नाही."
        });
    }
});

// कामगाराला पगार देणे
router.post("/:id/payments", async (req, res) => {
    try {
        const ownerId = getOwnerId(req);
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "कामगाराची ID योग्य नाही."
            });
        }

        const {
            amount,
            paymentDate,
            paymentMode,
            workDays,
            note
        } = req.body;

        const paidAmount = Number(amount);
        const days = Number(workDays || 0);
        const date = paymentDate ? new Date(paymentDate) : new Date();

        if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
            return res.status(400).json({
                message: "पगाराची रक्कम शून्यापेक्षा जास्त असावी."
            });
        }

        if (!Number.isFinite(days) || days < 0) {
            return res.status(400).json({
                message: "कामाचे दिवस योग्य भरा."
            });
        }

        if (Number.isNaN(date.getTime())) {
            return res.status(400).json({
                message: "पगाराची तारीख योग्य नाही."
            });
        }

        const validModes = [
            "Cash",
            "UPI",
            "Bank Transfer",
            "Other"
        ];

        const mode = paymentMode || "Cash";

        if (!validModes.includes(mode)) {
            return res.status(400).json({
                message: "पगार देण्याची पद्धत योग्य नाही."
            });
        }

        const worker = await Worker.findOne({
            _id: id,
            ownerId
        });

        if (!worker) {
            return res.status(404).json({
                message: "कामगार सापडला नाही."
            });
        }

        worker.payments.push({
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            amount: paidAmount,
            paymentDate: date,
            paymentMode: mode,
            workDays: days,
            note: note || ""
        });

        await worker.save();

        res.status(201).json({
            message: "पगाराची नोंद यशस्वी झाली.",
            worker
        });
    } catch (error) {
        console.error("Add salary payment error:", error);
        res.status(500).json({
            message: "पगाराची नोंद करता आली नाही."
        });
    }
});

// पगाराची नोंद Delete करणे
router.delete("/:id/payments/:paymentId", async (req, res) => {
    try {
        const ownerId = getOwnerId(req);
        const { id, paymentId } = req.params;

        if (
            !mongoose.isValidObjectId(id) ||
            !mongoose.isValidObjectId(paymentId)
        ) {
            return res.status(400).json({
                message: "ID योग्य नाही."
            });
        }

        const worker = await Worker.findOne({
            _id: id,
            ownerId
        });

        if (!worker) {
            return res.status(404).json({
                message: "कामगार सापडला नाही."
            });
        }

        const payment = worker.payments.id(paymentId);

        if (!payment) {
            return res.status(404).json({
                message: "पगाराची नोंद सापडली नाही."
            });
        }

        payment.deleteOne();
        await worker.save();

        res.json({
            message: "पगाराची नोंद Delete झाली."
        });
    } catch (error) {
        console.error("Delete salary payment error:", error);
        res.status(500).json({
            message: "पगाराची नोंद Delete करता आली नाही."
        });
    }
});

module.exports = router;
