
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const PasswordResetOTP = require("../models/PasswordResetOTP");

const router = express.Router();

// ================================
// 1. USER REGISTRATION
// ================================
router.post("/register", async (req, res) => {
    try {
        const { name, mobileNumber, email, password } = req.body;

        if (!name || !mobileNumber || !email || !password) {
            return res.status(400).json({
                message: "सर्व माहिती भरणे आवश्यक आहे."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password किमान 8 characters चा असावा."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: "हा Email आधीच Register केलेला आहे."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = await User.create({
            name: name.trim(),
            mobileNumber: mobileNumber.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "user",
            status: "pending"
        });

        return res.status(201).json({
            message: "Registration यशस्वी झाले! Owner ची मंजुरी मिळेपर्यंत प्रतीक्षा करा.",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                status: newUser.status
            }
        });

    } catch (error) {
        console.error("Registration Error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "हा Email आधीच Register केलेला आहे."
            });
        }

        return res.status(500).json({
            message: "Registration करताना समस्या आली."
        });
    }
});


// ================================
// 2. USER LOGIN
// ================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email आणि Password भरणे आवश्यक आहे."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(401).json({
                message: "Email किंवा Password चुकीचा आहे."
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Email किंवा Password चुकीचा आहे."
            });
        }

        // Pending User ला Login करता येणार नाही
        if (user.status === "pending") {
            return res.status(403).json({
                message: "तुमची Registration Request Pending आहे. Owner च्या मंजुरीची प्रतीक्षा करा."
            });
        }

        // Rejected User ला Login करता येणार नाही
        if (user.status === "rejected") {
            return res.status(403).json({
                message: "तुमची Registration Request Reject केली आहे."
            });
        }

        // Deactivated User ला Login करता येणार नाही
        if (user.status === "inactive") {
            return res.status(403).json({
                message: "तुमचे Account Deactivate केले आहे. कृपया Owner शी संपर्क साधा."
            });
        }

        // फक्त Approved User किंवा Owner ला Login
        if (user.status !== "approved") {
            return res.status(403).json({
                message: "तुमच्या Account ला प्रवेशाची परवानगी नाही."
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing in .env");

            return res.status(500).json({
                message: "Server Configuration मध्ये समस्या आहे."
            });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(200).json({
            message: "Login यशस्वी झाला!",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch (error) {
        console.error("Login Error:", error.message);

        return res.status(500).json({
            message: "Login करताना समस्या आली."
        });
    }
});

/* ================================
   3. FORGOT PASSWORD - SEND OTP
================================ */
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({
                message: "Registered Email भरणे आवश्यक आहे."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        // Email अस्तित्वात आहे की नाही हे उघड करू नका.
        if (!user) {
            return res.status(200).json({
                message: "Email नोंदणीकृत असल्यास OTP पाठवला जाईल."
            });
        }

        const otp = String(
            Math.floor(100000 + Math.random() * 900000)
        );

        const otpHash = await bcrypt.hash(otp, 10);

        // त्याच Email साठी आधीचा OTP काढा.
        await PasswordResetOTP.deleteMany({
            email: normalizedEmail
        });

        await PasswordResetOTP.create({
            email: normalizedEmail,
            otpHash,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            await PasswordResetOTP.deleteMany({
                email: normalizedEmail
            });

            console.error("Email configuration missing in .env");

            return res.status(500).json({
                message: "Email सेवा सध्या उपलब्ध नाही."
            });
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        try {
            await transporter.sendMail({
                from: `"Adesh Dairy Farm" <${process.env.EMAIL_USER}>`,
                to: normalizedEmail,
                subject: "Adesh Dairy Farm - Password Reset OTP",
                text:
                    `तुमचा Password Reset OTP: ${otp}\n\n` +
                    "हा OTP 5 मिनिटांसाठी वैध आहे. " +
                    "तुम्ही Password Reset मागितला नसेल तर हा Email दुर्लक्षित करा."
            });
        } catch (mailError) {
            await PasswordResetOTP.deleteMany({
                email: normalizedEmail
            });
            throw mailError;
        }

        return res.status(200).json({
            message: "Email नोंदणीकृत असल्यास OTP पाठवला जाईल."
        });

    } catch (error) {
        console.error("Forgot Password Error:", error.message);

        return res.status(500).json({
            message: "OTP पाठवताना समस्या आली. पुन्हा प्रयत्न करा."
        });
    }
});


/* ================================
   4. VERIFY PASSWORD RESET OTP
================================ */
router.post("/verify-reset-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: "Email आणि OTP भरणे आवश्यक आहे."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                message: "6 अंकी OTP टाका."
            });
        }

        const resetRecord = await PasswordResetOTP.findOne({
            email: normalizedEmail
        });

        if (!resetRecord || resetRecord.expiresAt <= new Date()) {
            return res.status(400).json({
                message: "OTP चुकीचा आहे किंवा त्याची वैधता संपली आहे."
            });
        }

        if (resetRecord.verified) {
            return res.status(400).json({
                message: "हा OTP आधीच Verify केला आहे."
            });
        }

        if (resetRecord.attempts >= 5) {
            await PasswordResetOTP.deleteOne({
                _id: resetRecord._id
            });

            return res.status(429).json({
                message: "OTP चे प्रयत्न संपले. नवीन OTP मागवा."
            });
        }

        const isOTPValid = await bcrypt.compare(
            String(otp),
            resetRecord.otpHash
        );

        if (!isOTPValid) {
            resetRecord.attempts += 1;
            await resetRecord.save();

            return res.status(400).json({
                message: "OTP चुकीचा आहे."
            });
        }

        resetRecord.verified = true;
        await resetRecord.save();

        return res.status(200).json({
            message: "OTP Verify झाला. आता नवीन Password सेट करू शकता."
        });

    } catch (error) {
        console.error("OTP Verification Error:", error.message);

        return res.status(500).json({
            message: "OTP Verify करताना समस्या आली."
        });
    }
});

/* ================================
   5. RESET PASSWORD
================================ */
router.post("/reset-password", async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                message: "Email आणि नवीन Password भरणे आवश्यक आहे."
            });
        }

        if (typeof newPassword !== "string" || newPassword.length < 8) {
            return res.status(400).json({
                message: "नवीन Password किमान 8 characters चा असावा."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const resetRecord = await PasswordResetOTP.findOne({
            email: normalizedEmail,
            verified: true,
            expiresAt: { $gt: new Date() }
        });

        if (!resetRecord) {
            return res.status(400).json({
                message: "आधी OTP Verify करा किंवा नवीन OTP मागवा."
            });
        }

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            await PasswordResetOTP.deleteMany({
                email: normalizedEmail
            });

            return res.status(400).json({
                message: "Password Reset करता आला नाही. पुन्हा प्रयत्न करा."
            });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        // OTP पुन्हा वापरता येऊ नये.
        await PasswordResetOTP.deleteMany({
            email: normalizedEmail
        });

        return res.status(200).json({
            message: "Password यशस्वीपणे बदलला! आता नवीन Password वापरून Login करा."
        });

    } catch (error) {
        console.error("Password Reset Error:", error.message);

        return res.status(500).json({
            message: "Password बदलताना समस्या आली."
        });
    }
});


module.exports = router;
