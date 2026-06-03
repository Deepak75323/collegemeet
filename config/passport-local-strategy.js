const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/user");
const { comparePassword, upgradeLegacyPassword } = require("../utils/password");

passport.use(
  new LocalStrategy(
    {
      usernameField: "username",
      passReqToCallback: true,
    },
    function (req, username, password, done) {
      User.findOne({ username: username }, async function (err, user) {
        if (err) {
          req.flash("error", err);
          return done(err);
        }

        const match = user && (await comparePassword(password, user.password));
        if (!match) {
          req.flash("error", "Invalid Username/Password");
          return done(null, false);
        }

        await upgradeLegacyPassword(user, password);
        return done(null, user);
      });
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    if (err) {
      console.log("error in finding user->passport");
      return done(err);
    }
    return done(null, user);
  });
});

passport.checkAuthentication = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json"))
  ) {
    return res.status(401).json({ success: false, message: "Please sign in" });
  }
  return res.redirect("/signin");
};

passport.setAuthenticatedUser = function (req, res, next) {
  if (req.isAuthenticated()) {
    res.locals.user = req.user;
  }
  next();
};

module.exports = passport;
