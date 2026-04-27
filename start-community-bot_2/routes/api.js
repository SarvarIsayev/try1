const express = require("express");
const router = express.Router();
const { userFns, goalFns, taskFns, scoreFns, adminFns } = require("../db/database");

// ─────────────────────────────────────
//  FOYDALANUVCHI
// ─────────────────────────────────────

router.get("/user/:telegramId", (req, res) => {
  try {
    const user = userFns.getByTelegramId(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: "Topilmadi" });

    const goals = goalFns.getAll(user.telegram_id);
    const tasks = taskFns.getAll(user.telegram_id);
    const scores = scoreFns.getAll(user.telegram_id);

    const weeklyTasks = {};
    tasks.forEach(t => {
      if (!weeklyTasks[t.sphere]) weeklyTasks[t.sphere] = [];
      weeklyTasks[t.sphere].push(t);
    });

    res.json({ ...user, goals, weeklyTasks, scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/user/register", (req, res) => {
  try {
    const { telegramId, firstName, lastName, phone, username } = req.body;

    const adminPhones = (process.env.ADMIN_PHONES || "").split(",").map(p => p.trim());
    const isAdmin = adminPhones.some(ap => {
      const c1 = (phone || "").replace(/[\s\-()]/g, "");
      const c2 = ap.replace(/[\s\-()]/g, "");
      return c1 === c2 || c1.endsWith(c2) || c2.endsWith(c1);
    });

    const user = userFns.register({ telegramId, firstName, lastName, phone, username, isAdmin });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  ASOSIY MAQSAD
// ─────────────────────────────────────

router.put("/user/:telegramId/main-goal", (req, res) => {
  try {
    userFns.updateMainGoal(Number(req.params.telegramId), req.body.mainGoal);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  MAQSADLAR
// ─────────────────────────────────────

router.get("/user/:telegramId/goals", (req, res) => {
  try {
    res.json(goalFns.getAll(Number(req.params.telegramId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/user/:telegramId/goals", (req, res) => {
  try {
    const goals = goalFns.add(Number(req.params.telegramId), req.body.text, req.body.description);
    res.json(goals);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/user/:telegramId/goals/:goalId", (req, res) => {
  try {
    const goals = goalFns.update(Number(req.params.goalId), Number(req.params.telegramId), req.body);
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/user/:telegramId/goals/:goalId", (req, res) => {
  try {
    const goals = goalFns.delete(Number(req.params.goalId), Number(req.params.telegramId));
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  VAZIFALAR
// ─────────────────────────────────────

router.get("/user/:telegramId/tasks/:sphere", (req, res) => {
  try {
    res.json(taskFns.getBySphere(Number(req.params.telegramId), req.params.sphere));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/user/:telegramId/tasks/:sphere", (req, res) => {
  try {
    const tasks = taskFns.add(
      Number(req.params.telegramId), req.params.sphere,
      req.body.text, req.body.deadline
    );
    res.json(tasks);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/user/:telegramId/tasks/:sphere/:taskId", (req, res) => {
  try {
    taskFns.update(Number(req.params.taskId), Number(req.params.telegramId), req.body);
    res.json(taskFns.getBySphere(Number(req.params.telegramId), req.params.sphere));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/user/:telegramId/tasks/:sphere/:taskId", (req, res) => {
  try {
    const tasks = taskFns.delete(Number(req.params.taskId), Number(req.params.telegramId));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────

router.get("/admin/users", (req, res) => {
  try {
    res.json(userFns.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/admin/scores/:telegramId", (req, res) => {
  try {
    const scores = scoreFns.updateMultiple(Number(req.params.telegramId), req.body.scores);
    res.json({ scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/overview", (req, res) => {
  try {
    res.json(adminFns.getOverview());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
