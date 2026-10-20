
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const auth = require("../middleware/auth");

const router = express.Router();

const MODEL = "gemini-3.5-flash-lite";

const systemInstruction = `
You are the AI assistant for Adesh Dairy Farm in Maharashtra, India.

LANGUAGE:
- Answer in the same language as the user.
- Use simple, natural Marathi in Devanagari for Marathi questions.
- Understand Hindi, English and Marathi-English mixed questions.

DAIRY FARMING:
- Help with cattle breeds, fodder, balanced feeding, milk production,
  hygiene, heat detection, breeding and dairy management.
- Do not invent farm records, prices, medicine prescriptions or exact
  feed quantities.
- For serious animal illness, recommend consulting a qualified veterinarian.
- Give practical, clear answers without unnecessary repetition.
`;


// फक्त Login केलेल्या आणि मंजूर User ला प्रवेश
router.use(auth);

router.post("/", async (req, res) => {
    try {
        const question = req.body?.question;

        if (typeof question !== "string" || !question.trim()) {
            return res.status(400).json({
                answer: "कृपया तुमचा प्रश्न लिहा."
            });
        }

        if (question.length > 4000) {
            return res.status(400).json({
                answer: "कृपया 4000 अक्षरांपेक्षा छोटा प्रश्न विचारा."
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                answer: "Gemini API key configure केलेली नाही."
            });
        }

        const dairyAssistant = new GoogleGenAI({
            apiKey: apiKey
        });

        const result = await dairyAssistant.models.generateContent({
            model: MODEL,
            contents: question.trim(),
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.3,
                maxOutputTokens: 2048
            }
        });

        const answer = result.text?.trim();

        if (!answer) {
            return res.status(502).json({
                answer: "Gemini कडून उत्तर मिळाले नाही. पुन्हा प्रयत्न करा."
            });
        }

        return res.json({ answer });

    } catch (error) {
        console.error("Gemini Chatbot Error:", error.message);

        return res.status(502).json({
            answer: "AI कडून उत्तर मिळवताना समस्या आली. कृपया पुन्हा प्रयत्न करा."
        });
    }
});

module.exports = router;
