import { app, passport } from "../index";
import { encriptString, decriptString } from "../utils";
import config from "../config/index";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import fs from "fs";

const MONGO_URL = process.env.mongoURL;
const BACKEND_IP = "http://localhost";

const defaultPicsPath = `${BACKEND_IP}:${process.env.port}/users_data/default_pictures_user`;

const cyberspace_settings = {
  public: {
    userbgpattern: `${defaultPicsPath}/bg-pattern.png`,
    userbanner: `${defaultPicsPath}/banner_default.webp`,
    userbgcolor:
      "linear-gradient( 180deg, rgba(24, 27, 52, 1) 0%, rgba(24, 27, 52, 1) 20%, rgba(49, 32, 64, 1) 100% )",
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
        userbgcolor: String,
      },
      private: {},
    },
  },
  sessionID: String,
});
const userModel = mongoose.model("users", userSchema);

const postsSchema = new mongoose.Schema({
  steamid: String,
  personaname: String,
  postcreated: String,
  postbody: String,
  postid: String,
  postimages: [String],
  likes: [
    {
      steamid: String,
      personaname: String,
      likedat: String,
    },
  ],
  comments: [
    {
      steamid: String,
      personaname: String,
      content: String,
      commentdate: String,
    },
  ],
});
const postsModel = mongoose.model("posts", postsSchema);

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

//! STEAM AUTH
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
     * user_profile_photo_medium - сжатый вариант
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
// тут авторизация в стим
app.get(
  "/api/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  function (req, res) {
    // res.redirect(config.frontendServer);
  }
);
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

//! AVATAR
// смена аватара
app.post("/change-avatar/:steamid", async (req, res) => {
  const steamid = req.params.steamid;
  const sessionIDEncripted = req.query.sessionID as string;

  if (!sessionIDEncripted) {
    return res.sendStatus(404).json({
      message: "Missing session id",
      success: false,
    });
  }

  try {
    if (!req.body.image) {
      return res.status(400).json({
        success: false,
        message: "Missing image",
      });
    }
    // удаляем те части в закодированном изображении, которые не могут обрабатываться base64
    // req.body.image = req.body.image.replace(/^data:image\/\w+;base64,/, "");
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

    // пробуем расшифровать сессию и перезаписать локальные данные пользователя
    try {
      const sessionID = decriptString(sessionIDEncripted);
      const userBySessionID = req.sessionStore["sessions"][sessionID];

      if (!userBySessionID) {
        return res.sendStatus(404);
      }

      const sessionData = JSON.parse(userBySessionID);

      // перезаписываем в локальной сессии пути
      sessionData["passport"]["user"].avatar =
        `${BACKEND_IP}:${process.env.port}/` + outputPath;
      sessionData["passport"]["user"].avatarfull =
        `${BACKEND_IP}:${process.env.port}/` + outputPath;
      sessionData["passport"]["user"].avatarmedium =
        `${BACKEND_IP}:${process.env.port}/` + compressedImagePath;

      req.sessionStore["sessions"][sessionID] = JSON.stringify(sessionData);
    } catch (e) {
      return res.status(404).json({
        message: "User session ended",
        success: false,
      });
    }

    if (userInDb) {
      userInDb.user.avatar =
        `${BACKEND_IP}:${process.env.port}/` + compressedImagePath;
      userInDb.user.avatarfull =
        `${BACKEND_IP}:${process.env.port}/` + outputPath;
      userInDb.user.avatarmedium =
        `${BACKEND_IP}:${process.env.port}/` + compressedImagePath;

      await userInDb.save();
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e });
  }
});
// возвращение аватара который в стим
app.post("/restore-avatar/:steamid", async (req, res) => {
  const steamid = req.params.steamid;
  const userInDb = await userModel.findOne({ "user.steamid": steamid });
  // поулчаем зашифрованный id сессии
  const sessionIDEncripted = req.query.sessionID as string;

  // если сессии не было
  if (!sessionIDEncripted) {
    return res.sendStatus(404).json({
      message: "Missing session ID in query",
      success: false,
    });
  }

  if (!userInDb) {
    return res.status(404).json({
      success: false,
      message: "Error to found user in db!",
    });
  }
  // sending request to steam...
  const data = await fetch(
    `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.apiKey}&steamids=${steamid}`
  );
  if (!data.ok) {
    return res.send(null).json({
      success: false,
      message: "Error to fetch steam user!",
    });
  }

  // изменяем данные в базе данных и сохраняем и работаем с локальной сессией
  try {
    const steamUser = (await data.json()).response.players[0];

    // пробуем расшифровать сессию и перезаписать локальные данные пользователя
    try {
      const sessionID = decriptString(sessionIDEncripted);
      const userBySessionID = req.sessionStore["sessions"][sessionID];

      if (!userBySessionID) {
        return res.sendStatus(404);
      }

      const sessionData = JSON.parse(userBySessionID);

      sessionData["passport"]["user"].avatar = steamUser.avatar;
      sessionData["passport"]["user"].avatarfull = steamUser.avatarfull;
      sessionData["passport"]["user"].avatarmedium = steamUser.avatarmedium;

      req.sessionStore["sessions"][sessionID] = JSON.stringify(sessionData);
    } catch (e) {
      return res.status(404).json({
        message: "User session ended",
        success: false,
      });
      // res.sendStatus(500);
    }

    userInDb.user.avatar = steamUser.avatar;
    userInDb.user.avatarfull = steamUser.avatarfull;
    userInDb.user.avatarmedium = steamUser.avatarmedium;

    await userInDb.save();
    return res.status(200).json({
      success: true,
    });
  } catch (e) {
    console.error(e);
    return res.send(null);
  }
});

//! POSTS
app.get("/posts/:steamid", async (req, res) => {
  const steamid = req.params.steamid;
  if (!steamid)
    return res.sendStatus(400).json({
      message: "Request body has no steamid",
      success: false,
    });

  try {
    // getting all posts with specified steamid
    const allPosts = await postsModel.find({ steamid });
    const modifiedPosts = [];

    // modify posts info, erasing likes and comments data, replacing it with its amount
    allPosts.forEach((el, idx) => {
      const tempObj = {
        steamid: el.steamid,
        personaname: el.personaname,
        postcreated: el.postcreated,
        postbody: el.postbody,
        postid: el.postid,
        likes: el.likes,
        postimages: el.postimages,
        comments: el.comments.length,
      };
      modifiedPosts.push(tempObj);
    });

    return res.json(modifiedPosts);
  } catch (e) {
    console.error(e);
    res.sendStatus(500).json({
      message: "Error with db",
      success: false,
    });
  }
});

app.post("/posts/:steamid", async (req, res) => {
  const { steamid } = req.params;

  if (!steamid)
    return res.sendStatus(400).json({
      message: "Request body has no steamid",
      success: false,
    });

  try {
    const userInDb = await userModel.findOne({ "user.steamid": steamid });

    if (!userInDb) {
      return res.sendStatus(404).json({
        message: "Can't find user in db",
        success: false,
      });
    }
    const { postContent, postImages } = req.body;
    const randomPostId = uuidv4();

    const postObject = new postsModel({
      steamid,
      personaname: userInDb.user.personaname,
      postcreated: Date.now(),
      postbody: postContent,
      postimages: postImages ? postImages : [],
      likes: [],
      comments: [],
      postid: randomPostId,
    });

    await postObject.save();

    return res.sendStatus(200);
  } catch (e) {
    console.error(e);
    return res.sendStatus(500).json({
      message: e,
      success: false,
    });
  }
});

app.post("/posts/like/:postid", async (req, res) => {
  const postid = req.params.postid;
  const sessionIDEncripted = req.query.sessionID as string;

  if (!sessionIDEncripted) {
    return res.sendStatus(404).json({
      message: "Missing session id",
      success: false,
    });
  }

  if (!postid) {
    return res.sendStatus(400).json({
      message: "incorrect postid",
      success: false,
    });
  }

  try {
    const sessionIDDecoded = decriptString(sessionIDEncripted);
    //! сделать проверку в локальном хранилище

    if (!sessionIDDecoded) {
      return res.sendStatus(400).json({
        message: "Error to decrypt sessionID",
        success: false,
      });
    }

    const post = await postsModel.findOne({ postid });
    if (!post) {
      return res.sendStatus(404).json({
        message: "Post with id: " + postid + " not found",
        success: false,
      });
    }

    const whoLiked = req.body;

    const whoLikedIndex = post.likes.findIndex((el) => el.steamid === whoLiked.steamid);

    if (whoLikedIndex === -1) {
      post.likes.push(whoLiked);
    }
    else post.likes.splice(whoLikedIndex, 1);


    await post.save();

    return res.json(post.likes);
  } catch (e) {
    console.error(e);
    return res.sendStatus(500).json({
      message: e,
      success: false,
    });
  }
});
