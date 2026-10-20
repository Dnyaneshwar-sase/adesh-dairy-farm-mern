
const express = require("express");
const router = express.Router();

const MilkRecord = require("../models/MilkRecord");
const ownerAuth = require("../middleware/ownerAuth");

// Reports: selected date and selected month
router.get("/", ownerAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const selectedDate =
      /^\d{4}-\d{2}-\d{2}$/.test(req.query.selectedDate || "") &&
      !Number.isNaN(Date.parse(req.query.selectedDate))
        ? req.query.selectedDate
        : today;

    const selectedMonth =
      /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.selectedMonth || "")
        ? req.query.selectedMonth
        : selectedDate.slice(0, 7);

    const ownerId = req.user.id;

    // Selected date records
    const todayRecords = await MilkRecord.find({
      ownerId,
      date: selectedDate
    }).lean();

    const morningMilk = todayRecords.reduce(
      (sum, record) => sum + Number(record.morningMilk || 0), 0
    );

    const eveningMilk = todayRecords.reduce(
      (sum, record) => sum + Number(record.eveningMilk || 0), 0
    );

    // Only the selected month's records
    const monthlyRecords = await MilkRecord.find({
      ownerId,
      date: {
        $gte: `${selectedMonth}-01`,
        $lt: (() => {
          const [year, month] = selectedMonth.split("-").map(Number);
          const nextMonth = new Date(year, month, 1);
          return `${nextMonth.getFullYear()}-${String(
            nextMonth.getMonth() + 1
          ).padStart(2, "0")}-01`;
        })()
      }
    }).sort({ date: -1, createdAt: -1 }).lean();

    const monthlyMilk = monthlyRecords.reduce(
      (sum, record) => sum + Number(record.totalMilk || 0), 0
    );

    // Daily totals for the selected month
    const dailyTotals = {};

    monthlyRecords.forEach(record => {
      dailyTotals[record.date] =
        (dailyTotals[record.date] || 0) +
        Number(record.totalMilk || 0);
    });

    res.json({
      selectedDate,
      selectedMonth,
      morningMilk,
      eveningMilk,
      todayMilk: morningMilk + eveningMilk,
      monthlyMilk,
      monthlyRecords,
      dailyChart: Object.entries(dailyTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, totalMilk]) => ({ date, totalMilk }))
    });
  } catch (error) {
    console.error("Reports Error:", error);
    res.status(500).json({
      message: "Reports load करताना त्रुटी आली."
    });
  }
});

module.exports = router;
