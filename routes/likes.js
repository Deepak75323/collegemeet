const express = require("express");
const router = express.Router();
const passport = require("../config/passport-local-strategy");
const likescontrollers = require("../controllers/likes__controller");

router.get("/toggle", passport.checkAuthentication, likescontrollers.toggleLike);

module.exports = router;
