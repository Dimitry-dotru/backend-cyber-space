import express from "express";
import passport from "passport";
import session from "express-session";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

declare global {
  namespace Express {
    // добавляем в интерфейс Request поле user, sessionID
    interface Request {
      user?: any;
      sessionID?: any;
    }
  }
}

app.use(
  session({
    secret: "MySecretFraze",
    saveUninitialized: true,
    resave: false,
    cookie: {
      maxAge: 3600000,
    },
  })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

app.use(
  "/steam",
  createProxyMiddleware({
    target: "https://api.steampowered.com",
    changeOrigin: true,
    pathRewrite: {
      "^/steam": "", // Убираем "/steam" из пути
    },
  })
);

import "./config/passport";
import "./routes/index";
export { app, passport };
