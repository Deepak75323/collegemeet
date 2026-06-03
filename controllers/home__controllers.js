const User = require("../models/user");
const Post = require("../models/post");
const Contact = require("../models/contact");
const fs = require("fs");
const path = require("path");
const { hashPassword } = require("../utils/password");
const { getClientTurnConfig } = require("../utils/webrtc-config");

module.exports.home = function (req, res) {
  return res.render("home", {
    title: "Home",
  });
};

module.exports.update = async function (req, res) {
  if (req.user.id != req.params.id) {
    req.flash("error", "Unauthorized");
    return res.status(401).send("Unauthorized");
  }

  try {
    let user = await User.findById(req.params.id);
    User.uploadedAvatar(req, res, async function (err) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }

      user.name = req.body.name;
      user.email = req.body.email;

      if (
        req.body.password &&
        req.body.confirm_password &&
        req.body.password === req.body.confirm_password
      ) {
        user.password = await hashPassword(req.body.password);
      }

      user.experience = req.body.experience;
      user.expertise = req.body.expertise;
      user.describe = req.body.describe;
      user.leetcode = req.body.leetcode;
      user.codeforces = req.body.codeforces;
      user.codechef = req.body.codechef;
      user.project = req.body.project;

      if (req.file) {
        if (
          user.avatar &&
          fs.existsSync(path.join(__dirname, "..", user.avatar))
        ) {
          fs.unlinkSync(path.join(__dirname, "..", user.avatar));
        }
        user.avatar = User.avatarPath + "/" + req.file.filename;
      }

      await user.save();
      req.flash("success", "Updated Successfully");
      return res.redirect("back");
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("back");
  }
};

module.exports.about = function (req, res) {
  User.findById(req.params.id, function (err, user) {
    if (err) {
      req.flash("error", "Could not load profile");
      return res.redirect("/");
    }
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }
    return res.render("about", {
      title: "About",
      profile_user: user,
    });
  });
};

module.exports.qualification = function (req, res) {
  return res.render("qualification", { title: "Qualification" });
};

module.exports.skills = function (req, res) {
  return res.render("skills", { title: "Skills" });
};

module.exports.work = function (req, res) {
  Post.find({})
    .populate("user")
    .populate("likes")
    .populate("comments")
    .exec(function (err, posts) {
      User.find({}, function (err, users) {
        return res.render("work", {
          title: "Notices",
          posts: posts,
          all_users: users,
          layout: "layout-notice",
        });
      });
    });
};

module.exports.contact = function (req, res) {
  return res.render("contact", { title: "Contact", layout: "layout-contact" });
};

module.exports.signin = function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  return res.render("sign_in", { title: "Sign In", layout: "layout-auth" });
};

module.exports.signup = function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  return res.render("sign_in", { title: "Sign Up", layout: "layout-auth" });
};

module.exports.create = async function (req, res) {
  if (req.body.password != req.body.confirm_password) {
    req.flash("error", "Passwords do not match");
    return res.redirect("back");
  }

  User.findOne({ username: req.body.username }, async function (err, user) {
    if (err) {
      req.flash("error", "Something went wrong");
      return res.redirect("back");
    }
    if (user) {
      req.flash("error", "Username already taken");
      return res.redirect("/signin");
    }

    try {
      const hashed = await hashPassword(req.body.password);
      await User.create({
        email: req.body.email,
        username: req.body.username,
        password: hashed,
      });
      req.flash("success", "Account created — please sign in");
      return res.redirect("/signin");
    } catch (createErr) {
      req.flash("error", createErr.message);
      return res.redirect("back");
    }
  });
};

module.exports.createSession = function (req, res) {
  req.flash("success", "Logged in Successfully");
  return res.redirect("/");
};

module.exports.destroySession = function (req, res) {
  req.logout();
  req.session.regenerate(function (err) {
    if (err) {
      req.flash("error", "Could not log out");
      return res.redirect("/");
    }
    req.flash("success", "Logged out Successfully");
    return res.redirect("/signin");
  });
};

module.exports.userprofile = function (req, res) {
  return res.render("user_profile", { title: "Profile" });
};

module.exports.room = function (req, res) {
  return res.render("room", {
    title: "Peer Coding",
    layout: "layout-room",
    displayName:
      req.user.username ||
      (req.user.name && req.user.name !== "none" ? req.user.name : null) ||
      req.user.email,
    turnIce: getClientTurnConfig(),
  });
};

module.exports.enterroom = function (req, res) {
  return res.render("enterroom", {
    title: "Chat Room",
    layout: "layout-room",
  });
};

module.exports.privateroom = function (req, res) {
  return res.render("privateroom", {
    title: "Join Chat",
    layout: "layout-room",
  });
};

module.exports.form = function (req, res) {
  Contact.create(req.body, function (err) {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/contact");
    }

    return res.render("thankyou", {
      title: "Thank You",
      name: req.body.contact_name,
      layout: "layout-contact",
    });
  });
};
