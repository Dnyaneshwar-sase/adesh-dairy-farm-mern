
const express = require("express");
const mongoose = require("mongoose");
const FeedRecord = require("../models/FeedRecord");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

const FARM_TYPES = ["farm-stock", "farm-usage"];
const STOCK_IN_TYPES = ["purchase", "farm-stock"];
const STOCK_OUT_TYPES = ["usage", "farm-usage"];
const VALID_UNITS = ["kg", "quintal", "bag", "liter", "guntha"];

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function sourceFor(type) {
  return FARM_TYPES.includes(type) ? "farm-grown" : "purchased";
}

function unitFor(type, suppliedUnit) {
  // शेतातील चारा गुंठ्यांमध्ये मोजायचा.
  if (FARM_TYPES.includes(type)) return "guntha";
  return suppliedUnit;
}

function quantityFor(body, type) {
  if (type === "farm-stock") {
    const area = Number(body.fieldAreaGuntha || 0);

    if (Number.isFinite(area) && area > 0) {
      return area;
    }

    const acres = Number(body.farmAcres || 0);
    const guntha = Number(body.farmGuntha || 0);

    if (
      Number.isFinite(acres) &&
      Number.isFinite(guntha) &&
      acres >= 0 &&
      guntha >= 0 &&
      (acres > 0 || guntha > 0)
    ) {
      return acres * 40 + guntha;
    }

    if (body.unit === "guntha") {
      return Number(body.quantity);
    }

    throw new Error(
      "चाऱ्याचा साठा नोंदवण्यासाठी एकर किंवा गुंठ्यांचे क्षेत्रफळ आवश्यक आहे."
    );
  }

  return Number(body.quantity);
}

function ownerIdFromRequest(req) {
  return req.user?.id || req.user?._id;
}

function getEffectiveSource(record) {
  if (FARM_TYPES.includes(record.transactionType)) {
    return "farm-grown";
  }

  return record.feedSource || "purchased";
}

async function getOwnerRecords(ownerId) {
  return FeedRecord.find({ ownerId }).sort({
    date: -1,
    createdAt: -1
  });
}

function calculateStock(records) {
  const groups = new Map();

  for (const record of records) {
    const source = getEffectiveSource(record);
    const unit = record.unit;
    const nameKey = normalizeName(record.feedName);
    const key = `${nameKey}::${source}::${unit}`;

    if (!groups.has(key)) {
      groups.set(key, {
        feedName: record.feedName,
        feedSource: source,
        unit,
        stock: 0,
        totalIncoming: 0,
        totalUsed: 0
      });
    }

    const item = groups.get(key);
    const quantity = Number(record.quantity || 0);

    if (STOCK_IN_TYPES.includes(record.transactionType)) {
      item.stock += quantity;
      item.totalIncoming += quantity;
    } else if (STOCK_OUT_TYPES.includes(record.transactionType)) {
      item.stock -= quantity;
      item.totalUsed += quantity;
    }
  }

  return [...groups.values()].map(item => ({
    ...item,
    stock: Math.max(0, item.stock)
  }));
}

async function findMatchingRecords(ownerId, feedName, source, unit) {
  const records = await FeedRecord.find({
    ownerId,
    unit
  });

  return records.filter(record =>
    normalizeName(record.feedName) === normalizeName(feedName) &&
    getEffectiveSource(record) === source
  );
}

async function getAvailableStock(ownerId, feedName, source, unit) {
  const records = await findMatchingRecords(
    ownerId,
    feedName,
    source,
    unit
  );

  return records.reduce((balance, record) => {
    const quantity = Number(record.quantity || 0);

    if (STOCK_IN_TYPES.includes(record.transactionType)) {
      return balance + quantity;
    }

    if (STOCK_OUT_TYPES.includes(record.transactionType)) {
      return balance - quantity;
    }

    return balance;
  }, 0);
}

// GET /api/feed
// Login केलेल्या user च्याच नोंदी मिळवा.
router.get("/", async (req, res) => {
  try {
    const ownerId = ownerIdFromRequest(req);

    if (!ownerId) {
      return res.status(401).json({
        message: "Login आवश्यक आहे."
      });
    }

    const records = await getOwnerRecords(ownerId);
    const stock = calculateStock(records).filter(
      item => item.stock > 0
    );

    return res.status(200).json({
      records,
      stock
    });
  } catch (error) {
    console.error("Feed GET error:", error);

    return res.status(500).json({
      message: "साठ्याची माहिती मिळवता आली नाही."
    });
  }
});

// POST /api/feed
// नवीन पशुखाद्य किंवा चाऱ्याची नोंद.
router.post("/", async (req, res) => {
  try {
    const ownerId = ownerIdFromRequest(req);

    if (!ownerId || !mongoose.isValidObjectId(ownerId)) {
      return res.status(401).json({
        message: "Login किंवा वैध user ID आवश्यक आहे."
      });
    }

    const {
      transactionType,
      feedName,
      date,
      supplier = "",
      description = ""
    } = req.body;

    if (
      !["purchase", "usage", "farm-stock", "farm-usage"]
        .includes(transactionType)
    ) {
      return res.status(400).json({
        message: "नोंदीचा प्रकार योग्य नाही."
      });
    }

    const cleanName = String(feedName || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        message: "पशुखाद्य किंवा चाऱ्याचे नाव आवश्यक आहे."
      });
    }

    const source = sourceFor(transactionType);
    const unit = unitFor(transactionType, req.body.unit);

    if (!VALID_UNITS.includes(unit)) {
      return res.status(400).json({
        message: "एकक योग्य नाही."
      });
    }

    if (source === "purchased" && unit === "guntha") {
      return res.status(400).json({
        message: "पशुखाद्यासाठी kg, quintal, bag किंवा liter वापरा."
      });
    }

    let quantity;

    try {
      quantity = quantityFor(req.body, transactionType);
    } catch (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "प्रमाण शून्यापेक्षा जास्त असावे."
      });
    }

    const rate = transactionType === "purchase"
      ? Number(req.body.rate || 0)
      : 0;

    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({
        message: "दर योग्य नाही."
      });
    }

    // वापरापूर्वी त्या user चा उपलब्ध साठा तपासा.
    if (STOCK_OUT_TYPES.includes(transactionType)) {
      const available = await getAvailableStock(
        ownerId,
        cleanName,
        source,
        unit
      );

      if (available <= 0 || quantity > available + 0.000001) {
        return res.status(400).json({
          message:
            `पुरेसा साठा नाही. उपलब्ध साठा: ` +
            `${Math.max(0, available)} ${unit}.`
        });
      }
    }

    const record = await FeedRecord.create({
      ownerId,
      feedName: cleanName,
      transactionType,
      feedSource: source,
      quantity,
      unit,
      fieldAreaGuntha:
        transactionType === "farm-stock" ? quantity : 0,
      rate,
      amount: transactionType === "purchase"
        ? quantity * rate
        : 0,
      date: date ? new Date(date) : new Date(),
      supplier: String(supplier || "").trim(),
      description: String(description || "").trim()
    });

    const remaining = await getAvailableStock(
      ownerId,
      cleanName,
      source,
      unit
    );

    // मूळ कोडप्रमाणे साठा शून्य झाल्यास संबंधित records delete.
    if (remaining <= 0.000001) {
      const matchingRecords = await findMatchingRecords(
        ownerId,
        cleanName,
        source,
        unit
      );

      const ids = matchingRecords.map(item => item._id);

      if (ids.length > 0) {
        await FeedRecord.deleteMany({
          ownerId,
          _id: { $in: ids }
        });
      }

      return res.status(201).json({
        message:
          "साठा शून्य झाला. त्या वस्तूचे संबंधित records delete केले.",
        deleted: true,
        stock: 0
      });
    }

    return res.status(201).json({
      message: "नोंद यशस्वीरीत्या सेव्ह झाली.",
      deleted: false,
      remainingStock: remaining,
      record
    });
  } catch (error) {
    console.error("Feed POST error:", error);

    return res.status(500).json({
      message: error.message || "नोंद सेव्ह करता आली नाही."
    });
  }
});

// DELETE /api/feed/:id
// फक्त स्वतःचा record delete करता येईल.
router.delete("/:id", async (req, res) => {
  try {
    const ownerId = ownerIdFromRequest(req);
    const { id } = req.params;

    if (!ownerId) {
      return res.status(401).json({
        message: "Login आवश्यक आहे."
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Record ID योग्य नाही."
      });
    }

    const deletedRecord = await FeedRecord.findOneAndDelete({
      _id: id,
      ownerId
    });

    if (!deletedRecord) {
      return res.status(404).json({
        message: "Record सापडला नाही किंवा तो तुमचा नाही."
      });
    }

    return res.status(200).json({
      message: "Record यशस्वीरीत्या delete झाला.",
      deleted: true,
      record: deletedRecord
    });
  } catch (error) {
    console.error("Feed DELETE error:", error);

    return res.status(500).json({
      message: "Record delete करता आला नाही."
    });
  }
});

module.exports = router;
