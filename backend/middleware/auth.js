
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Login आवश्यक आहे."
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET .env मध्ये उपलब्ध नाही.");

            return res.status(500).json({
                success: false,
                message: "Server configuration मध्ये समस्या आहे."
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id || decoded._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Token मध्ये User ID नाही."
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User सापडला नाही. पुन्हा Login करा."
            });
        }

        if (
            user.status !== "approved" ||
            !["owner", "user"].includes(user.role)
        ) {
            return res.status(403).json({
                success: false,
                message: "तुमच्या Account ला परवानगी नाही."
            });
        }

        req.user = {
            id: user._id.toString(),
            _id: user._id.toString(),
            role: user.role
        };

        next();
    } catch (error) {
        console.error("Authentication Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Token अवैध आहे किंवा Expire झाला आहे."
        });
    }
};

module.exports = auth;
