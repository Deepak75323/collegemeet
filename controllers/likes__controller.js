const Like = require("../models/likes");
const Post = require("../models/post");
const Comment = require("../models/comment");
const { wantsJson } = require("../utils/api");

module.exports.toggleLike = async function (req, res) {
  try {
    let likeable;
    let deleted = false;

    if (req.query.type == "Post") {
      likeable = await Post.findById(req.query.id);
    } else {
      likeable = await Comment.findById(req.query.id);
    }

    if (!likeable) {
      if (wantsJson(req)) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      req.flash("error", "Not found");
      return res.redirect("back");
    }

    let existingLike = await Like.findOne({
      user: req.user._id,
      likeable: req.query.id,
      onModel: req.query.type,
    });

    if (existingLike) {
      likeable.likes.pull(existingLike._id);
      await likeable.save();
      await existingLike.remove();
      deleted = true;
    } else {
      let newLike = await Like.create({
        user: req.user._id,
        likeable: req.query.id,
        onModel: req.query.type,
      });
      likeable.likes.push(newLike._id);
      await likeable.save();
    }

    const message = deleted ? "Successfully unliked!" : "Successfully liked!";

    const refreshed = await likeable.constructor.findById(likeable._id).select("likes");

    if (wantsJson(req)) {
      return res.json({
        success: true,
        message,
        likesCount: refreshed ? refreshed.likes.length : likeable.likes.length,
        liked: !deleted,
      });
    }

    req.flash("success", message);
    return res.redirect("back");
  } catch (err) {
    console.log(err);
    if (wantsJson(req)) {
      return res.status(500).json({ success: false, message: err.message });
    }
    req.flash("error", err.message);
    return res.redirect("back");
  }
};
