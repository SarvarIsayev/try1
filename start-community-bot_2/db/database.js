// ============================================
//  SQLite BAZA (sql.js — sof JavaScript, build kerak emas)
// ============================================

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "community.db");

let db = null;

// ─── 8 SOHA nomlari ───
const SPHERES = [
  "business", "finance", "health", "family",
  "relations", "parents", "growth", "hobbies"
];

// ─── Bazani saqlash (har bir o'zgarishdan keyin) ───
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ─── Bazani ishga tushirish ───
async function initDatabase() {
  const SQL = await initSqlJs();

  // Agar baza fayli bor bo'lsa — uni o'qish
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log("📂 Mavjud baza yuklandi: " + DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("🆕 Yangi baza yaratildi");
  }

  // Jadvallarni yaratish
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id     INTEGER UNIQUE NOT NULL,
      first_name      TEXT DEFAULT '',
      last_name       TEXT DEFAULT '',
      phone           TEXT DEFAULT '',
      username        TEXT DEFAULT '',
      is_admin        INTEGER DEFAULT 0,
      main_goal       TEXT DEFAULT '',
      registered_at   TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      sphere      TEXT NOT NULL,
      value       INTEGER DEFAULT 0,
      UNIQUE(telegram_id, sphere)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      text        TEXT NOT NULL,
      description TEXT DEFAULT '',
      done        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      sphere      TEXT NOT NULL,
      text        TEXT NOT NULL,
      deadline    TEXT DEFAULT NULL,
      done        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  saveDb();
  console.log("✅ Jadvallar tayyor");
  return db;
}

// ─── Yordamchi funksiyalar ───
// Bitta qator olish
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

// Ko'p qator olish
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Yozish (INSERT, UPDATE, DELETE)
function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ═══════════════════════════════════════
//  FOYDALANUVCHI
// ═══════════════════════════════════════
const userFns = {
  getByTelegramId(telegramId) {
    return getOne("SELECT * FROM users WHERE telegram_id = ?", [telegramId]);
  },

  getAll() {
    return getAll("SELECT * FROM users ORDER BY registered_at DESC");
  },

  register({ telegramId, firstName, lastName, phone, username, isAdmin }) {
    const existing = this.getByTelegramId(telegramId);
    if (existing) return existing;

    run(
      `INSERT INTO users (telegram_id, first_name, last_name, phone, username, is_admin)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [telegramId, firstName || "", lastName || "", phone || "", username || "", isAdmin ? 1 : 0]
    );

    // Har bir soha uchun boshlang'ich ball
    for (const sphere of SPHERES) {
      run(
        `INSERT OR IGNORE INTO scores (telegram_id, sphere, value) VALUES (?, ?, 0)`,
        [telegramId, sphere]
      );
    }

    return this.getByTelegramId(telegramId);
  },

  updatePhone(telegramId, phone, isAdmin) {
    run("UPDATE users SET phone = ?, is_admin = ? WHERE telegram_id = ?",
      [phone, isAdmin ? 1 : 0, telegramId]);
  },

  updateMainGoal(telegramId, mainGoal) {
    run("UPDATE users SET main_goal = ? WHERE telegram_id = ?", [mainGoal, telegramId]);
  },
};

// ═══════════════════════════════════════
//  MAQSADLAR (GOALS)
// ═══════════════════════════════════════
const goalFns = {
  getAll(telegramId) {
    return getAll("SELECT * FROM goals WHERE telegram_id = ? ORDER BY id", [telegramId]);
  },

  add(telegramId, text, description = "") {
    const count = getOne("SELECT COUNT(*) as cnt FROM goals WHERE telegram_id = ?", [telegramId]);
    if (count && count.cnt >= 10) throw new Error("Maksimum 10 ta maqsad");

    run("INSERT INTO goals (telegram_id, text, description) VALUES (?, ?, ?)",
      [telegramId, text, description]);
    return this.getAll(telegramId);
  },

  update(goalId, telegramId, updates) {
    if (updates.text !== undefined)
      run("UPDATE goals SET text = ? WHERE id = ? AND telegram_id = ?", [updates.text, goalId, telegramId]);
    if (updates.description !== undefined)
      run("UPDATE goals SET description = ? WHERE id = ? AND telegram_id = ?", [updates.description, goalId, telegramId]);
    if (updates.done !== undefined)
      run("UPDATE goals SET done = ? WHERE id = ? AND telegram_id = ?", [updates.done ? 1 : 0, goalId, telegramId]);
    return this.getAll(telegramId);
  },

  delete(goalId, telegramId) {
    run("DELETE FROM goals WHERE id = ? AND telegram_id = ?", [goalId, telegramId]);
    return this.getAll(telegramId);
  },
};

// ═══════════════════════════════════════
//  VAZIFALAR (TASKS)
// ═══════════════════════════════════════
const taskFns = {
  getBySphere(telegramId, sphere) {
    return getAll("SELECT * FROM tasks WHERE telegram_id = ? AND sphere = ? ORDER BY id",
      [telegramId, sphere]);
  },

  getAll(telegramId) {
    return getAll("SELECT * FROM tasks WHERE telegram_id = ? ORDER BY sphere, id", [telegramId]);
  },

  add(telegramId, sphere, text, deadline = null) {
    if (!SPHERES.includes(sphere)) throw new Error("Noto'g'ri soha: " + sphere);
    run("INSERT INTO tasks (telegram_id, sphere, text, deadline) VALUES (?, ?, ?, ?)",
      [telegramId, sphere, text, deadline]);
    return this.getBySphere(telegramId, sphere);
  },

  update(taskId, telegramId, updates) {
    if (updates.text !== undefined)
      run("UPDATE tasks SET text = ? WHERE id = ? AND telegram_id = ?", [updates.text, taskId, telegramId]);
    if (updates.deadline !== undefined)
      run("UPDATE tasks SET deadline = ? WHERE id = ? AND telegram_id = ?", [updates.deadline, taskId, telegramId]);
    if (updates.done !== undefined)
      run("UPDATE tasks SET done = ? WHERE id = ? AND telegram_id = ?", [updates.done ? 1 : 0, taskId, telegramId]);
  },

  delete(taskId, telegramId) {
    const task = getOne("SELECT sphere FROM tasks WHERE id = ? AND telegram_id = ?", [taskId, telegramId]);
    run("DELETE FROM tasks WHERE id = ? AND telegram_id = ?", [taskId, telegramId]);
    return task ? this.getBySphere(telegramId, task.sphere) : [];
  },
};

// ═══════════════════════════════════════
//  BALLAR (SCORES)
// ═══════════════════════════════════════
const scoreFns = {
  getAll(telegramId) {
    const rows = getAll("SELECT sphere, value FROM scores WHERE telegram_id = ?", [telegramId]);
    const result = {};
    for (const r of rows) result[r.sphere] = r.value;
    for (const s of SPHERES) if (result[s] === undefined) result[s] = 0;
    return result;
  },

  update(telegramId, sphere, value) {
    if (!SPHERES.includes(sphere)) throw new Error("Noto'g'ri soha");
    value = Math.max(0, Math.min(10, value));
    run(
      `INSERT INTO scores (telegram_id, sphere, value) VALUES (?, ?, ?)
       ON CONFLICT(telegram_id, sphere) DO UPDATE SET value = ?`,
      [telegramId, sphere, value, value]
    );
  },

  updateMultiple(telegramId, scores) {
    for (const [sphere, value] of Object.entries(scores)) {
      if (SPHERES.includes(sphere)) {
        this.update(telegramId, sphere, value);
      }
    }
    return this.getAll(telegramId);
  },
};

// ═══════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════
const adminFns = {
  getOverview() {
    const users = getAll("SELECT * FROM users WHERE is_admin = 0");
    return users.map(u => {
      const goals = goalFns.getAll(u.telegram_id);
      const tasks = taskFns.getAll(u.telegram_id);
      const scores = scoreFns.getAll(u.telegram_id);
      const doneGoals = goals.filter(g => g.done).length;
      const doneTasks = tasks.filter(t => t.done).length;
      const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 8;

      return {
        telegramId: u.telegram_id,
        name: `${u.first_name} ${u.last_name}`.trim(),
        phone: u.phone,
        goalsProgress: `${doneGoals}/${goals.length}`,
        tasksProgress: `${doneTasks}/${tasks.length}`,
        avgScore: avgScore.toFixed(1),
        scores,
      };
    });
  },
};

module.exports = {
  initDatabase, SPHERES,
  userFns, goalFns, taskFns, scoreFns, adminFns,
};
