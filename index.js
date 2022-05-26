const express = require('express');
const env= require('./config/environment.js');
const logger=require('morgan');

const cookieParser=require('cookie-parser');

const app = express();

const path = require('path');

const formatMessage = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./utils/users');



const port= process.env.PORT ||8000;
const db=require('./config/mongoose');
require("./processor/index");
const session=require('express-session');
const passport=require('passport');
const passportLocal=require('./config/passport-local-strategy');
const passportGoogle=require('./config/passport-google-oauth2-strategy');
const flash=require('connect-flash');
const customMware = require('./config/middleware');
const favicon = require('serve-favicon');
app.use( favicon( path.join( __dirname, 'favicon.ico' ) ) );




const MongoStore=require('connect-mongo')(session);
const expressLayouts=require('express-ejs-layouts');
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }))
app.use(expressLayouts);


app.use(express.static(__dirname+env.asset_path));
app.use('/uploads',express.static(__dirname+'/uploads'));
app.use(logger(env.morgan.mode,env.morgan.options));

app.set('layout extractStyles',true);
app.set('layout extractScripts',true);

app.set("view engine", "ejs");
app.set('views','./views');



// mongo store is used to store the session in the db
const sessionMiddleware=session({
    name:'blog',
    secret: env.session_cookie_key,
    saveUninitialized:false,
    resave:false,
    cookie:{
        maxAge:(1000*60*100)
    },
    store: new MongoStore({
        mongooseConnection:db,
        autoRemove: 'disabled'
      },
    function(err)
    { 
        console.log(err || "connect-mongo setup ok");
    }
    )

});

app.use(sessionMiddleware);


const server = require( 'http' ).Server( app );




const io = require( 'socket.io' )( server );


const botName = 'Chat Room';


// Run when client connects
io.on('connection', socket => {
  console.log("connected");
  socket.on('joinRoom', ({ username, room }) => {
    
    const user = userJoin(socket.id, username, room);


    socket.join(user.room);

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to ChatRoom!'));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});


const stream = require( './ws/stream.js' );


io.of( '/stream' ).on( 'connection', stream );



app.use(passport.initialize());
app.use(passport.session());

app.use(passport.setAuthenticatedUser);
app.use(flash());
app.use(customMware.setFlash);

app.use('/',require('./routes'));


server.listen(port,function(err){
    if(err){
        console.log(`error is:$(err)`);
    }
    else{
    console.log(`Server is running on port ${port}`);
    }
});