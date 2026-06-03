const Post = require("../models/post");
const Like = require("../models/likes");
const Comment = require("../models/comment");
const { wantsJson } = require("../utils/api");

function formatPost(post) {
  const user = post.user || {};
  return {
    id: post._id,
    title: post.title,
    category: post.category,
    description: post.description,
    blog_image: post.blog_image,
    likesCount: post.likes ? post.likes.length : 0,
    createdAt: post.createdAt,
    user: {
      id: user._id || user.id || post.user,
      username: user.username,
      email: user.email,
    },
  };
}

module.exports.create = async function (req, res) {
  if (!req.isAuthenticated()) {
    if (wantsJson(req)) {
      return res.status(401).json({ success: false, message: "Login first" });
    }
    req.flash("error", "Login First");
    return res.redirect("back");
  }

  try {
    let post = await Post.create({
      user: req.user.id,
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
    });

    Post.uploadedblog_image(req, res, async function (err) {
      if (err) {
        console.log("error in uploading image", err);
        if (wantsJson(req)) {
          return res
            .status(400)
            .json({ success: false, message: err.message || "Upload failed" });
        }
        req.flash("error", err.message);
        return res.redirect("back");
      }

      post.title = req.body.title;
      post.category = req.body.category;
      post.description = req.body.description;

      if (req.file) {
        post.blog_image = Post.blog_imagePath + "/" + req.file.filename;
      }

      await post.save();
      post = await Post.findById(post._id).populate("user").populate("likes");

      if (wantsJson(req)) {
        return res.json({
          success: true,
          message: "Post created",
          post: formatPost(post),
        });
      }

      req.flash("success", "Post Created");
      return res.redirect("back");
    });
  } catch (err) {
    console.log(err);
    if (wantsJson(req)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    req.flash("error", err.message);
    return res.redirect("back");
  }
};

module.exports.blog = async function (req, res) {
  try {
    let posts = await Post.find({})
      .populate("user")
      .populate({
        path: "comments",
        populate: {
          path: "user",
        },
        populate: {
          path: "likes",
        },
      })
      .populate("likes");

    let post = await Post.findById(req.params.id)
      .populate("user")
      .populate({
        path: "comments",
        populate: {
          path: "user",
        },
        populate: {
          path: "likes",
        },
      })
      .populate("likes");

    return res.render("blog", {
      title: "Blog",
      posts: posts,
      post: post,
      layout: "layout-notice",
    });
  } catch (err) {
    console.log("error in posting post", err);
    return res.redirect("/work");
  }
};

module.exports.destroy = async function (req, res) {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      if (wantsJson(req)) {
        return res.status(404).json({ success: false, message: "Post not found" });
      }
      req.flash("error", "Post not found");
      return res.redirect("back");
    }

    if (post.user != req.user.id) {
      if (wantsJson(req)) {
        return res
          .status(403)
          .json({ success: false, message: "You are not authorized to delete this post" });
      }
      req.flash("error", "You are not authorized to delete this post");
      return res.redirect("back");
    }

    await Like.deleteMany({ likeable: post, onModel: "Post" });
    await Like.deleteMany({ _id: { $in: post.comments } });
    await post.remove();
    await Comment.deleteMany({ post: req.params.id });

    if (wantsJson(req)) {
      return res.json({
        success: true,
        message: "Post deleted",
        postId: req.params.id,
      });
    }

    req.flash("success", "Post Deleted");
    return res.redirect("back");
  } catch (err) {
    console.log(err);
    if (wantsJson(req)) {
      return res.status(500).json({ success: false, message: "Could not delete post" });
    }
    req.flash("error", err.message);
    return res.redirect("back");
  }
};
