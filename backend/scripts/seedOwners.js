
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../models/User");

async function createOwners() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI .env मध्ये सेट केलेला नाही.");
        }

        await mongoose.connect(process.env.MONGODB_URI);

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
                console.log(`${owner.label}: माहिती भरलेली नाही, वगळले.`);
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
                    `${owner.label}: Password किमान 8 अक्षरांचा असावा.`
                );
            }

            const email = owner.email.trim().toLowerCase();

            const existingUser = await User.findOne({ email });

            if (existingUser) {
                if (
                    existingUser.role !== "owner" ||
                    existingUser.status !== "approved"
                ) {
                    throw new Error(
                        `${email} वर आधीपासून Owner नसलेले किंवा मंजूर नसलेले खाते आहे.`
                    );
                }

                console.log(`Owner आधीपासून उपलब्ध आहे: ${email}`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(
                owner.password,
                12
            );

            await User.create({
                name: owner.name.trim(),
                mobileNumber: owner.mobileNumber.trim(),
                email,
                password: hashedPassword,
                role: "owner",
                status: "approved"
            });

            createdCount++;
            console.log(`Owner Account तयार झाले: ${email}`);
        }

        if (createdCount === 0) {
            console.log(
                "नवीन Owner तयार झाला नाही. .env मधील Owner माहिती तपासा."
            );
        }
    } catch (error) {
        console.error("Owner Setup Failed:", error.message);
        process.exitCode = 1;
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

createOwners();
