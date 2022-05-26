const express = require("express");
const router = express.Router();
const passport =require('passport');


const commentscontrollers = require("../controllers/comment__controllers");

router.post('/create',passport.checkAuthentication,commentscontrollers.create);
router.get('/destroy/:id',passport.checkAuthentication,commentscontrollers.destroy);
 
module.exports = router;