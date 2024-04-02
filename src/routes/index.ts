import { app, passport} from "../index";
import config from "../config/index";

app.listen(config.serverPort, () => {
  console.log("Listening, port " + config.serverPort);
});

app.get(
  "/api/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  function (req, res) {
    res.redirect(config.frontendServer);
  }
);

app.get("/", (req, res) => {
  const sessionID = req.query.sessionID;
  const userBySessionID = req.sessionStore["sessions"][sessionID];
  
  if (!userBySessionID) {
    res.sendStatus(404);
    return;
  }
  const user = JSON.parse(userBySessionID)["user"]["_json"];
  res.send(JSON.stringify(user));
});

app.get(
  "/api/auth/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    const redirectUrl = `${config.frontendServer}?sessionID=${req.sessionID}`;
    req.session.user = req.user;
    res.redirect(redirectUrl);
  }
);

app.post("/logout", (req, res) => {
  // deleting of session
});