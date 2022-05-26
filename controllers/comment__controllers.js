const Comment = require("../models/comment");
const Post = require("../models/post");
const Like= require("../models/likes");
const commentsMailer = require("../mailers/comments_mailer");
const Queue = require("bull");
const { REDIS_PORT, REDIS_URI } = require("../config/redis_credential");

const emailQueue = new Queue("emailQueue", {
  redis: {
    port: REDIS_PORT,
    host: REDIS_URI,
  },
});

module.exports.create = async function (req, res) {
  try {
    let post = await Post.findById(req.body.post);

    if (post) {
      let comment = await Comment.create({
        content: req.body.content,
        user: req.user._id,
        post: req.body.post,
      });
      post.comments.push(comment);
      post.save();


    //   comment= await comment.populate("user");
      comment = await comment.populate("user", "username email").execPopulate();
    //   console.log(comment);
    
      emailQueue
        .add({ comment }, { delay: 1000 })
        .then(() => {
          console.log("job added to emailQueue");
        })
        .catch((err) => {
          console.log("error in adding job to emailQueue", err);
        });

      req.flash("success", "Comment Created");

        return res.redirect("back");
    }
  } catch (err) {
    console.log(err);
    req.flash("error", err.message);
    return res.redirect("back");
  }
};

module.exports.destroy = async function (req, res) {
  try {
    let comment = await Comment.findById(req.params.id);

    console.log(comment.user.id);
    if (comment.user == req.user.id) {
      let postId = comment.post;

      comment.remove();

      let post = Post.findByIdAndUpdate(postId, {
        $pull: { comments: req.params.id },
      });

      // CHANGE :: destroy the associated likes for this comment
      await Like.deleteMany({ likeable: comment._id, onModel: "Comment" });



      req.flash("success", "Comment deleted!");

      return res.redirect("back");
    } else {
      req.flash("error", "Unauthorized");
      return res.redirect("back");
    }
  }
  catch (err) {
    req.flash("error", err);
    console.log(err);
    return;
  }
};

