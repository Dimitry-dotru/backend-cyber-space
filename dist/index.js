"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const express_session_1 = __importDefault(require("express-session"));
const passport_steam_1 = __importDefault(require("passport-steam"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const SteamStrategy = passport_steam_1.default.Strategy;
const app = (0, express_1.default)();
passport_1.default.serializeUser((user, done) => {
    done(null, user);
});
passport_1.default.deserializeUser((user, done) => {
    done(null, user);
});
passport_1.default.use(new SteamStrategy({
    returnURL: "http://localhost:3000",
    realm: "http://localhost:7069/",
    apiKey: "BDE51B80D4D4E0257B60610C0B3FE6F6",
}, function (identifier, profile, done) {
    process.nextTick(function () {
        profile.identifier = identifier;
        return done(null, profile);
    });
}));
app.use((0, express_session_1.default)({
    secret: "My_secret",
    saveUninitialized: true,
    resave: false,
    cookie: {
        maxAge: 3600000
    }
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});
app.use("/steam", (0, http_proxy_middleware_1.createProxyMiddleware)({
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
    console.log(req.user);
});
app.get("/api/auth/steam", passport_1.default.authenticate("steam", { failureRedirect: "/" }), function (req, res) {
    // res.redirect("/")
    res.redirect("http://localhost:3000");
});
app.get("/api/auth/steam/return", passport_1.default.authenticate("steam", { failureRedirect: "/" }), function (req, res) {
    const steamId = req.user.id;
    const redirectUrl = `http://localhost:3000/?steamId=${steamId}`;
    res.redirect(redirectUrl);
});
//# sourceMappingURL=index.js.map