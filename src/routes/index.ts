import { app, passport } from "../index";
import { encriptString, decriptString } from "../utils";
import config from "../config/index";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";

const MONGO_URL = process.env.mongoURL;
const BACKEND_IP = "http://localhost";

const defaultPicsPath = `${BACKEND_IP}:${process.env.port}/users_data/default_pictures_user`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const steamid = file.originalname.split("-")[0];
    const uploadPath = "users_data/" + steamid;
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname.split("-")[1]);
  },
});

const upload = multer({ storage });

app.post("/change-banner", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const decriptedSessionID = decriptString(req.query.sessionID as string);
    const steamid = req.body.steamid;
    const userBySessionID = req.sessionStore["sessions"][decriptedSessionID];

    if (!userBySessionID) return res.status(403).send("Need to authorize");

    const parsedUser = JSON.parse(userBySessionID);

    parsedUser.passport.user.cyberspace_settings.public.userbanner = `${BACKEND_IP}:${process.env.port}/users_data/${steamid}/user_profile_banner_image.webp`;
    req.sessionStore["sessions"][decriptedSessionID] =
      JSON.stringify(parsedUser);

    const userInDB = await userModel.findOne({ "user.steamid": steamid });

    if (!userInDB) return res.status(404).send("Can't found user in db!");

    userInDB.user.cyberspace_settings.public.userbanner = `${BACKEND_IP}:${process.env.port}/users_data/${steamid}/user_profile_banner_image.webp`;
    await userInDB.save();

    return res.sendStatus(200);
  } catch (e) {
    return res.status(500).send(e);
  }
});

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
app.get("/user/friends/:steamid", async (req, res) => {
  const steamid = req.params.steamid;
  const sessionID = req.query.sessionID as string;

  if (!sessionID)
    return res.status(400).json({
      message: "No sessionID",
      success: false,
    });

  try {
    const decriptedSessionID = decriptString(sessionID);

    if (!decriptedSessionID)
      return res.send(400).json({
        message: "Unable to decript session id",
        success: false,
      });

    const friendsData = await fetch(
      `http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${process.env.apiKey}&steamid=${steamid}&relationship=friend`
    );

    if (!friendsData.ok)
      return res.send(500).json({
        message: "Unable to get friends list",
      });
    const responseObj = await friendsData.json();

    if (!responseObj.friendslist) return res.sendStatus(204);

    const friendList = responseObj.friendslist.friends;

    const pairsAmnt = Math.ceil(friendList.length / 100);
    const allUsers = [];

    for (let i = 0; i < pairsAmnt; i++) {
      const steamidsFromList = friendList
        .slice(i * 100, i * 100 + 100)
        .map((el) => el.steamid);

      const data = await fetch(
        `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${
          process.env.apiKey
        }&steamids=${steamidsFromList.join(",")}`
      );

      if (!data.ok) {
        return res.sendStatus(500).json(data);
      }

      const usersArray = (await data.json()).response.players;
      const usersInDb = await userModel.find({
        steamid: { $in: steamidsFromList.map((el) => el.steamid) },
      });

      usersArray.forEach((el, idx) => {
        const foundedUser = usersInDb.find(
          (user) => user.user.steamid === el.steamid
        );

        const friendObj = {
          friend_since: friendList[idx].friend_since,
          relationship: friendList[idx].relationship,
          steamid: el.steamid,
          registered: !!foundedUser,
          avatarfull: !!foundedUser
            ? foundedUser.user.avatarfull
            : el.avatarfull,
          avatarmedium: !!foundedUser
            ? foundedUser.user.avatarmedium
            : el.avatarmedium,
          personaname: el.personaname,
        };

        allUsers.push(friendObj);
      });
    }

    return res.json(allUsers);
  } catch (e) {
    console.error(e);
    return res.sendStatus(500).json({
      message: e,
      success: false,
    });
  }
});
// возвращаем всех пользователей у которых есть совпадение по имени\steamid
app.get("/user/:steamid/:username", async (req, res) => {
  const username = req.params.username;
  const steamid = req.params.steamid;
  const sessionID = req.query.sessionID as string;

  if (!sessionID) return res.status(404).send("Session id not found");

  try {
    const sessionIDDecoded = decriptString(sessionID);
    const allUsers = await userModel.find();

    const allMatches = allUsers.filter((el) => {
      if (
        el.user.personaname
          .toLowerCase()
          .trim()
          .includes(username.toLowerCase())
      ) {
        if (el.user.steamid === steamid) return false;
        return true;
      }
    });

    if (!allMatches.length) return res.json([]);

    const tempArr = [];
    allMatches.forEach((el) => {
      const tempObj = {
        steamid: el.user.steamid,
        avatarmedium: el.user.avatarmedium,
        personaname: el.user.personaname,
      };

      tempArr.push(tempObj);
    });

    return res.json(tempArr);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e);
  }
});

// меняем имя пользователя
app.post("/username/:newName", async (req, res) => {
  const sessionID = req.query.sessionID as string;
  if (!sessionID) return res.status(404).send("Session id not found");
  const newName = req.params.newName;

  try {
    const decriptedSessionID = decriptString(sessionID);
    const userBySessionID = req.sessionStore["sessions"][decriptedSessionID];

    if (!userBySessionID) return res.status(403).send("Need to authorize");

    const parsedUser = JSON.parse(userBySessionID);

    parsedUser.passport.user.personaname = newName;
    req.sessionStore["sessions"][decriptedSessionID] =
      JSON.stringify(parsedUser);
    const userInDB = await userModel.findOne({
      "user.steamid": parsedUser.passport.user.steamid,
    });

    if (!userInDB) return res.status(404).send("User wasn't found in db");

    userInDB.user.personaname = newName;
    await userInDB.save();

    return res.sendStatus(200);
  } catch (e) {
    return res.status(500).send(e);
  }
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

//! BG PATTERNS
app.get("/bg-patterns", async (req, res) => {
  const directoryPath = "users_data/bg_patterns";

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).send("Unable to scan directory: " + err);
    }

    const tempArr = [];
    files.forEach((el) => {
      const fullPath = `${BACKEND_IP}:${process.env.port}/users_data/bg_patterns/${el}`;
      tempArr.push(fullPath);
    });

    return res.json(tempArr);
  });
});

app.post("/bg-patterns", async (req, res) => {
  const sessionID = req.query.sessionID as string;

  if (!sessionID) return res.status(400).send("No session id");

  try {
    const decriptedSessionID = decriptString(sessionID);
    const userBySessionID = req.sessionStore["sessions"][decriptedSessionID];

    if (!userBySessionID) return res.status(403).send("Need to authorize");

    const url = req.query.url as string;

    if (!url) return res.status(404).send("No url");

    const parsedUser = JSON.parse(userBySessionID);
    const steamid = parsedUser.passport.user.steamid;

    parsedUser.passport.user.cyberspace_settings.public.userbgpattern = url;
    req.sessionStore["sessions"][decriptedSessionID] =
      JSON.stringify(parsedUser);

    const userInDB = await userModel.findOne({ "user.steamid": steamid });

    if (!userInDB) return res.status(404).send("Can't found user in db!");

    userInDB.user.cyberspace_settings.public.userbgpattern = url;
    await userInDB.save();

    return res.sendStatus(200);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e);
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

    const whoLikedIndex = post.likes.findIndex(
      (el) => el.steamid === whoLiked.steamid
    );

    if (whoLikedIndex === -1) {
      post.likes.push(whoLiked);
    } else post.likes.splice(whoLikedIndex, 1);

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

app.delete("/posts/:postid", async (req, res) => {
  const postid = req.params.postid;
  const sessionIDEncripted = req.query.sessionID as string;

  if (!sessionIDEncripted) {
    return res.status(404).json({
      message: "Missing session id",
      success: false,
    });
  }

  try {
    const decriptedSessionId = decriptString(sessionIDEncripted);

    const postToDelete = await postsModel.findOne({ postid });

    if (!postToDelete) {
      return res.status(404).json({
        message: `Can't delete post with id ${postid}, not found`,
        success: false,
      });
    }

    await postToDelete.deleteOne();

    return res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: e,
      success: false,
    });
  }
});
