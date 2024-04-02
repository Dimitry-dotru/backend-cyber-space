"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passport = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
exports.passport = passport_1.default;
const express_session_1 = __importDefault(require("express-session"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const app = (0, express_1.default)();
exports.app = app;
app.use((0, express_session_1.default)({
    secret: "MySecretFraze",
    saveUninitialized: true,
    resave: false,
    cookie: {
        maxAge: 3600000,
    },
}));
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
    },
}));
require("./config/passport");
require("./routes/index");
//# sourceMappingURL=index.js.map