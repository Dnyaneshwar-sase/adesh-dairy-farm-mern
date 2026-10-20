
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../models/User");

async function createOwners() {
    try {
        // MongoDB connection तपासा
        if (!process.env.MONGODB_URI) {
            throw new Error(
                "MONGODB_URI .env मध्ये सेट केलेला नाही."
            );
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB connected successfully.");

        const owners = [
            {
                label: "OWNER1",
                name: process.env.OWNER1_NAME,
                mobileNumber: process.env.OWNER1_MOBILE,
                email: process.env.OWNER1_EMAIL,
                password: process.env.OWNER1_PASSWORD
            },
            {
                label: "OWNER2",
                name: process.env.OWNER2_NAME,
                mobileNumber: process.env.OWNER2_MOBILE,
                email: process.env.OWNER2_EMAIL,
                password: process.env.OWNER2_PASSWORD
            }
        ];

        let createdCount = 0;

        for (const owner of owners) {
            const values = [
                owner.name,
                owner.mobileNumber,
                owner.email,
                owner.password
            ];

            const allEmpty = values.every(
                value => !value || !value.trim()
            );

            if (allEmpty) {
                console.log(
                    `${owner.label}: माहिती भरलेली नाही, वगळले.`
                );
                continue;
            }

            const hasMissingValue = values.some(
                value => !value || !value.trim()
            );

            if (hasMissingValue) {
                throw new Error(
                    `${owner.label}: नाव, Mobile, Email आणि Password सर्व भरा.`
                );
            }

            if (owner.password.length < 8) {
                throw new Error(
                    `${owner.label}: Password किमान 8 characters चा असावा.`
                );
            }

            const email = owner.email.trim().toLowerCase();

            // Email आधीपासून उपलब्ध आहे का?
            const existingUser = await User.findOne({ email });

            if (existingUser) {
                if (
                    existingUser.role !== "owner" ||
                    existingUser.status !== "approved"
                ) {
                    throw new Error(
                        `${email} वर खाते आधीपासून आहे; ते Owner आणि approved नाही.`
                    );
                }

                console.log(
                    `Owner आधीपासून उपलब्ध आहे: ${email}`
                );
                continue;
            }

            // Password hash करा
            const hashedPassword = await bcrypt.hash(
                owner.password,
                12
            );

            // Owner account तयार करा
            await User.create({
                name: owner.name.trim(),
                mobileNumber: owner.mobileNumber.trim(),
                email,
                password: hashedPassword,
                role: "owner",
                status: "approved"
            });

            createdCount++;

            console.log(
                `${owner.label}: Owner account तयार झाले.`
            );
        }

        console.log(
            `Owner setup पूर्ण. नवीन accounts: ${createdCount}`
        );

    } catch (error) {
        console.error(
            "Owner Setup Failed:",
            error.message
        );

        process.exitCode = 1;

    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log("MongoDB disconnected.");
        }
    }
}

createOwners();
