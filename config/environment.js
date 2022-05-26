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
      user: "vevekdivcoder1@gmail.com",
      pass: "vivekdivcodernumber1",
    },
  },
  google_client_id:
    "187158773165-hdran4fu4ohspnoivuijn5u3n14pav72.apps.googleusercontent.com",
  google_client_secret: "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",
  google_call_back_url: "http://localhost:8000/users/auth/google/callback",

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
