import express from "express";
import passport from "passport";
import session from "express-session";
import { createProxyMiddleware } from "http-proxy-middleware";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";

const app = express();
const secret = "MySecretFrase";

declare global {
  namespace Express {
    interface Request {
      // user?: any;
      // sessionStore?: {
      //   sessions: any;
      // };
    }
  }
}

declare module "express-session" {
  interface SessionData {
    user: any;
    sessions: any;
  }
}

// interface CustomMemoryStore extends MemoryStore {
//   sessions: { [sid: string]: any };
// }

// use session
app.use(
  session({
    secret: secret,
    saveUninitialized: true,
    resave: false,
    cookie: {
      maxAge: 3600000,
    },
  })
);
app.use(bodyParser.json());
app.use(cookieParser(secret));
// use headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});
// use proxy server
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

export { app, passport };
import "./config/passport";
import "./routes/index";