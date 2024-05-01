import crypto from "crypto";

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

// шифруем
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

// расшифровуем
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


export {decriptString, encriptString};