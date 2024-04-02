import { passport, app } from "../index";
import passportSteam from "passport-steam";
const SteamStrategy = passportSteam.Strategy;
import config from ".";

passport.use(
  new SteamStrategy(
    {
      returnURL: config.backendServer + "/api/auth/steam/return",
      realm: config.backendServer + "/",
      apiKey: config.apiKey,
    },
    function (identifier, profile, done) {
      process.nextTick(function () {
        profile.identifier = identifier;
        return done(null, profile);
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());