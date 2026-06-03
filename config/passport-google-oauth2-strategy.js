const passport = require("passport");
const googleStrategy = require("passport-google-oauth").OAuth2Strategy;
const crypto = require("crypto");
const User = require("../models/user");
const env = require("./environment.js");
const { hashPassword } = require("../utils/password");

if (env.google_client_id && env.google_client_secret) {
  passport.use(
    new googleStrategy(
      {
        clientID: env.google_client_id,
        clientSecret: env.google_client_secret,
        callbackURL: env.google_call_back_url,
      },
      function (accessToken, refreshToken, profile, done) {
        User.findOne({ email: profile.emails[0].value }).exec(async function (
          err,
          user
        ) {
          if (err) {
            console.log("error in google strategy-passport", err);
            return done(err);
          }

          if (user) {
            return done(null, user);
          }

          try {
            const randomPassword = crypto.randomBytes(20).toString("hex");
            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              password: await hashPassword(randomPassword),
            });
            return done(null, user);
          } catch (createErr) {
            console.log(
              "error in creating user google strategy-passport",
              createErr
            );
            return done(createErr);
          }
        });
      }
    )
  );
} else {
  console.log("Google OAuth not configured — sign-in with Google is disabled");
}

module.exports = passport;
