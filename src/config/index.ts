import dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });

const port = process.env.port;

const config = {
  serverPort: port,
  backendServer: "http://localhost:" + port,
  frontendServer: process.env.frontendServer,
  apiKey: process.env.apiKey,
};

export default config;
