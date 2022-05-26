const User = require("../models/user");
const Post = require("../models/post");
const Contact= require("../models/contact");
const fs=require("fs");
const path = require('path');

module.exports.home = function (req, res) {
  return res.render("home", {
    title: "Home",
  });
};

module.exports.update = async function (req, res){
  if (req.user.id == req.params.id) {
    try {
      let user = await User.findById(req.params.id);
      User.uploadedAvatar(req, res, function (err) {
        if (err) {
          console.log(err);
          return;
        }
        // console.log(req.file);
        user.name = req.body.name;
        user.email = req.body.email;
        if(req.body.password==req.body.confirm_password){
        user.password = req.body.password;
        }
        user.experience = req.body.experience;
        user.expertise = req.body.expertise;
        user.describe=req.body.describe;
        user.leetcode= req.body.leetcode;
        user.codeforces= req.body.codeforces;
        user.codechef= req.body.codechef;
        user.project= req.body.project;


        // console.log(req.file);
        if (req.file  ) 
        {

          if (user.avatar && fs.existsSync(path.join(__dirname, "..", user.avatar))) 
           {
            fs.unlinkSync(path.join(__dirname, "..", user.avatar));
          }
         
// this is saving the path of the uploaded file into the avatar field in the user
          user.avatar = User.avatarPath + "/" + req.file.filename;
        }
        user.save();
        req.flash("success", "Updated Successfully");
        return res.redirect("back");
      });
    } catch (error) {
      req.flash("error", error.message);
      console.log(error);
      return res.redirect("back");
    }
  } 
  else {
    req.flash("error", "Unauthorized");
    return res.status(401).send("Unauthorized");
  }
};

module.exports.about = function (req, res) {
  User.findById(req.params.id, function (err, user) {
    if (err) {
      console.log("error in finding user");
      return;
    }

    console.log(user);
    return res.render("about", {
      title: "About",
      profile_user: user,
    });
  });
};
module.exports.qualification = function (req, res) {
  return res.render("qualification");
};

module.exports.skills = function (req, res) {
  return res.render("skills");
};

module.exports.work = function (req, res) {
  Post.find({})
    .populate("user")
    .exec(function (err, posts) {
      User.find({}, function (err, users) {
        return res.render("work", {
          title: "Work",
          posts: posts,
          all_users: users,
        });
      });
    });
};
module.exports.contact = function (req, res) {
  return res.render("contact");
};

module.exports.signin = function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  return res.render("sign_in");
};

module.exports.signup = function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }

  return res.render("sign_up");
};

module.exports.create = function (req, res) {
  if (req.body.password != req.body.confirm_password) {
    req.flash('error', 'Passwords do not match');
    return res.redirect("back");
  }

  User.findOne({ username: req.body.username }, function (err, user) {
    if (err) {
      console.log("error in finding user in signing up");
      return;
    }
    if (!user) {
    
      User.create(req.body, function (err, user) {
        if (err) {
          req.flash('error', err); return
        }

        return res.redirect("/signin");
      });
    } else {
       req.flash('success', 'You have signed up, login to continue!');
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
  console.log("logged out");
  req.flash("success", "Logged out Successfully");

  return res.redirect("/signin");
};

module.exports.userprofile = function (req, res) {
  return res.render("user_profile");
};



module.exports.room=function (req, res) {
  return res.render("room");
}


module.exports.enterroom=function (req, res) {
  return res.render('enterroom.ejs');
}


module.exports.privateroom=function (req,res)
{
  return res.render("privateroom.ejs");
}

module.exports.form=function(req, res)
{

  Contact.create(req.body, function (err, user) {
    if (err) {
      req.flash('error', err); return
    }

    return res.render('thankyou.ejs',{

      name:req.body.name
    })
  });

}