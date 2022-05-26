// const User= require('../models/user');
// const JWT= require("jsonwebtoken");

// module.exports.createSession= async function(req,res)
// { 
//     try
//     { 
//         let user= await User.findOne({usename:req.body.username});
//         if(!user || user.password!=req.body.password)
//         {
//           req.flash("error","Invalid Username/Password");
//           return res.redirect("back");

//         } 

//         return  res.render(
//             "/",
//             {
//                 user:user,
//                 token:JWT.sign(user.toJSON(),'deepak',{expiresIn:"1h"})
//             }

//         );

//     }
//     catch(err)
//     { 
//       req.flash("error",err.message);
//         console.log(err);
//         res.redirect("back");
//     }
// }