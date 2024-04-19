import { app, passport } from "../index";
import config from "../config/index";
import crypto from "crypto";
import mysql from "mysql2/promise";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "pkcs1",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs1",
    format: "pem",
  },
});

const encriptString = (str: string) => {
  const encriptedString = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(str, "utf8")
  );
  return encriptedString.toString("hex");
};

const decriptString = (str: string) => {
  const encriptedString = Buffer.from(str, "hex");
  const decryptedData = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encriptedString
  );

  return decryptedData.toString("utf8");
};

app.listen(config.serverPort, async () => {
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
  const sessionID = decriptString(req.query.sessionID as string);
  const userBySessionID = req.sessionStore["sessions"][sessionID];

  // здесь в бд нужно занести id сессии пользователя, и его steamID 

  const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "users",
    port: 5800,
    password: "tbQn8Z#458+!_XM",
  });

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
    const encriptedID = encriptString(req.sessionID);
    const redirectUrl = `${config.frontendServer}?sessionID=${encriptedID}`;
    req.session.user = req.user;
    res.redirect(redirectUrl);
  }
);

app.post("/logout", (req, res) => {
  try {
    const sessionID = decriptString(req.query.sessionID as string);
    delete req.sessionStore["sessions"][sessionID];
    res.sendStatus(200);
  } catch (e) {
    res.statusMessage = "Error deleting session!";
    res.sendStatus(400);
  }
});
