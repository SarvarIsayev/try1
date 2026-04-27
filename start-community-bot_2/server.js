// ============================================
//  START COMMUNITY - SERVER (sql.js)
// ============================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Bot, InlineKeyboard } = require("grammy");
const { initDatabase, userFns, goalFns, taskFns, scoreFns } = require("./db/database");

// ─── Sozlamalar ───
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://example.com";
const ADMIN_PHONES = (process.env.ADMIN_PHONES || "").split(",").map(p => p.trim());

// ─── Debug ───
console.log("🔍 Muhit o'zgaruvchilari:");
console.log("   BOT_TOKEN:", BOT_TOKEN ? "✅ bor (" + BOT_TOKEN.length + " belgi)" : "❌ TOPILMADI!");
console.log("   WEBAPP_URL:", WEBAPP_URL);
console.log("   PORT:", PORT);
console.log("   Barcha env kalitlari:", Object.keys(process.env).filter(k => !k.startsWith("npm_")).join(", "));

// ─── Express ───
const app = express();
app.use(cors());
app.use(express.json());

const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "✅ Start Community ishlayapti!",
    bot: BOT_TOKEN ? "✅ Bot ulangan" : "❌ BOT_TOKEN topilmadi",
    database: "SQLite",
    time: new Date().toISOString(),
  });
});

// ─── ISHGA TUSHIRISH ───
async function main() {
  await initDatabase();
  console.log("📦 SQLite baza tayyor");

  app.listen(PORT, () => {
    console.log("🌐 Server: http://localhost:" + PORT);
  });

  // Bot faqat token bor bo'lsa ishlaydi (crash qilmaydi)
  if (!BOT_TOKEN) {
    console.log("⚠️  BOT_TOKEN yo'q — bot ishga tushmaydi, faqat API ishlaydi");
    console.log("   Railway Variables da BOT_TOKEN qo'shing");
    return;
  }

  console.log("🤖 Bot ishga tushmoqda...");
  const bot = new Bot(BOT_TOKEN);

  bot.command("start", async (ctx) => {
    const tgUser = ctx.from;
    let dbUser = userFns.getByTelegramId(tgUser.id);
    if (!dbUser) {
      dbUser = userFns.register({
        telegramId: tgUser.id,
        firstName: tgUser.first_name || "",
        lastName: tgUser.last_name || "",
        username: tgUser.username || "",
        phone: "",
        isAdmin: false,
      });
    }
    const keyboard = new InlineKeyboard().webApp("📱 Ilovani ochish", WEBAPP_URL);
    await ctx.reply(
      "Assalomu alaykum, " + tgUser.first_name + "! 👋\n\n" +
      "🚀 Start Community ga xush kelibsiz!\n\n" +
      "Bu bot sizga:\n" +
      "🎯 3 oylik maqsadlarni belgilash\n" +
      "📅 Haftalik rejalar tuzish\n" +
      "✅ Kunlik vazifalarni kuzatish\n" +
      "📊 8 ta hayot sohasini baholash\n\n" +
      "imkonini beradi.\n\n" +
      "👇 Quyidagi tugmani bosing:",
      { reply_markup: keyboard }
    );
  });

  bot.command("mystats", async (ctx) => {
    const dbUser = userFns.getByTelegramId(ctx.from.id);
    if (!dbUser) return ctx.reply("❌ Avval /start buyrug'ini bosing.");
    const goals = goalFns.getAll(ctx.from.id);
    const tasks = taskFns.getAll(ctx.from.id);
    const scores = scoreFns.getAll(ctx.from.id);
    const doneGoals = goals.filter(g => g.done).length;
    const doneTasks = tasks.filter(t => t.done).length;
    const labels = {
      business: "💼 Biznes", finance: "💰 Moliya", health: "🏃 Sog'liq",
      family: "👨‍👩‍👧‍👦 Oila", relations: "🤝 Munosabat", parents: "👪 Ota-Ona",
      growth: "📚 O'sish", hobbies: "🎨 Qiziqish",
    };
    let scoreText = "";
    for (const [key, label] of Object.entries(labels)) {
      const val = scores[key] || 0;
      scoreText += label + "\n" + "█".repeat(val) + "░".repeat(10 - val) + " " + val + "/10\n\n";
    }
    await ctx.reply(
      "📊 Sizning statistikangiz\n\n" +
      "🎯 Asosiy maqsad:\n" + (dbUser.main_goal || "Belgilanmagan") + "\n\n" +
      "📝 Maqsadlar: " + doneGoals + "/" + goals.length + " bajarildi\n" +
      "✅ Vazifalar: " + doneTasks + "/" + tasks.length + " bajarildi\n\n" +
      "📊 Soha ballari:\n\n" + scoreText
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📖 Buyruqlar:\n\n" +
      "/start — Botni boshlash, Mini App ochish\n" +
      "/mystats — Statistikangizni ko'rish\n" +
      "/help — Yordam"
    );
  });

  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id === ctx.from.id) {
      const phone = contact.phone_number;
      const clean = phone.replace(/[\s\-()]/g, "");
      const isAdmin = ADMIN_PHONES.some(ap => {
        const c = ap.replace(/[\s\-()]/g, "");
        return clean === c || clean.endsWith(c) || c.endsWith(clean);
      });
      userFns.updatePhone(ctx.from.id, phone, isAdmin);
      await ctx.reply(isAdmin
        ? "👑 Raqamingiz saqlandi. Siz ADMIN sifatida tanildingiz!"
        : "✅ Telefon raqamingiz saqlandi!"
      );
    }
  });

  bot.start();
  console.log("✅ Bot ishlayapti!");
}

main().catch(err => {
  console.error("❌ Xatolik:", err);
});
