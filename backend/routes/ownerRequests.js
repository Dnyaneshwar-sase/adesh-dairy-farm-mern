
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const ownerAuth = require("../middleware/ownerAuth");

const router = express.Router();

// 1. Pending Registration Requests
router.get("/pending", ownerAuth, async (req, res) => {
    try {
        const requests = await User.find({
            role: "user",
            status: "pending"
        })
            .select("-password")
            .sort({ createdAt: -1 });

        res.json({ requests });
    } catch (error) {
        console.error("Pending Requests Error:", error.message);
        res.status(500).json({
            message: "Pending Requests मिळवताना समस्या आली."
        });
    }
});

// 2. Approved आणि Inactive Users
router.get("/users", ownerAuth, async (req, res) => {
    try {
        const users = await User.find({
            role: "user",
            status: { $in: ["approved", "inactive"] }
        })
            .select("-password")
            .sort({ createdAt: -1 });

        res.json({ users });
    } catch (error) {
        console.error("Users List Error:", error.message);
        res.status(500).json({
            message: "Users ची यादी मिळवताना समस्या आली."
        });
    }
});

// 3. Approve, Reject, Deactivate किंवा Activate
router.patch("/:id/status", ownerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "approved",
            "rejected",
            "inactive"
        ];

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "User ID अवैध आहे."
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Status अवैध आहे."
            });
        }

        const user = await User.findOne({
            _id: id,
            role: "user"
        });

        if (!user) {
            return res.status(404).json({
                message: "User सापडला नाही."
            });
        }

        // Pending User: Approve किंवा Reject
        if (user.status === "pending") {
            if (!["approved", "rejected"].includes(status)) {
                return res.status(400).json({
                    message: "Pending User ला Approve किंवा Reject करा."
                });
            }
        }

        // फक्त Approved User ला Deactivate करता येईल
        if (status === "inactive" && user.status !== "approved") {
            return res.status(400).json({
                message: "फक्त Approved User ला Deactivate करता येईल."
            });
        }

        // Inactive User पुन्हा Activate करणे
        if (status === "approved" && user.status === "rejected") {
            return res.status(400).json({
                message: "Rejected User साठी नवीन Registration आवश्यक आहे."
            });
        }

        user.status = status;
        await user.save();

        const messages = {
            approved: "User Activate / Approve झाला.",
            rejected: "Registration Reject केले.",
            inactive: "User Deactivate झाला."
        };

        res.json({
            message: messages[status],
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error("Update User Status Error:", error.message);
        res.status(500).json({
            message: "User चा Status बदलताना समस्या आली."
        });
    }
});

/* 4. Delete User */
router.delete("/:id", ownerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "User ID अवैध आहे."
            });
        }

        // फक्त सामान्य User delete करता येईल; Owner नाही.
        const user = await User.findOneAndDelete({
            _id: id,
            role: "user"
        });

        if (!user) {
            return res.status(404).json({
                message: "User सापडला नाही किंवा Delete करता येत नाही."
            });
        }

        return res.json({
            message: "User यशस्वीरीत्या Delete झाला."
        });
    } catch (error) {
        console.error("Delete User Error:", error.message);

        return res.status(500).json({
            message: "User Delete करताना समस्या आली."
        });
    }
});

module.exports = router;
