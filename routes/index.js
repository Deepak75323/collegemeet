const express = require("express");
const router = express.Router();
const passport = require("passport");
const homecontrollers = require("../controllers/home__controllers");


router.get("/",passport.checkAuthentication,homecontrollers.home);

router.get("/about/:id", homecontrollers.about);


router.post('/update/:id',homecontrollers.update);

router.get("/skills", homecontrollers.skills);
router.use("/posts", require("./post"));
// router.use("/users", require("./user"));
router.use("/comments", require("./comments"));
router.use("/likes", require("./likes"));

router.get("/qualification", homecontrollers.qualification);

router.get("/contact",passport.checkAuthentication, homecontrollers.contact);
router.get("/signin", homecontrollers.signin);
router.get("/signup", homecontrollers.signup);


router.post("/create", homecontrollers.create);

// use passport as middlewareFunctions
router.post(
  "/createsession",
  passport.authenticate("local", 
  { failureRedirect: "/signin" 
}),
homecontrollers.createSession
);

router.get('/users/auth/google',passport.authenticate('google',{scope:['profile','email']}));



router.post('/thankyou',passport.checkAuthentication,homecontrollers.form);

router.get('/room',passport.checkAuthentication,homecontrollers.room);
router.get('/enterroom',passport.checkAuthentication,homecontrollers.enterroom);


router.get('/privateroom',passport.checkAuthentication,homecontrollers.privateroom);


router.get('/work',homecontrollers.work);

router.get('/users/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signin'}),homecontrollers.createSession);

router.get('/signout', homecontrollers.destroySession);

router.get('/userprofile',homecontrollers.userprofile);





module.exports = router;



