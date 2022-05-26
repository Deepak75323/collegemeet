const passport=require('passport');


const LocalStrategy=require('passport-local').Strategy;
const User=require('../models/user');


passport.use(new LocalStrategy(
{ 
    usernameField:'username',
    passReqToCallback:true
},
function(req,username,password,done){
    // left waala schema ka usename 
    // right waala jo search karna hai
    User.findOne({username:username},function(err,user){
        if(err){
            req.flash('error',err);
            return done(err);
        }
        console.log(user);
        if(!user || user.password!=password)
        { 
            req.flash('error','Invalid Username/Password');
            return done(null,false);
            
        }

        return done(null,user);

    });

}

));



// serializing the user to decide which key is to be kept in the cookies



passport.serializeUser(function(user,done)
{ 
    done(null,user.id);
})









// deserializing the user from the key in the cookies


passport.deserializeUser(function(id,done)
{ 
        User.findById(id,function(err,user)
        { 
        if(err)
        { 
            console.log('error in finding user->passport');
            return done(err);
        }

        return done(null,user);

        });
});



// check if the user is authenticatd


passport.checkAuthentication=function(req,res,next)
{ 
    // if signin ,then passon the request to next func
    if(req.isAuthenticated())
    {
        return next();
    }

    return res.redirect('/signin');
}


passport.setAuthenticatedUser=function(req,res,next)
{ 
    if(req.isAuthenticated())
    { 
        // req.user conatains the current signed in user from the session cookie and we are sending it to locals
        res.locals.user=req.user;
    }
    next();
}

module.exports=passport;