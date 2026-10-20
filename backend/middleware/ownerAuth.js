
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const ownerAuth = async (req, res, next) => {
    try {
        // Authorization Header तपासा
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Login आवश्यक आहे."
            });
        }

        // JWT Token मिळवा
        const token = authHeader.split(" ")[1];

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET .env मध्ये सेट केलेला नाही.");

            return res.status(500).json({
                success: false,
                message: "Server authentication configuration missing."
            });
        }

        // Token Verify करा
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const userId = decoded.userId || decoded.id || decoded._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Token मध्ये User ID उपलब्ध नाही. पुन्हा Login करा."
            });
        }

        // Database मधील User शोधा
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User सापडला नाही. पुन्हा Login करा."
            });
        }

        // User.js मध्ये Field चे नाव status आहे
        if (
            user.role !== "owner" ||
            user.status !== "approved"
        ) {
            return res.status(403).json({
                success: false,
                message: "फक्त मंजूर Owner ला प्रवेश आहे."
            });
        }

        // Authenticated User ची माहिती पुढे पाठवा
        req.user = {
            id: user._id.toString(),
            _id: user._id.toString(),
            role: user.role
        };

        next();

    } catch (error) {
        console.error("Owner Authentication Error:", error);

        return res.status(401).json({
            success: false,
            message: "Token अवैध आहे किंवा Expire झाला आहे."
        });
    }
};

module.exports = ownerAuth;
