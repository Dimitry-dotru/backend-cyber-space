import { app, passport } from "../index";
import { encriptString, decriptString } from "../utils";
import config from "../config/index";
import mongoose from "mongoose";
import fs from "fs";

const MONGO_URL = process.env.mongoURL;
const BACKEND_IP = "http://localhost";

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
    userbanner: String,
    userbgpattern: String,
  },
  sessionID: String,
});

// создание папки пользователя, по steamid в users-data
const createFolder = (steamid: string): void => {
  fs.access("../users-data", (err) => {
    if (err) {
      console.log("No folder, creating it...");
    } else {
      console.log("We have folder!");
    }
  });
  // console.log(__dirname);
};

//! поиск по своему полю какому-то
/**
 *
 * userModel.findOne({ "user.steamid": steamIdToSearch })
  .then((user) => {
    if (user) {
      console.log("Найден пользователь:", user);
    } else {
      console.log("Пользователь с указанным steamid не найден.");
    }
  })
  .catch((error) => {
    console.error("Ошибка при поиске пользователя:", error);
  });
 * 
 * 
 * 
 * 
 */

const userModel = mongoose.model("users", userSchema);

// тут авторизация в стим
app.get(
  "/api/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  function (req, res) {
    res.redirect(config.frontendServer);
  }
);

/**
 * ! пример того как можно сохранять пользователя, удаляя повторяющуюся запись
 * 
 * app.get("/users", async (req, res) => {
  const allUsers = await userModel.find();

  const newUser = new userModel({
    connectHash: "38745tgf8yegrfwu4eorhifj",
    steamid: "1234567890",
  });

  await allUsers.forEach(async (user) => {
    if (user.connectHash === newUser.connectHash) {
      console.log("deleting...");
      await userModel.findByIdAndDelete(user._id);
    }
  })

  await newUser.save();

  res.json(allUsers);
});
 * 
 */

// проверка пользователя на авторизацию
app.get("/", async (req, res) => {
  // поулчаем зашифрованный id сессии
  const sessionIDEncripted = req.query.sessionID as string;

  // const sessionExpires = req;

  // console.clear();
  // console.log("\n\n\n---------------------------------------------------\n\n\n");
  // console.log(sessionExpires);

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

app.get("/user", (req, res) => {
  createFolder("76561198198855077");
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
     * user_profile_photo
     * user_profile_bg_image <- banner img
     * user_theme_bg_image <- bg pattern of site
     */

    if (!userInDb) {
      const defaultPicsPath = `${BACKEND_IP}:${process.env.port}/users_data/default_pictures_user`;
      req.user["_json"].userbgpattern = `${defaultPicsPath}/bg-pattern.png`;
      req.user["_json"].userbanner = `${defaultPicsPath}/banner_default.webp`;
      
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
