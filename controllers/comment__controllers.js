const Comment = require("../models/comment");
const Post = require("../models/post");
const Like = require("../models/likes");
const commentsMailer = require("../mailers/comments_mailer");
const Queue = require("bull");
const { REDIS_PORT, REDIS_URI } = require("../config/redis_credential");
const { wantsJson } = require("../utils/api");

const emailQueue = new Queue("emailQueue", {
  redis: {
    port: REDIS_PORT,
    host: REDIS_URI,
  },
});

function formatComment(comment) {
  const user = comment.user || {};
  return {
    id: comment._id,
    content: comment.content,
    createdAt: comment.createdAt,
    likesCount: comment.likes ? comment.likes.length : 0,
    user: {
      id: user._id || user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    },
  };
}

module.exports.create = async function (req, res) {
  try {
    let post = await Post.findById(req.body.post);

    if (!post) {
      if (wantsJson(req)) {
        return res.status(404).json({ success: false, message: "Post not found" });
      }
      req.flash("error", "Post not found");
      return res.redirect("back");
    }

    let comment = await Comment.create({
      content: req.body.content,
      user: req.user._id,
      post: req.body.post,
    });
    post.comments.push(comment);
    await post.save();

    comment = await Comment.findById(comment._id)
      .populate("user", "username email avatar")
      .populate("likes");

    try {
      emailQueue
        .add({ comment }, { delay: 1000 })
        .then(() => {
          console.log("job added to emailQueue");
        })
        .catch((err) => {
          console.log("error in adding job to emailQueue", err);
        });
    } catch (queueErr) {
      console.log("emailQueue unavailable", queueErr);
    }

    if (wantsJson(req)) {
      return res.json({
        success: true,
        message: "Comment created",
        comment: formatComment(comment),
      });
    }

    req.flash("success", "Comment Created");
    return res.redirect("back");
  } catch (err) {
    console.log(err);
    if (wantsJson(req)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    req.flash("error", err.message);
    return res.redirect("back");
  }
};

module.exports.destroy = async function (req, res) {
  try {
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      if (wantsJson(req)) {
        return res.status(404).json({ success: false, message: "Comment not found" });
      }
      req.flash("error", "Comment not found");
      return res.redirect("back");
    }

    if (comment.user != req.user.id) {
      if (wantsJson(req)) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
      req.flash("error", "Unauthorized");
      return res.redirect("back");
    }

    let postId = comment.post;

    await comment.remove();

    await Post.findByIdAndUpdate(postId, {
      $pull: { comments: req.params.id },
    });

    await Like.deleteMany({ likeable: comment._id, onModel: "Comment" });

    if (wantsJson(req)) {
      return res.json({
        success: true,
        message: "Comment deleted",
        commentId: req.params.id,
      });
    }

    req.flash("success", "Comment deleted!");
    return res.redirect("back");
  } catch (err) {
    console.log(err);
    if (wantsJson(req)) {
      return res.status(500).json({ success: false, message: "Could not delete comment" });
    }
    req.flash("error", err.message);
    return res.redirect("back");
  }
};
