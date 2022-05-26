const express=require('express');

const router=express.Router();

const likescontrollers=require('../controllers/likes__controller');


router.get('/toggle',likescontrollers.toggleLike);




module.exports=router;