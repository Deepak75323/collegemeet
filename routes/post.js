const express = require("express");
const router = express.Router();
const passport =require('passport');


const postcontrollers = require("../controllers/post__controllers");

router.post('/create',passport.checkAuthentication,postcontrollers.create);
router.get('/:id',passport.checkAuthentication,postcontrollers.blog);
router.get('/destroy/:id',passport.checkAuthentication,postcontrollers.destroy);

module.exports = router;