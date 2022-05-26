const mongoose = require('mongoose');

const contactschema=new mongoose.Schema({
    contact_email:
    { 

        type:String
    },
    contact_name:
    { 
        type:String
    },
    contact_subject:
    {
        type:String
    },
    contact_message:
   {
        type:String
    }
},
{ 
    timestamps:true
});


const Contact=mongoose.model('Contact',contactschema);
module.exports=Contact;

