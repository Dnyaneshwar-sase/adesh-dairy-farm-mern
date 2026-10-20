
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async ({ to, subject, text, html }) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Email configuration .env मध्ये उपलब्ध नाही.");
    }

    if (!to) {
        throw new Error("Recipient email address उपलब्ध नाही.");
    }

    const result = await transporter.sendMail({
        from: `"Adesh Dairy Farm" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html
    });

    console.log("Email successfully sent:", result.messageId);

    return true;
};

module.exports = { sendEmail };
