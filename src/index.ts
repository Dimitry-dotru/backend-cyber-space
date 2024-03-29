import express from "express";
import passport from "passport";
import session from "express-session";
import passportSteam from "passport-steam";
import { createProxyMiddleware } from "http-proxy-middleware";

const SteamStrategy = passportSteam.Strategy;
const app = express();


declare global {
  namespace Express {
    // добавляем в интерфейс Request поле user
    interface Request {
      user?: any;
    }
  }
}

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

passport.use(
  new SteamStrategy(
    {
      returnURL: "http://localhost:3000",
      realm: "http://localhost:7069/",
      apiKey: "BDE51B80D4D4E0257B60610C0B3FE6F6",
    },
    function (identifier, profile, done) {
      process.nextTick(function () {
        profile.identifier = identifier;
        return done(null, profile);
      });
    }
  )
);

app.use(session({
	secret: "My_secret",
	saveUninitialized: true,
	resave: false,
	cookie: {
		maxAge: 3600000
	}
}));

app.use(passport.initialize());

app.use(passport.session());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

app.use("/steam", createProxyMiddleware({
  target: "https://api.steampowered.com",
  changeOrigin: true,
  pathRewrite: {
    "^/steam": "", // Убираем "/steam" из пути
  }
}));

app.listen(7069, () => {
	console.log("Listening, port " + 7069);
});

app.get("/", (req, res) => {
	
	res.send(req.user);
	console.log(req.user)
});

app.get("/api/auth/steam", passport.authenticate("steam", {failureRedirect: "/"}), function (req, res) {
	// res.redirect("/")
  res.redirect("http://localhost:3000");
});

app.get("/api/auth/steam/return", passport.authenticate("steam", {failureRedirect: "/"}), function (req, res) {
  const steamId = req.user.id;
  const redirectUrl = `http://localhost:3000/?steamId=${steamId}`;
  res.redirect(redirectUrl);
});
