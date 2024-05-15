import { app, passport } from "../index";
import { encriptString, decriptString } from "../utils";
import config from "../config/index";
import mongoose from "mongoose";
import sharp from "sharp";
import fs from "fs";

const MONGO_URL = process.env.mongoURL;
const BACKEND_IP = "http://localhost";

const defaultPicsPath = `${BACKEND_IP}:${process.env.port}/users_data/default_pictures_user`;

const cyberspace_settings = {
  public: {
    userbgpattern: `${defaultPicsPath}/bg-pattern.png`,
    userbanner: `${defaultPicsPath}/banner_default.webp`,
  },
  private: {
    secret_field: "secret",
  },
};

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("DB connected.");
    app.listen(config.serverPort, async () => {
      console.log("Listening, port " + config.serverPort);
    });
  })
  .catch((err) => console.error(err));

const userSchema = new mongoose.Schema({
  user: {
    avatar: String,
    avatarfull: String,
    avatarhash: String,
    avatarmedium: String,
    communityvisibilitystate: Number,
    lastlogoff: Number,
    loccountrycode: String,
    locstatecode: String,
    personaname: String,
    personastate: Number,
    personastateflags: Number,
    primaryclanid: String,
    profilestate: Number,
    profileurl: String,
    steamid: String,
    timecreated: Number,

    // my fields:
    cyberspace_settings: {
      public: {
        userbanner: String,
        userbgpattern: String,
      },
      private: {},
    },
  },
  sessionID: String,
});

const userModel = mongoose.model("users", userSchema);

// тут авторизация в стим
app.get(
  "/api/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  function (req, res) {
    res.redirect(config.frontendServer);
  }
);

// проверка пользователя на авторизацию
app.get("/", async (req, res) => {
  // поулчаем зашифрованный id сессии
  const sessionIDEncripted = req.query.sessionID as string;

  // если сессии не было
  if (!sessionIDEncripted) {
    res.sendStatus(404);
    return;
  }

  // пробуем расшифровать сессию и отправить пользователю данные
  try {
    const sessionIDEncoded = req.query.sessionID as string;
    const sessionID = decriptString(sessionIDEncoded);
    const userBySessionID = req.sessionStore["sessions"][sessionID];

    if (!userBySessionID) {
      res.sendStatus(404);
      return;
    }
    const user = JSON.parse(userBySessionID)["passport"]["user"];
    res.json(user);
  } catch (e) {
    res.sendStatus(500);
  }
});

// получаем пользователя с бд, если есть - отсылаем, нету - посылаем запрос на стим, модифицируем и отправляем на фронт
app.get("/user/:steamid", async (req, res) => {
  const steamid = req.params.steamid;

  const userInDb = await userModel.findOne({ "user.steamid": steamid });

  if (!userInDb) {
    // sending request to steam...
    const data = await fetch(
      `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.apiKey}&steamids=${steamid}`
    );
    if (!data.ok) {
      res.send(null);
      return;
    }
    try {
      const steamUser = (await data.json()).response.players[0];
      steamUser.cyberspace_settings = { public: {} };
      steamUser.cyberspace_settings.public = cyberspace_settings.public;

      res.json(steamUser);
      return;
    } catch (e) {
      console.error(e);
      res.send(null);
      return;
    }
  }

  res.json(userInDb);
});

// когда авторизация закончилась, редирект на фронтент
app.get(
  "/api/auth/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  async (req, res) => {
    const encriptedID = encriptString(req.sessionID);
    const redirectUrl = `${config.frontendServer}?sessionID=${encriptedID}`;
    const steamid = req.user["_json"].steamid;
    const userInDb = await userModel.findOne({ "user.steamid": steamid });

    // чуть редактируем сохраняемый объект, чтобы меньше лишнего было
    req.session["passport"].user = userInDb ? userInDb.user : req.user["_json"];

    // создать папку с steamid пользователя
    /**
     * в ней хранитятся файлы:
     * user_profile_photo (разного качества)
     * user_profile_bg_image <- banner img
     * user_theme_bg_image <- bg pattern of site
     */

    if (!userInDb) {
      req.user["_json"].cyberspace_settings = cyberspace_settings;

      const newUser = new userModel({
        sessionID: encriptedID,
        user: req.user["_json"],
      });

      await newUser.save();
      //! user folder creating if wasn't found in db
    }

    res.redirect(redirectUrl);
  }
);

// смена аватара
app.post("/change-avatar/:steamid", async (req, res) => {
  const steamid = req.params.steamid;

  try {
    if (!req.body.image) {
      return res.status(400).json({
        success: false,
        message: "Missing image",
      });
    }

    // удаляем те части в закодированном изображении, которые не могут обрабатываться base64
    req.body.image = req.body.image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(req.body.image, "base64");

    if (!fs.existsSync(`users_data/${steamid}`)) {
      fs.mkdirSync(`users_data/${steamid}`, { recursive: true });
    }

    const outputPath = `users_data/${steamid}/user_profile_photo.webp`;
    fs.writeFileSync(outputPath, imageBuffer);

    // Сжимаем изображение в 50% качества и сохраняем его
    const compressedImagePath = `users_data/${steamid}/user_profile_photo_medium.webp`;
    await sharp(imageBuffer)
      .webp({ quality: 30 }) // Устанавливаем качество изображения на 50%
      .toFile(compressedImagePath);

    const userInDb = await userModel.findOne({ "user.steamid": steamid });

    if (userInDb) {
      userInDb.user.avatar = `${BACKEND_IP}:${process.env.port}/` + compressedImagePath;
      userInDb.user.avatarfull = `${BACKEND_IP}:${process.env.port}/` + outputPath;
      userInDb.user.avatarmedium =`${BACKEND_IP}:${process.env.port}/` + compressedImagePath;

      await userInDb.save();
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
  }
});

// разлогинивание
app.post("/logout", (req, res) => {
  try {
    // попытка удаления id сессии из текущих сессий
    const sessionID = decriptString(req.query.sessionID as string);
    delete req.sessionStore["sessions"][sessionID];
    res.sendStatus(200);
  } catch (e) {
    res.statusMessage = "Error deleting session!";
    res.sendStatus(400);
  }
});
