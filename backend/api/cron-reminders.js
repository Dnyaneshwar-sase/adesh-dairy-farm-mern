
const mongoose = require("mongoose");
const { checkReminders } = require("../reminderScheduler");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    const cronSecret = process.env.CRON_SECRET;

    if (
        !cronSecret ||
        req.headers.authorization !== `Bearer ${cronSecret}`
    ) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        await checkReminders();

        return res.status(200).json({
            success: true,
            message: "Reminder check completed successfully"
        });
    } catch (error) {
        console.error("Cron Reminder Error:", error);

        return res.status(500).json({
            success: false,
            message: "Reminder check failed"
        });
    }
};
