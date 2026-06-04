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
        const email =
          profile.emails &&
          profile.emails[0] &&
          profile.emails[0].value;
        if (!email) {
          console.error("[google-oauth] Google profile missing email");
          return done(null, false);
        }

        User.findOne({ email: email }).exec(async function (err, user) {
          if (err) {
            console.error("[google-oauth] db lookup error:", err);
            return done(err);
          }

          if (user) {
            return done(null, user);
          }

          try {
            const randomPassword = crypto.randomBytes(20).toString("hex");
            const localPart = email.split("@")[0] || "user";
            user = await User.create({
              name: profile.displayName || localPart,
              email: email,
              username: localPart,
              password: await hashPassword(randomPassword),
            });
            console.log("[google-oauth] created user:", email);
            return done(null, user);
          } catch (createErr) {
            console.error("[google-oauth] create user error:", createErr);
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
