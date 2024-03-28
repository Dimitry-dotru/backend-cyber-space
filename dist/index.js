const express = require('express');
const passport = require('passport');
const session = require('express-session');
const passportSteam = require('passport-steam');
const SteamStrategy = passportSteam.Strategy;
const app = express();
const port = 7069;
const backendServer = `http://localhost:${port}`;
const frontendServer = "http://localhost:3000";
const apiKey = "BDE51B80D4D4E0257B60610C0B3FE6F6";
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});
passport.use(new SteamStrategy({
    returnURL: backendServer + "/api/auth/steam/return",
    realm: backendServer + "/",
    apiKey: apiKey,
}, function (identifier, profile, done) {
    process.nextTick(function () {
        profile.identifier = identifier;
        return done(null, profile);
    });
}));
app.use(session({
    secret: 'Whatever_You_Want',
    saveUninitialized: true,
    resave: false,
    cookie: {
        maxAge: 3600000
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.listen(port, () => {
    console.log('Listening, port ' + port);
});
app.get('/', (req, res) => {
    res.send(req.user);
    console.log(req.user);
});
app.get('/api/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), function (req, res) {
    res.redirect('/');
});
app.get('/api/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), function (req, res) {
    const steamId = req.user.id;
    const redirectUrl = `${frontendServer}/?steamId=${steamId}`;
    res.redirect(redirectUrl);
    // res.redirect("/")
    // res.redirect('http://localhost:300?steamId=')
});
