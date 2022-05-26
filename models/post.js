const mongoose=require('mongoose');
const multer=require('multer');

const path=require('path');
const BLOGIMAGE_PATH=path.join('/uploads/blogs/blog_image');

const postSchema = new mongoose.Schema({
    user:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },

    // include the array of comment in the post schema itself
    comments:[
        {

            type:mongoose.Schema.Types.ObjectId,
            ref:'Comment'
        }],
    title:
    { 
        type: String,
    
    },
    category: {
        type: String,
        
    },
    description:
    {
        type: String,
        

    },
    blog_image:
    { 
        type: String,
    },
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Like'
        }
    ]
},
{ 
    timestamps: true
});



let storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '..', BLOGIMAGE_PATH));
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now());
    }
  });



  postSchema.statics.uploadedblog_image = multer({ storage: storage }).single('blog_image');
  postSchema.statics.blog_imagePath = BLOGIMAGE_PATH;





const Post=mongoose.model('Post',postSchema);
module.exports=Post;