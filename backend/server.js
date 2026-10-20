
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Uploaded photos
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use(
    "/api/owner/requests",
    require("./routes/ownerRequests")
);
app.use("/api/cows", require("./routes/cowRoutes"));
app.use("/api/milk", require("./routes/milkRoutes"));
app.use("/api/breeding", require("./routes/breedingRoutes"));
app.use("/api/chatbot", require("./routes/chatbotRoutes"));
app.use("/api/notes", require("./routes/farmNoteRoutes"));
app.use("/api/calves", require("./routes/calfRoutes"));
app.use("/api/financial", require("./routes/financialRoutes"));
app.use("/api/feed", require("./routes/feedRoutes"));
app.use("/api/workers", require("./routes/workerSalaryRoutes"));
app.use("/api/gallery", require("./routes/galleryRoutes"));

// Backend health check
app.get("/", (req, res) => {
    res.send("Adesh Dairy Farm Backend is running!");
});

// Server Port
const PORT = process.env.PORT || 5000;

// MongoDB Connection and Server Start
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB Connected Successfully!");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(
            "MongoDB Connection Failed:",
            error.message
        );
    });
