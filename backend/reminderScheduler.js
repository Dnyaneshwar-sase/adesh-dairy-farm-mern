const cron = require("node-cron");

const BreedingRecord = require("./models/BreedingRecord");
const Cow = require("./models/Cow");
const User = require("./models/User");
const { sendEmail } = require("./emailService");

// भारतीय तारीख: YYYY-MM-DD
const getToday = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
        values[part.type] = part.value;
    }

    return `${values.year}-${values.month}-${values.day}`;
};

// तारखेत दिवस जोडा
const addDays = (date, days) => {
    const result = new Date(`${date}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
};

// महिन्यांची संख्या जोडा; महिन्याच्या शेवटच्या दिवसाची काळजी घ्या
const addMonths = (date, months) => {
    const [year, month, day] = date.split("-").map(Number);

    const firstDay = new Date(
        Date.UTC(year, month - 1 + months, 1)
    );

    const lastDay = new Date(
        Date.UTC(
            firstDay.getUTCFullYear(),
            firstDay.getUTCMonth() + 1,
            0
        )
    ).getUTCDate();

    firstDay.setUTCDate(Math.min(day, lastDay));

    return firstDay.toISOString().slice(0, 10);
};

const daysBetween = (start, end) => {
    return Math.round(
        (
            new Date(`${end}T00:00:00.000Z`) -
            new Date(`${start}T00:00:00.000Z`)
        ) / 86400000
    );
};

// दोन तारखांमधील महिने आणि उरलेले दिवस
const getPeriod = (start, end) => {
    let months =
        (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
        (Number(end.slice(5, 7)) - Number(start.slice(5, 7)));

    if (addMonths(start, months) > end) {
        months--;
    }

    const anniversary = addMonths(start, months);

    return {
        months,
        days: daysBetween(anniversary, end)
    };
};

// अपेक्षित वेताची तारीख आणि शिल्लक वेळ
const getDeliveryDetails = (deliveryDate, today) => {
    if (!deliveryDate) {
        return "अपेक्षित वेताची तारीख: उपलब्ध नाही\n";
    }

    if (deliveryDate < today) {
        const passed = daysBetween(deliveryDate, today);

        return (
            `अपेक्षित वेताची तारीख: ${deliveryDate}\n` +
            `अपेक्षित तारीख उलटून ${passed} दिवस झाले आहेत.\n`
        );
    }

    const period = getPeriod(today, deliveryDate);

    return (
        `अपेक्षित वेताची तारीख: ${deliveryDate}\n` +
        `वेतासाठी शिल्लक वेळ: ${period.months} महिने, ` +
        `${period.days} दिवस\n`
    );
};

// गाय गर्भवती नाही हे तपासा
const isNotPregnant = (status) => {
    const value = String(status || "").trim().toLowerCase();

    return [
        "not pregnant",
        "गर्भवती नाही",
        "गर्भधारणा नाही"
    ].includes(value);
};

// गाय गर्भवती आहे हे तपासा
const isPregnant = (status) => {
    const value = String(status || "").trim().toLowerCase();

    return value === "pregnant" || value === "गर्भवती";
};

// Email पाठवण्याचे function
const sendReminder = async (owner, subject, message) => {
    if (!owner || !owner.email) {
        throw new Error("Owner चा ईमेल उपलब्ध नाही.");
    }

    await sendEmail({
        to: owner.email,
        subject,
        text: message
    });

    return true;
};

async function processRecord(record, today) {
    if (!record.cowId || !record.ownerId) {
        return;
    }

    const cow = await Cow.findOne({
        _id: record.cowId,
        ownerId: record.ownerId
    });

    const owner = await User.findById(record.ownerId);

    if (!cow || !owner || !owner.email) {
        console.log(
            "Cow किंवा Owner Email उपलब्ध नाही:",
            record._id
        );

        return;
    }

    const cowName = cow.name || "नाव उपलब्ध नाही";
    const cowTag = cow.cowTag || String(cow._id);
    const ownerName = owner.name || "शेतकरी मित्रा";

    const aiDate = record.aiDate;

    // Expected Calving Date नसल्यास AI Date + 9 महिने + 9 दिवस
    const deliveryDate =
        record.expectedCalvingDate ||
        (aiDate
            ? addDays(addMonths(aiDate, 9), 9)
            : "");

    const status = record.pregnancyStatus;

    const pregnant = isPregnant(status);
    const notPregnant = isNotPregnant(status);
    const statusPending = !pregnant && !notPregnant;

    // Expected Calving Date नंतर नवीन reminders पाठवू नका.
    // वेताच्या अपेक्षित दिवशी reminder पाठवता येईल.
    // Record किंवा Cow delete करू नका.
    if (deliveryDate && today > deliveryDate) {
        console.log(
            `Reminders बंद: ${cowName}. ` +
            `Expected Calving Date: ${deliveryDate}`
        );

        return;
    }

    // ==================================================
    // 1. AI नंतर 21 दिवस: Heat तपासणी Reminder
    // ==================================================

    const heatDate =
        record.aiReminderDate ||
        (aiDate ? addDays(aiDate, 21) : "");

    if (
        heatDate &&
        today === heatDate &&
        !record.aiEmailSent
    ) {
        const message =
            `नमस्कार ${ownerName},\n\n` +
            `गायीचे नाव: ${cowName}\n` +
            `गायीचा ID: ${cowTag}\n` +
            `AI तारीख: ${aiDate}\n\n` +
            "AI नंतर 21 दिवस पूर्ण झाले आहेत.\n" +
            "कृपया गायीमध्ये Heat ची लक्षणे तपासा.\n\n" +
            "आदेश डेअरी फार्म";

        await sendReminder(
            owner,
            "AI नंतर 21 दिवस - Heat तपासणी",
            message
        );

        record.aiEmailSent = true;
        await record.save();

        console.log("Heat Reminder Email पाठवला:", cowName);
    }

    if (!aiDate) {
        return;
    }

    // ==================================================
    // 2. AI नंतर 2 महिने: Pregnancy Test + Monthly Follow-up
    // 45 दिवसांचा स्वतंत्र Reminder काढलेला आहे.
    // पहिला Reminder AI नंतर 2 महिने पूर्ण झाल्यावर.
    // त्यानंतर दर महिन्याला Follow-up.
    // ==================================================

    const twoMonthDate = addMonths(aiDate, 2);
    const lastReminder = record.lastPregnancyReminderDate;

    // जुन्या 45 दिवसांच्या Reminder ची तारीख 2 महिन्यांपूर्वीची
    // असल्यास ती पहिला 2 महिन्यांचा Reminder रोखणार नाही.
    const firstTwoMonthReminderDue =
        today >= twoMonthDate &&
        (!lastReminder || lastReminder < twoMonthDate);

    // पहिल्या 2 महिन्यांच्या Reminder नंतर पुढील मासिक Reminder
    const nextMonthlyReminderDue =
        today >= twoMonthDate &&
        lastReminder &&
        lastReminder >= twoMonthDate &&
        today >= addMonths(lastReminder, 1);

    if (
        (pregnant || statusPending) &&
        (firstTwoMonthReminderDue || nextMonthlyReminderDue)
    ) {
        let subject;
        let statusMessage;
        let pregnancyTestMessage = "";

        if (pregnant) {
            const period = getPeriod(aiDate, today);

            subject = "मासिक गर्भधारणा रिमाइंडर";

            statusMessage =
                "गायीची गर्भधारणा स्थिती: गर्भवती\n" +
                `गायीच्या गर्भधारणेला ${period.months} ` +
                `महिने पूर्ण झाले आहेत` +
                (
                    period.days > 0
                        ? ` आणि ${period.days} दिवस झाले आहेत.`
                        : "."
                );
        } else {
            subject = "गर्भधारणा तपासणी - Monthly Follow-up";

            statusMessage =
                "गायीची गर्भधारणा स्थिती अद्याप " +
                "confirm केलेली नाही.\n" +
                "कृपया पशुवैद्यकाकडून गर्भधारणा " +
                "तपासणी करून घ्या आणि system मध्ये " +
                "status update करा.";

            // पहिल्या 2 महिन्यांच्या Reminder मध्ये Pregnancy Test सूचना
            if (firstTwoMonthReminderDue) {
                pregnancyTestMessage =
                    "\nAI नंतर 2 महिने पूर्ण झाले आहेत.\n" +
                    "कृपया गायीची गर्भधारणा तपासणी " +
                    "पशुवैद्यकाकडून करून घ्या.\n" +
                    "तपासणीनंतर system मध्ये pregnancy " +
                    "status update करा.\n";
            }
        }

        const message =
            `नमस्कार ${ownerName},\n\n` +
            `गायीचे नाव: ${cowName}\n` +
            `गायीचा ID: ${cowTag}\n` +
            `AI तारीख: ${aiDate}\n\n` +
            `${statusMessage}\n` +
            `${pregnancyTestMessage}\n` +
            getDeliveryDetails(deliveryDate, today) +
            "\nआदेश डेअरी फार्म";

        await sendReminder(owner, subject, message);

        record.lastPregnancyReminderDate = today;
        await record.save();

        console.log("Monthly Reminder पाठवला:", cowName);
    }

    // ==================================================
    // 3. गाय गर्भवती नसल्यास Calving Reminders पाठवू नका
    // ==================================================

    if (!pregnant || !deliveryDate) {
        return;
    }

    // ==================================================
    // 4. वेताच्या 15 दिवस आधी, 9 दिवस आधी आणि वेताच्या दिवशी
    // या तीन Reminders मध्ये बदल केलेला नाही.
    // ==================================================

    const calvingReminders = [
        {
            days: 15,
            sentField: "calving15DayEmailSent",
            subject: "वेत होण्यास 15 दिवस शिल्लक",
            reminder: "गायीच्या वेतासाठी आवश्यक तयारी करा."
        },
        {
            days: 9,
            sentField: "calving9DayEmailSent",
            subject: "वेत होण्यास 9 दिवस शिल्लक",
            reminder: "गायीवर लक्ष ठेवा आणि वेतासाठी तयारी ठेवा."
        },
        {
            days: 0,
            sentField: "calvingDueDayEmailSent",
            subject: "आज अपेक्षित वेताची तारीख आहे",
            reminder:
                "गायीची स्थिती तपासा. गरज असल्यास " +
                "पशुवैद्यकांशी संपर्क साधा."
        }
    ];

    for (const item of calvingReminders) {
        const reminderDate = addDays(
            deliveryDate,
            -item.days
        );

        if (
            today !== reminderDate ||
            record[item.sentField]
        ) {
            continue;
        }

        const message =
            `नमस्कार ${ownerName},\n\n` +
            `गायीचे नाव: ${cowName}\n` +
            `गायीचा ID: ${cowTag}\n` +
            `AI तारीख: ${aiDate || "उपलब्ध नाही"}\n` +
            `अपेक्षित वेताची तारीख: ${deliveryDate}\n` +
            getDeliveryDetails(deliveryDate, today) +
            `\n${item.reminder}\n\n` +
            "आदेश डेअरी फार्म";

        await sendReminder(owner, item.subject, message);

        record[item.sentField] = true;
        await record.save();

        console.log("Calving Reminder पाठवला:", cowName);
    }
}

// ==================================================
// सर्व Breeding Records तपासा
// ==================================================

async function checkReminders() {
    const today = getToday();

    console.log("Reminder तपासणी सुरू:", today);

    const records = await BreedingRecord.find({});

    for (const record of records) {
        try {
            await processRecord(record, today);
        } catch (error) {
            console.error(
                `Reminder Error | Record ${record._id}:`,
                error.message
            );
        }
    }

    console.log("Reminder तपासणी पूर्ण:", today);
}

// ==================================================
// Scheduler
// सध्या testing साठी दर मिनिटाला चालतो.
// Production मध्ये सकाळी 9 वाजता चालवण्यासाठी:
// "0 9 * * *" वापरा.
// ==================================================

// दररोज भारतीय वेळेनुसार सकाळी 9 वाजता
cron.schedule("0 9 * * *", async () => {
    console.log("Daily Reminder Scheduler started:", getToday());

    checkReminders()
        .catch(error => {
            console.error("Daily Scheduler error:", error);
        });
}, {
    timezone: "Asia/Kolkata"
});

console.log(
    "Reminder Scheduler तयार आहे. वेळ: दररोज सकाळी 9:00 IST"
);

module.exports = { checkReminders };