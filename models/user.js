const mongoose = require("mongoose");


const multer=require('multer');

const path=require('path');
const AVATAR_PATH=path.join('/uploads/users/avatars');


const userSchema = new mongoose.Schema(
  {
    name:{ type: String, default: "none" },
    email: { type: String, required: true, unique: true },
    password: { type: String},
    username: { type: String },
    project:{ type: String, default: "none"},
    experience: { type: Number, default: 0 },
    expertise: { type: String, default: "none" ,required: true},
    describe:{ type: String, default:"none" },
    leetcode: { type: String, default: "none" },
    codechef: { type: String, default: "none" },
    codeforces: { type: String,default:"none" },  
    avatar:{type:String}
  },
  {
    timestamps: true,
  }
);



let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', AVATAR_PATH));
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now());
  }
});

//static method to get the path of the image
userSchema.statics.uploadedAvatar = multer({ storage: storage }).single('avatar');
userSchema.statics.avatarPath = AVATAR_PATH;



const User = mongoose.model("User", userSchema);

module.exports = User;
