import { app, passport } from "../index";
import config from "../config/index";

app.listen(config.serverPort, () => {
  console.log("Listening, port " + config.serverPort, config.serverPort);
});

const users = [];
app.get("/", (req, res) => {
  const sessionKey = req.sessionID;
  const user = users[sessionKey] ? users[sessionKey] : [];
  res.send(user);
});

app.get(
  "/api/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  function (req, res) {
    res.redirect(config.frontendServer);
  }
);

app.get(
  "/api/auth/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  function (req, res) {
    const steamId = req.user.id;
    users[req.sessionID] = req.user;
    const redirectUrl = `${config.frontendServer}`;
    res.redirect(redirectUrl);
  }
);
