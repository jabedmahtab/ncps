const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, "data.db");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    file_path TEXT,
    lat REAL,
    lng REAL,
    amber_child_name TEXT,
    amber_child_age TEXT,
    amber_last_location TEXT,
    amber_more_info TEXT,
    amber_sms TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    result TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Safe migration: add result column if it doesn't exist
  db.run(`ALTER TABLE complaints ADD COLUMN result TEXT`, (err) => {
    if (err && !String(err.message).includes("duplicate column")) {
      console.log("DB migration notice:", err.message);
    }
  });
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(
  session({
    secret: "ncps-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e9);
    cb(null, unique + "_" + safeName);
  },
});
const upload = multer({ storage });

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

const ADMIN_EMAIL = "boymahmud4039@gmail.com";
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.email !== ADMIN_EMAIL) {
    return res.status(403).send("Forbidden");
  }
  next();
}

function formatNow() {
  return new Date().toISOString();
}

const services = [
  {
    id: "life-saving",
    name: "Life Saving",
    items: [
      { key: "child_girl_harassment", label: "Child & Girl Harassment" },
      { key: "amber_alert", label: "Amber Alert" },
      { key: "emergency_help", label: "Emergency Help (999)" },
    ],
  },
  {
    id: "defence-corruption",
    name: "Defence Corruption",
    items: [
      { key: "govt_sector", label: "Corruption in Govt Sector" },
      { key: "social_sector", label: "Corruption in Social Sector" },
      { key: "other_corruption", label: "Corruption in Other" },
    ],
  },
  {
    id: "harassment-cheating",
    name: "Harassment & Cheating",
    items: [
      { key: "food_sector", label: "Food Sector" },
      { key: "medical_sector", label: "Medical Sector" },
      { key: "education_sector", label: "Education Sector" },
      { key: "agriculture_sector", label: "Agriculture Sector" },
      { key: "other_harass", label: "Other" },
    ],
  },
  {
    id: "land-property",
    name: "Land & Property",
    items: [
      { key: "land_problem", label: "Land Problem" },
      { key: "property", label: "Property" },
      { key: "land_vat", label: "Land VAT" },
      { key: "other_land", label: "Other" },
    ],
  },
  {
    id: "cyber-security",
    name: "Cyber Security",
    items: [
      { key: "cyber_bullying", label: "Cyber Bullying" },
      { key: "cyber_harassment", label: "Cyber Harassment" },
      { key: "hacking", label: "Hacking" },
      { key: "other_cyber", label: "Other" },
    ],
  },
  {
    id: "ai-help",
    name: "AI Help",
    items: [
      { key: "legal_guidance", label: "Legal Guidance" },
      { key: "safety_plan", label: "Safety Plan" },
      { key: "reporting_tips", label: "Reporting Tips" },
    ],
  },
];

app.get("/", (req, res) => {
  res.render("home", { user: req.session.user, services });
});

app.get("/register", (req, res) => {
  res.render("register", { error: null });
});

app.post("/register", (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.render("register", { error: "সব ঘর পূরণ করতে হবে।" });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const created_at = formatNow();

  db.run(
    `INSERT INTO users (name, email, phone, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?)` ,
    [name, email, phone || "", password_hash, created_at],
    function (err) {
      if (err) {
        return res.render("register", { error: "এই ইমেইল ইতিমধ্যে ব্যবহার হয়েছে।" });
      }
      req.session.user = { id: this.lastID, name, email };
      res.redirect("/profile");
    }
  );
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) {
      return res.render("login", { error: "ভুল ইমেইল বা পাসওয়ার্ড।" });
    }
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.render("login", { error: "ভুল ইমেইল বা পাসওয়ার্ড।" });
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/profile");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/profile", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  db.all(
    `SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      res.render("profile", { user: req.session.user, complaints: rows || [] });
    }
  );
});

app.get("/admin", requireAuth, requireAdmin, (req, res) => {
  db.all(
    `SELECT c.*, u.name as user_name, u.email as user_email
     FROM complaints c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.created_at DESC`,
    [],
    (err, rows) => {
      res.render("admin", { user: req.session.user, complaints: rows || [] });
    }
  );
});

app.post("/admin/complaint/update", requireAuth, requireAdmin, (req, res) => {
  const { id, status, result } = req.body;
  if (!id) return res.redirect("/admin");
  db.run(
    `UPDATE complaints SET status = ?, result = ? WHERE id = ?`,
    [status || "Pending", result || "", id],
    () => res.redirect("/admin")
  );
});

app.get("/service/:id", (req, res) => {
  const service = services.find((s) => s.id === req.params.id);
  if (!service) return res.status(404).send("Not found");
  res.render("service", { user: req.session.user, service });
});

app.get("/complaint/new", requireAuth, (req, res) => {
  const service = services.find((s) => s.id === req.query.service);
  const category = (service?.items || []).find((i) => i.key === req.query.category);
  if (!service || !category) return res.redirect("/");
  res.render("complaint", { user: req.session.user, service, category, error: null, success: null });
});

app.post("/complaint", requireAuth, upload.single("attachment"), (req, res) => {
  const { service_id, category_key, title, description, lat, lng, amber_child_name, amber_child_age, amber_last_location, amber_more_info } = req.body;
  const service = services.find((s) => s.id === service_id);
  const category = (service?.items || []).find((i) => i.key === category_key);
  if (!service || !category || !title || !description) {
    return res.render("complaint", { user: req.session.user, service, category, error: "সব ঘর পূরণ করতে হবে।", success: null });
  }

  let amber_sms = null;
  if (category_key === "amber_alert") {
    amber_sms = `AMBERT ALERT: শিশু: ${amber_child_name || "-"}, বয়স: ${amber_child_age || "-"}, শেষ অবস্থান: ${amber_last_location || "-"}. তথ্য: ${amber_more_info || "-"}.`;
  }

  const file_path = req.file ? `/uploads/${req.file.filename}` : "";
  const created_at = formatNow();

  db.run(
    `INSERT INTO complaints (user_id, service, category, title, description, file_path, lat, lng, amber_child_name, amber_child_age, amber_last_location, amber_more_info, amber_sms, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?)` ,
    [
      req.session.user.id,
      service.name,
      category.label,
      title,
      description,
      file_path,
      lat || null,
      lng || null,
      amber_child_name || "",
      amber_child_age || "",
      amber_last_location || "",
      amber_more_info || "",
      amber_sms,
      created_at,
    ],
    function (err) {
      if (err) {
        return res.render("complaint", { user: req.session.user, service, category, error: "সাবমিট ব্যর্থ হয়েছে।", success: null });
      }
      res.render("complaint", { user: req.session.user, service, category, error: null, success: "সফলভাবে জমা হয়েছে।" });
    }
  );
});

app.get("/ai-help", (req, res) => {
  res.render("ai-help", { user: req.session.user, answer: null });
});

app.post("/ai-help", (req, res) => {
  const { question } = req.body;
  let answer = "দয়া করে বিস্তারিত লিখুন, আমরা আপনাকে সহায়তা দেব।";
  const q = (question || "").toLowerCase();
  if (q.includes("হ্যাক") || q.includes("hacking")) {
    answer = "হ্যাকিং সমস্যা হলে: পাসওয়ার্ড পরিবর্তন, 2FA চালু, এবং দ্রুত অভিযোগ দিন।";
  } else if (q.includes("ভোগান্তি") || q.includes("হ্যারাস")) {
    answer = "হ্যারাসমেন্ট হলে: প্রমাণ সংরক্ষণ করুন, তারিখ/সময় লিখে রাখুন, এবং অভিযোগ করুন।";
  } else if (q.includes("দুর্নীতি") || q.includes("corruption")) {
    answer = "দুর্নীতি রিপোর্টে নাম গোপন রাখা যাবে। প্রমাণ বা তথ্য যুক্ত করুন।";
  }
  res.render("ai-help", { user: req.session.user, answer });
});

app.listen(PORT, () => {
  console.log(`NCPS server running on http://localhost:${PORT}`);
});
