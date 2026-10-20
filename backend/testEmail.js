
require("dotenv").config();

const { sendEmail } = require("./emailService");

async function testEmail() {
    try {
        await sendEmail({
            to: process.env.OWNER1_EMAIL,
            subject: "Adesh Dairy Farm - Test Email",
            text: "Adesh Dairy Farm madhun test email successfully pathavla aahe."
        });

        console.log("Test Email successfully sent!");
    } catch (error) {
        console.error("Test Email Failed:", error.message);
    }
}

testEmail();
