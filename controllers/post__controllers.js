const Post = require("../models/post");
const Like= require("../models/likes");
const path = require("path");
const Comment = require("../models/comment");
const fs = require("fs");

module.exports.create = async function (req, res) {

  if (req.isAuthenticated()) {

    try {
      let post = await Post.create({
        user: req.user.id,
        title: req.body.title,
        category: req.body.category,
        description: req.body.description,
        
      });

      
      Post.uploadedblog_image(req, res, function (err) {
        if (err) {
          console.log("error in uploading image");
          return;
        }

        post.user=req.user.id;
        post.title=req.body.title;
        post.category=req.body.category;
        post.description=req.body.description;

        console.log(req.file);
        // console.log(post.imagePath);
        if (req.file) {
          post.blog_image = Post.blog_imagePath + "/" + req.file.filename;
        }
        
        req.flash("success", "Post Created");
        post.save();
        // console.log(post);

        return res.redirect("back");
      });
    } catch(err) {
      req.flash("error",err.message);
      console.log(err);
      return;
    }
  } else {
    req.flash("error", "Login First");
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
          path:'likes'
        } 
      }).populate('likes');


    let post = await Post.findById(req.params.id)
      .populate("user")
      .populate({
        path: "comments",
        populate: {
          path: "user",
        },
        populate: {
          path:'likes'
        } 
      }).populate('likes');

    return res.render("blog", {
      title: "Blog",
      posts: posts,
      post: post,
    });
  } catch (err) {
    console.log("error in posting post");
    return;
  }
};

module.exports.destroy = async function (req, res) {

  
    
    
    try{
      let post = await Post.findById(req.params.id);

      if (post.user == req.user.id){

        
          await Like.deleteMany({likeable: post, onModel: 'Post'});
          await Like.deleteMany({_id: {$in: post.comments}});

          post.remove();

          await Comment.deleteMany({post: req.params.id});
          
        

   
        req.flash("success", "Post Deleted");
        return res.redirect("back");
      }
      else {
      req.flash("error", "You are not authorized to delete this post");
      return res.redirect("back");
    }
  }catch(err){
    req.flash("error",err);
    console.log(err);
    return res.redirect("back");
  }
  
  
};
