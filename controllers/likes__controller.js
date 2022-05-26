const Like = require("../models/likes");
const Post = require("../models/post");
const Comment = require("../models/comment");

module.exports.toggleLike = async function (req, res) {
  try {
    let likeable;
    let deleted = false;

    if (req.query.type == "Post") {
      likeable = await Post.findById(req.query.id);
    } else {
      likeable = await Comment.findById(req.query.id);
    }

    // check if a like exist

    let existingLike = await Like.findOne({
      user: req.user._id,
      likeable: req.query.id,
      onModel: req.query.type,
    });

    // if a like already exists
    if (existingLike) {
      likeable.likes.pull(existingLike._id);
      likeable.save();

      existingLike.remove();
      deleted = true;
    } else {
      let newLike = await Like.create({
        user: req.user._id,
        likeable: req.query.id,
        onModel: req.query.type,
      });
      likeable.likes.push(newLike._id);
      likeable.save();
    }

    if(deleted==false)
    {
        req.flash("success", "Successfully liked!");
    }
    else
    {
        req.flash("success", "Successfully unliked!");
    }
    return res.redirect("back");
   
  }
  catch (err) {
    console.log(err);
    req.flash("error", err.message);
    return res.redirect("back");
  }
};
