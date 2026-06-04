const express = require('express');
require('dotenv').config();
const env= require('./config/environment.js');
const logger=require('morgan');
const helmet = require('helmet');

const cookieParser=require('cookie-parser');

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(helmet({ contentSecurityPolicy: false }));

const path = require('path');

const formatMessage = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./utils/users');



const port= process.env.PORT || 8000;
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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(expressLayouts);

app.locals.assetVersion = process.env.ASSET_VERSION || String(Date.now());

if (env.name === 'development') {
  app.use('/js', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
}

app.use(express.static(__dirname+env.asset_path));
app.use('/uploads',express.static(__dirname+'/uploads'));
app.use(logger(env.morgan.mode,env.morgan.options));

app.set('layout extractStyles',true);
app.set('layout extractScripts',true);

app.set("view engine", "ejs");
app.set('views','./views');



// mongo store is used to store the session in the db
const mongoStoreOpts = {
  mongooseConnection: db,
  autoRemove: 'disabled',
};

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('[startup] FATAL: SESSION_SECRET is missing — no login will work on Render');
}
if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
  console.error('[startup] FATAL: MONGODB_URI is missing — database and sessions will fail');
}

const sessionMiddleware=session({
    name:'blog',
    secret: env.session_cookie_key,
    saveUninitialized:false,
    resave:false,
    cookie:{
        maxAge:(1000*60*60*24),
        httpOnly:true,
        secure: process.env.NODE_ENV === 'production',
        sameSite:'lax'
    },
    store: new MongoStore(
      mongoStoreOpts,
      function(err) {
        console.log(err || 'connect-mongo setup ok');
      }
    )

});

app.use(sessionMiddleware);


const server = require( 'http' ).Server( app );




const io = require( 'socket.io' )( server, {
    pingTimeout: 60000,
    pingInterval: 25000,
} );

const wrapMiddleware = ( middleware ) => ( socket, next ) => {
    middleware( socket.request, {}, next );
};


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
    if (!user) return;

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
const wsDebug = require( './utils/ws-debug.js' );

const streamNsp = io.of( '/stream' );
streamNsp.use( wrapMiddleware( sessionMiddleware ) );
streamNsp.on( 'connection', ( socket ) => {
    wsDebug.trace( 'namespace:/stream connection', { socketId: socket.id } );
    stream( socket );
} );

if ( wsDebug.isFileEnabled() ) {
    console.log( `[stream] File logging → ${ wsDebug.logFilePath }` );
}



app.use(passport.initialize());
app.use(passport.session());

app.use(passport.setAuthenticatedUser);
app.use(flash());
app.use(customMware.setFlash);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/',require('./routes'));


server.listen(port,function(err){
    if(err){
        console.log(`error is:$(err)`);
    }
    else{
    console.log(`Server is running on port ${port}`);
    if (process.env.NODE_ENV === 'production') {
      console.log('[startup] trust proxy:', app.get('trust proxy'));
      console.log('[startup] SESSION_SECRET set:', Boolean(process.env.SESSION_SECRET));
      console.log('[startup] GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || '(not set)');
      console.log('[startup] Google OAuth:', Boolean(env.google_client_id && env.google_client_secret));
    }
    }
});