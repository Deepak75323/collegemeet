const fs = require("fs");
const rfs = require("rotating-file-stream");
const path = require("path");

const logDirectory = path.join(__dirname, "../production_logs");
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);


const accessLogStream = rfs.createStream('access.log', {
  interval: "1d",
  path: logDirectory,
});

const development = {
  name: "development",
  asset_path: "/public",
  session_cookie_key: "hohoho",
  db: "blog_website",
  smtp: {
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "your email address for sending mail",
      pass: "password of yours email address",
    },
  },
  google_client_id:
    "your google client id",
  google_client_secret: "your google client secret",
  google_call_back_url: "your google call back url",

  morgan: {
    mode: "dev",
    options: { stream: accessLogStream },
  },
};

const production = {
  name: "production",
  asset_path: process.env.asset_path,
  session_cookie_key: process.env.session_cookie_key,
  db: process.env.DB,
  smtp: {
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.user,
      pass: process.env.pass,
    },
  },
  google_client_id: process.env.google_client_id,
  google_client_secret: process.env.google_client_secret,
  google_call_back_url: process.env.google_call_back_url,
  morgan: {
    mode: "combined",
    options: { stream: accessLogStream },
  },
};

module.exports =
  eval(process.env.BLOG_ENVIRONMENT) == undefined
    ? development
    : eval(process.env.BLOG_ENVIRONMENT);
