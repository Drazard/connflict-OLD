console.log("Starting sh2.js")

//Requires
const express = require('express');
const https = require('https');
const app = express();
const fs = require('fs');
const port = 9000;
const cookie = require('cookie');
const path = require("path");
const mysql = require("mysql");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const commands = require("./commands");
const funcs = require('./functions'); // My module
const publicDirectory = path.join(__dirname, './public');
const geoip = require('geoip-lite');
const { response } = require('express');

//Setting HTTPS Stuff
var key = fs.readFileSync('/etc/letsencrypt/live/connflict.com/privkey.pem');
var cert = fs.readFileSync('/etc/letsencrypt/live/connflict.com/fullchain.pem');
var options = {
  key: key,
  cert: cert
};

//Very important favicon
app.use('/favicon.ico', express.static('favicon.ico'));

//Setting parsers.
app.use(express.static(publicDirectory));
app.use(express.urlencoded({ extended: false })); //Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by HTML forms)
app.use(cookieParser()); // Parse cookies

//setting envpath
dotenv.config({ path: './.env' })

// Set the view engins.
app.set('view engine', 'hbs');

//Connect the database
function Database() {
  this.connection = mysql.createConnection({
    host     : process.env.DATABASE_HOST,
    user     : process.env.DATABASE_USER,
    password : process.env.DATABASE_PASS,
    database : process.env.DATABASE,
    multipleStatements: true
  });
  
  this.query = (sql, args) => {
    return new Promise((resolve, reject) => {
      this.connection.query(sql, args, (err, rows) => {
        if (err)
          return reject(err);
        resolve(rows);
      });
    });
  };

  this.close = () => {
    return async () => {
      try {
        this.connection.end(err => {
          if (err) throw err;
          return;
        });
      } catch(e) {
        return e;
      }
    }
  };
};
var db = new Database();

//define Routes
app.use('/', require('./routes/pages.js'));
app.use('/auth', require('./routes/auth'));

//Start the server
var server = https.createServer(options, app);
var io = require('socket.io')(server, {
  cors: {
    origin: "https://www.slavehack2.com",
    methods: ["GET", "POST"],
    }
  });

  

//keep the connection to the database open
setInterval(() => {
  db.query('SELECT 1');
}, 5*60*1000);

//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)

    socket.onAny( async (event, data) => { //When we get any emit  (on any)
        
         //Set TimeStamps
        timestamp = new Date().toLocaleTimeString(); //console.log(timestamp); //Timestamp (2:19:30 am)
        datestamp = new Date().toLocaleDateString(); //console.log(datestamp) // Datestamp (17/02/2021)
        datetimestamp = new Date().toLocaleString(); //console.log(datetimestamp) // Datestamp (17/02/2021, 2:19:30 am)

        console.log(`[${event}]`, data.room,data.username,data.id,data.message,data.time);
        if(event == 'chat'){
          db.query(`INSERT sh2log SET ?`, {'room': data.room, 'username': data.username, 'userid':data.id, 'message':data.message,'time':data.time})
        }
        if(event == 'chat-edit'){
          console.log(`[${event}] ${data.username} ${data.message}`)
          db.query(`INSERT sh2log SET ?`, {'room': data.room, 'username': data.username, 'userid':data.id, 'message':data.message,'time':data.time})
        }
        

        
    });

}); //END SOCKETS



//START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});

console.log(`Server started on port ${port}`);


setTimeout(() => {

}, 1000);