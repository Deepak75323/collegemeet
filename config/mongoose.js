const mongoose = require("mongoose");
const env = require("./environment");

const uri =
  process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${env.db}`;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });


const db=mongoose.connection;

db.on('error',console.error.bind(console,"Error connecting to MongoDB"));


db.once('open',function(){
    console.log("Connected to Database::MongoDB");
});



module.exports=db;