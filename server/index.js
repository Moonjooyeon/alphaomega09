const path = require("node:path");
const express = require("express");
const config = require("./config");
const { migrate } = require("./db");
const authRoutes = require("./routes/auth");
const geminiRoutes = require("./routes/gemini");
const healthRoutes = require("./routes/health");
const iapRoutes = require("./routes/iap");
const passesRoutes = require("./routes/passes");
const purchasesRoutes = require("./routes/purchases");
const usageRoutes = require("./routes/usage");
const { jsonError } = require("./utils");

const app = express();

app.set("trust proxy", true);
app.use(express.json({ limit: `${Math.ceil(config.maxRequestBytes / 1024)}kb` }));

app.use("/", healthRoutes);
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", iapRoutes);
app.use("/api", passesRoutes);
app.use("/api", purchasesRoutes);
app.use("/api", usageRoutes);
app.use("/api", geminiRoutes);

app.use(express.static(path.join(__dirname, "..", "dist")));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.use((error, _req, res, next) => {
  if (!error) return next();
  if (error.type === "entity.too.large") {
    res.status(413).json(jsonError("요청 이미지가 너무 큽니다. 더 작은 이미지로 다시 접수해 주십시오."));
    return;
  }
  res.status(500).json(jsonError(error?.message || "서버 오류가 발생했습니다."));
});

migrate()
  .then(() => {
    app.listen(config.port, "0.0.0.0", () => {
      console.log(`alphaomega backend listening on ${config.port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
