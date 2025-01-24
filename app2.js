console.log("Starting app.js")

//Requires
const express = require('express');
const https = require('https');
const app = express();
const fs = require('fs');
const port = 3000;
const cookie = require('cookie');
const path = require("path");
const mysql = require("mysql");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const commands = require("./commands");
const funcs = require('./functions'); // My module
const publicDirectory = path.join(__dirname, './public');
const geoip = require('geoip-lite');

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
    origin: "https://112.213.37.147:3000",
    methods: ["GET", "POST"]
    }
  });

//keep the connection to the database open
setInterval(() => {
  db.query('SELECT 1');
}, 5*60*1000);



//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)

    let cookies = cookie.parse(socket.request.headers.cookie || ''); //Get cookies from request headers
    let drazToken = cookies.draz                                     //Turn cookies into a managable string
    let authUser = await commands.authUser(drazToken)                //return userdata if the user exists that matches the cookies
    
    if(!authUser){ //check we are logged in
        timestamp = new Date().toLocaleTimeString();                                             //Set the current time
        let geo = await geoip.lookup(socket.handshake.address)                                   //Grab the users geo location data from IP
        let geoString = `${socket.handshake.address}>${geo.country}>${geo.region}>${geo.city}`   //format the geodata into a nice string
        funcs.log(`[{(?BOT DETECTED?)}] (${timestamp}) [${geoString}]`)                          //WE might have a bot, so make a special alert for this in the log.
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                      //send a redirect to logout
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: U0] - Try re-logging`);                 //let them know there has been an error (kinda pointless)
                                                                      //disconnect the socketid for good measure
    }
    if(authUser.user_banned >= 1){ //check if the user is banned
      socket.emit("redirect", `https://connflict.com:3000/auth/logout`);
      socket.emit("chat", `(${timestamp}) [ERROR-CODE: B1] - youve been banned.`);  
      io.emit('chat', `<p style="color:red">[SYSTEM] ${authUser.user_name} tried to login (banned) <p>`)
      setTimeout(() => { 
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);   
        socket.disconnect() 
      }, 3000);
           
      return              //send a redirect to logout
      
    }
    socket.name = authUser.user_name;                         // Grab our users username
    socket.id = authUser.user_id;
    socket.banned = authUser.user_banned;

    console.log("Socketnickanem", socket.name)
    console.log("socketid ", socket.userid)

    let userTerminal = await commands.userTerminal(socket.id)
    socket.ip = userTerminal.terminal_ip;
    console.log("socketip", socket.ip)
    let hostIP = userTerminal.terminal_ip;             //define our users ip address  (wasnt used?)
    //let remoteIP = userTerminal.terminal_connectedto;  //define our users target      (wasnt used?)
    //console.log("connected to", socket.rooms)
    var antiSpam = []; //declair an array of antiSpam to catch spammers
    setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.
    
    socket.onAny( async (event, data) => { //When we get any emit  (on any)

      function commandParse(data){
        cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
        cmd = cmdSplit[0];                        //the command will be the first entity (0)
        cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
        return cmd, cmd_args
      }
      
      console.log(`[EVENT: ${event}] DATA: ${data}`) //log the data incase we fuck somehting up.

      data_sanitized = data       //Sanitize the data so we dont get shafted.
        .replace(/&/g, '&amp;')   //Remove &
        .replace(/</g, '&lt;')    //Remove <
        .replace(/>/g, '&gt;')    //Remove >
        .replace(/"/g, '&quot;')  //Remove " 
        .replace(/'/g, '&#039;')  //Remove '

      //Set TimeStamps
      timestamp = new Date().toLocaleTimeString(); //console.log(timestamp); //Timestamp (2:19:30 am)
      datestamp = new Date().toLocaleDateString(); //console.log(datestamp) // Datestamp (17/02/2021)
      datetimestamp = new Date().toLocaleString(); //console.log(datetimestamp) // Datestamp (17/02/2021, 2:19:30 am)

      //Set user identification stuff
      let geo = await geoip.lookup(socket.handshake.address)                                   //Grab the geolocation data from our user
      let geoString = `${socket.handshake.address}>${geo.country}>${geo.region}>${geo.city}`   //turn the geodata into a more readable string for use with logs
      let cookies = cookie.parse(socket.request.headers.cookie || '');                         //Grab the cookies
      let drazToken = cookies.draz                                                             //set the cookies to drazToken
      let authUser = await commands.authUser(drazToken)                                        //run function to check if the user matches a real user
      let socketid = String(socket.id);                                                        //set the socketid of our user

      //ANTI SPAM
      var spamCount = {};                                                            //set the spamcount to nothing.
      await antiSpam.push(socketid)                                                  //add a count to our array (this can be improved on)
      await antiSpam.forEach(function(x) { spamCount[x] = (spamCount[x] || 0)+1; }); //this... does something? adds up the spam count per socketid
      let tooMuchSpam = spamCount[socketid]     

      if(!authUser){  //Chekc that the user is authenticated correctly                              
        funcs.log(`[{(?BOT DETECTED?)}] (${timestamp}) [${geoString}] ${data}`)    //WE might have a bot, so make a special alert for this in the log.
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);        //send a redirect to logout
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: U0] - Try re-logging`);   //let them know there has been an error
        return socket.disconnect() //disconnect the socketid for good measure
      }

      if(authUser.user_banned >= 1){ //check if the user is banned
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: B1] - youve been banned.`);  
        setTimeout(() => { 
          socket.emit("redirect", `https://connflict.com:3000/auth/logout`);   
          socket.disconnect() 
        }, 3000);
             
        return              //send a redirect to logout
        
      }

      if(tooMuchSpam > 5){ //Check we havent spammed too hard.
        io.emit('chat', `<p style="color:red">[SYSTEM] ${authUser.user_name} banned for 5 minutes. (plznospam)<p>`) //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
        await db.query(`UPDATE users SET user_banned = '1' WHERE user_id = ${socket.id}`)
        console.log(`Banning user ${socket.id}`)
        funcs.log(`[{(BOT DETECTION SPAM)}] (${timestamp}) [${geoString}] [EVENT:${event}][DATA:${data}]`)  //log our spammer
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`); //logout our spammer
        console.log(`Banning user ${socket.id}`)
        setInterval(() => {
          console.log(`UN-banning user ${socket.id}`)
          db.query(`UPDATE users SET user_banned = '0' WHERE user_id = ${socket.id}`)
        }, 5*60*1000);
        socket.disconnect() //disconnect the socketid for good measure
      }
      if (event == "chat"){ //parse and handle users chat messages and chat commands (chat commands not implemented yet)
        var randomColor = Math.floor(Math.random()*16777215).toString(16);
        var colourName = `<span style="color:#${randomColor};">${authUser.user_name}</span>`
        if(data.startsWith("https://i.imgur.com/")){
          data_sanitized = `<li>${data}<br><img src='${data}'  style="border:5px solid black; max-height:350px; max-width:100%"></li>`
        }
        let admins = ["Draz", "Drazard", "ADMIN"]
        if(data.startsWith("!ban") && admins.includes(socket.name)){
          console.log("Banning logic activated by"+socket.name)
          let cmd, cmd_args = await commandParse(data) // parse the data and split into command / args
          console.log("cmd and cmdargs", cmd, cmd_args)
          let bannedUSer = cmd_args[0]
          
          try {
            eval(cmd_args[1])
          } catch (error) {
            return socket.emit('chat', `<p style="color:orange">'${banseconds}' isnt a specificed time dumbass...</p>`)
          }

          if (!cmd_args[1]){
            var banseconds = 300
          }else{
            var banseconds = eval(cmd_args[1])
          }
          //1*5+300-27*4/40
          setTimeout(() => { io.emit('chat', `<p style="color:red">[SYSTEM] ${bannedUSer} banned for ${banseconds} seconds.<p>`)  }, 500);  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
          await db.query(`UPDATE users SET user_banned = '1' WHERE user_name = '${bannedUSer}'`)
          console.log(`Banning user '${bannedUSer}'`)
          setTimeout(() => {
            console.log(`UN-banning user ${bannedUSer}`)
            db.query(`UPDATE users SET user_banned = '0' WHERE user_name = '${bannedUSer}'`)
            io.emit('chat', `<p style="color:green">[SYSTEM] ${bannedUSer} has been unbanned... (plznospam)<p>`) //let everyone know they are back.
          }, banseconds*1000);
        }
        if(data.startsWith("!unban") && admins.includes(socket.name)){
          console.log("Banning logic activated by"+socket.name)
          let cmd, cmd_args = await commandParse(data) // parse the data and split into command / args
          console.log("cmd and cmdargs", cmd, cmd_args)
          let bannedUSer = cmd_args[0]
          setTimeout(() => { io.emit('chat', `<p style="color:green">[SYSTEM] ${bannedUSer} has been unbanned... (plznospam)<p>`)  }, 500); //let everyone know they are back.  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
          await db.query(`UPDATE users SET user_banned = '0' WHERE user_name = '${bannedUSer}'`)
        }



        //kick user
        //socket.disconnect()
        if(data.startsWith("!kick") && admins.includes(socket.name)){
          
          console.log("kicking logic activated by"+socket.name)
          let cmd, cmd_args = await commandParse(data) // parse the data and split into command / args
          console.log("cmd and cmdargs", cmd, cmd_args)
          let bannedUSer = cmd_args[0]
          let usersocket = await db.query(`SELECT user_id from users WHERE user_name = '${cmd_args[0]}'`)
          let kickeduser = usersocket[0].user_id;
          io.socket.disconnect()
          io.sockets.connected[kickeduser].disconnect();
          io.sockets.connected
          setTimeout(() => { io.emit('chat', `<p style="color:red">[SYSTEM] ${bannedUSer} has been kicked`)  }, 500); //let everyone know they are back.  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
        }
        

        //INSERT the chat line to the database so we can log it and also retraive later (should turn this into a function for inserting stuff in general...)
        await db.query('INSERT log_chat SET ?', { user_id:authUser.user_id, log_chat_time: datetimestamp, log_chat_username: colourName, log_chat_message:data_sanitized}, (error, results) => {
          console.log("Backing up chat to db")
          if(error){
              console.log(error);return console.log("ERROR ADDINS CHATHISTORY")
          }             
        });

        //Broadcast the chat message to everyone in chat as well as ourselves on a succesfull database entry
        
        
        messageString = `<small><small><i>(${timestamp.slice(0,5)})</i></small></small> <b>[${colourName}]</b> ${data_sanitized}`
        console.log(`[CHAT] (${timestamp.slice(0,5)}) [${authUser.user_name}] ${data}`) // just console log this i guess?
        console.log(`${socket.name}: ${data}`)
        return io.emit('chat', messageString) //broadcast the chat to all clients using the 'chat' channel

      }
      else if (event == "local_cmd"){ //handle the commands from within the localhost temrinal  (NEW unfinished)
        //find our users terminal based off his socket.id
        let userTerminal = await commands.userTerminal(socket.id)    

        var remoteIP = userTerminal.terminal_connectedto;  //define our users target
        if(hostIP == remoteIP)
        console.log(`[LOCAL_CMMD] (${timestamp.slice(0,5)}) ${socket.id} ${socket.name}@${hostIP}:~$ ${data}`) // just console log this i guess?
        socket.emit("local_cmd", `<p>${socket.name}@${hostIP}:~$ ${data_sanitized}<p>`) //send a log to our user
        
        function commandParse(data){
          cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
          cmd = cmdSplit[0];                        //the command will be the first entity (0)
          cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
          return cmd, cmd_args
        }

        var cmd, cmd_args = await commandParse(data) // parse the data and split into command / args

        //Handle our command and args
        if(cmd == "create")                             {     response = await commands.create(hostIP, socket.id, cmd, cmd_args);                                                                          }
        else if(cmd == "del")                           {     response = await commands.delete(hostIP, cmd_args[0]);                                                                                  }
        else if(cmd == "upload")                        {     response = await commands.upload(hostIP, socket.id, cmd_args[0], remoteIP);                                                                  }
        else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
        else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.id, cmd_args[0]); await socket.join(cmd_args[0]);              }
        else if(cmd == "disconnect")                    {     response = `You cannot disconnect from yourself?...`                                                }
        else if(cmd == "ls")                            {     response = await commands.ls(hostIP);                                                                                                   }
        else if(cmd == "crypto")                        {     response = await commands.crypto(socket.id);                                                                                                 }
        else if(cmd == "cls")                           {     response = "cls";                                                                                                                         }
        else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
        else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

        //log the terminal command used to the database
        await db.query(`INSERT log_terminal SET ?`, {user_id: socket.id, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:hostIP, log_terminal_response: response})

        //send response and keylogs
        //get all users who have loggers on me
        let loggerserror, loggers = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog' AND software_location = '${socket.id}'`)
        //check we have a result
        if (loggers[0]){ 
          //loop throught each result
          for(var i = 0;i<loggers.length; i++){
            var software_location = loggers[i].software_location;
            var software_creator = loggers[i].software_creator;
            //console.log("location", loggers[i].software_location)
            if(!(software_creator == software_location)){  //if the owner isnt yourself
              //var keylogTarget = await db.query(`SELECT user_socket from users WHERE user_id = '${software_creator}'`)
              var keylogTarget = socket.id
              //await socket.to(keylogTarget).emit("cmd_log",`<ul style="color:red">THIS IS KEYLOGGER: ${response}</ul><br>`); 
              //console.log(`${keylogTarget} needs to be sent the command ${data_sanitized}`)
              //console.log("joining room", keylogTarget, socket.rooms)
              io.to(keylogTarget).emit("key_log",`<p style="color:darkred">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
              io.to(keylogTarget).emit("key_log",`<ul style="color:darkred">${response}</ul><br>`);
            }
          }
          //send commands to said people
          //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
        }
        //make an array to hold userids
        var remoteID = await db.query(`SELECT user_socket, user_id from user_terminal WHERE terminal_connectedto = '${hostIP}'`)
        for(var i = 0;i<remoteID.length; i++){ //for each ID that is connected to my ip address.
          if(remoteID[i].user_socket == socket.id){}else{ 
            socket.to(remoteID[i].user_socket).emit("cmd_remote", "open");
            //console.log(`user connected to ${socket.id} is ${remoteID[i].user_id}`)//chekc to make sure its not our user.
            socket.to(remoteID[i].user_socket).emit("cmd_remote",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
            socket.to(remoteID[i].user_socket).emit("cmd_remote",`<ul style="color:darkgreen">${response}</ul><br>`); 
            
          }
        }
        return socket.emit("local_cmd", `<ul>${response}</ul><br>`);
      }
      else if (event == "remote_cmd"){ //handle commands from within the remotehost terminal  (NEW unfinished)
        //find our users terminal based off his socket.id
        let userTerminal = await commands.userTerminal(socket.id)    

        var hostIP = userTerminal.terminal_ip;             //define our users ip address
        var remoteIP = userTerminal.terminal_connectedto;  //define our users target

        console.log(`[REMOTE_CMMD] (${timestamp.slice(0,5)}) ${socket.id} ${socket.name}@${hostIP}:~$ ${data}`) // just console log this i guess?
        socket.emit("remote_cmd", `<p>${socket.name}@${hostIP}:~$ ${data_sanitized}<p>`) //send a log to our user

        var cmd, cmd_args = await commandParse(data) // parse the data and split into command / args

        //Handle our command and args
        if(hostIP == remoteIP)                          {     response = `You are not connected to a target`                                                                                          }
        else if(cmd == "create")                             {     response = `ACCESS DENIED: Msising chron permissions to create '${cmd_args[0]}'`                                                                          }
        else if(cmd == "del")                           {     response = await commands.delete(remoteIP, cmd_args[0]);                                                                                  }
        else if(cmd == "upload")                        {     response = `You cannot use that command here.`                                                                  }
        else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
        else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.id, cmd_args[0]); await socket.join(cmd_args[0]);               }
        else if(cmd == "disconnect")                    {     response = await commands.disconnect(socket.id, hostIP);                                                }
        else if(cmd == "ls")                            {     response = await commands.ls(remoteIP);                                                                                                   }
        else if(cmd == "crypto")                        {     response = await commands.crypto(remoteID);                                                                                                 }
        else if(cmd == "cls")                           {     response = "cls";                                                                                                                         }
        else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
        else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

        //log the terminal command used to the database
        await db.query(`INSERT log_terminal SET ?`, {user_id: socket.id, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:hostIP, log_terminal_response: response})

        //send response and keylogs
        //get all users who have loggers on me
        let loggerserror, loggers = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog' AND software_location = '${socket.id}'`)
        //check we have a result
        if (loggers[0]){ 
          //loop throught each result
          for(var i = 0;i<loggers.length; i++){
            var software_location = loggers[i].software_location;
            var software_creator = loggers[i].software_creator;
            //console.log("location", loggers[i].software_location)
            if(!(software_creator == software_location)){  //if the owner isnt yourself
              var keylogTarget = await db.query(`SELECT user_socket from users WHERE user_id = '${software_creator}'`)
              var keylogTarget = keylogTarget[0].user_socket
              //await socket.to(keylogTarget).emit("cmd_log",`<ul style="color:red">THIS IS KEYLOGGER: ${response}</ul><br>`); 
              //console.log(`${keylogTarget} needs to be sent the command ${data_sanitized}`)
              //console.log("joining room", keylogTarget, socket.rooms)
              io.to(keylogTarget).emit("key_log",`<p style="color:darkred">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
              io.to(keylogTarget).emit("key_log",`<ul style="color:darkred">${response}</ul><br>`);
            }
          }
          //send commands to said people
          //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
        }
        //make an array to hold userids
        var remoteID = await db.query(`SELECT user_socket, user_id from user_terminal WHERE terminal_connectedto = '${hostIP}'`)
        for(var i = 0;i<remoteID.length; i++){ //for each ID that is connected to my ip address.
          if(remoteID[i].user_socket == socket.id){}else{ 
            socket.to(remoteID[i].user_socket).emit("cmd_remote", "open");
            //console.log(`user connected to ${socket.id} is ${remoteID[i].user_id}`)//chekc to make sure its not our user.
            socket.to(remoteID[i].user_socket).emit("cmd_remote",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
            socket.to(remoteID[i].user_socket).emit("cmd_remote",`<ul style="color:darkgreen">${response}</ul><br>`); 
            
          }
        }
        return socket.emit("remote_cmd", `<ul>${response}</ul><br>`);
      }
      else if (event == "klog_cmd"){ //handle the commands from within the keylogger terminal (NEW unfinished)
        //commands for the keylogger window
        return socket.emit("klog_cmd", `<ul>${data_sanitized}</ul><br>`);
      }
      else if (event == "cmd"){ // handle the commands from terminal (OLD, needs to be changed and removed)

        //find our users terminal based off his socket.id
        let userTerminal = await commands.userTerminal(socket.id)    

        var hostIP = userTerminal.terminal_ip;             //define our users ip address
        var remoteIP = userTerminal.terminal_connectedto;  //define our users target

        console.log(`[CMMD] (${timestamp.slice(0,5)}) ${socket.id} ${socket.name}@${hostIP}:~$ ${data}`) // just console log this i guess?
        socket.emit("cmd", `<p>${socket.name}@${hostIP}:~$ ${data_sanitized}<p>`) //send a log to our user
        
        function commandParse(data){
          cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
          cmd = cmdSplit[0];                        //the command will be the first entity (0)
          cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
          return cmd, cmd_args
        }

        var cmd, cmd_args = await commandParse(data) // parse the data and split into command / args

        //Handle our command and args
        if(cmd == "create")                             {     response = await commands.create(hostIP, socket.id, cmd, cmd_args);                                                                          }
        else if(cmd == "del")                           {     response = await commands.delete(remoteIP, cmd_args[0]);                                                                                  }
        else if(cmd == "upload")                        {     response = await commands.upload(hostIP, socket.id, cmd_args[0], remoteIP);                                                                  }
        else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
        else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.id, cmd_args[0]); await socket.join(cmd_args[0]);  socket.emit("cmd_remote", "open");               }
        else if(cmd == "disconnect")                    {     response = await commands.disconnect(socket.id, hostIP);  socket.emit("cmd_remote", "close");                                                }
        else if(cmd == "ls")                            {     response = await commands.ls(remoteIP);                                                                                                   }
        else if(cmd == "crypto")                        {     response = await commands.crypto(socket.id);                                                                                                 }
        else if(cmd == "cls")                           {     response = "cls";                                                                                                                         }
        else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
        else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

        //log the terminal command used to the database
        await db.query(`INSERT log_terminal SET ?`, {user_id: socket.id, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:hostIP, log_terminal_response: response})

        //send response and keylogs
        //get all users who have loggers on me
        let loggerserror, loggers = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog' AND software_location = '${socket.id}'`)
        //check we have a result
        if (loggers[0]){ 
          //loop throught each result
          for(var i = 0;i<loggers.length; i++){
            var software_location = loggers[i].software_location;
            var software_creator = loggers[i].software_creator;
            //console.log("location", loggers[i].software_location)
            if(!(software_creator == software_location)){  //if the owner isnt yourself
              var keylogTarget = await db.query(`SELECT user_socket from users WHERE user_id = '${software_creator}'`)
              var keylogTarget = keylogTarget[0].user_socket
              //await socket.to(keylogTarget).emit("cmd_log",`<ul style="color:red">THIS IS KEYLOGGER: ${response}</ul><br>`); 
              //console.log(`${keylogTarget} needs to be sent the command ${data_sanitized}`)
              //console.log("joining room", keylogTarget, socket.rooms)
              io.to(keylogTarget).emit("key_log",`<p style="color:darkred">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
              io.to(keylogTarget).emit("key_log",`<ul style="color:darkred">${response}</ul><br>`);
            }
          }
          //send commands to said people
          //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
        }
        //make an array to hold userids
        var remoteID = await db.query(`SELECT user_socket, user_id from user_terminal WHERE terminal_connectedto = '${hostIP}'`)
        for(var i = 0;i<remoteID.length; i++){ //for each ID that is connected to my ip address.
          if(remoteID[i].user_socket == socket.id){}else{ 
            socket.to(remoteID[i].user_socket).emit("cmd_remote", "open");
            //console.log(`user connected to ${socket.id} is ${remoteID[i].user_id}`)//chekc to make sure its not our user.
            socket.to(remoteID[i].user_socket).emit("cmd_remote",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
            socket.to(remoteID[i].user_socket).emit("cmd_remote",`<ul style="color:darkgreen">${response}</ul><br>`); 
            
          }
        }
        return socket.emit("cmd", `<ul>${response}</ul><br>`);
      }
      else if (event == "admin"){ //admin functions
        socket.broadcast.emit('chat', `Slavehack: <br> ${msg}`)
        socket.emit("chat", `Slavehack: <br> ${msg}`);
      }
      else if (event == "getminers"){ //get all the active mienrs for the user
        let error, miners = await db.query(`SELECT * from gamesoftware WHERE software_type = 'burstminer' OR software_type = 'btcminer'`)
        if(miners){
          var returnString = `<th colspan="5"><h1><center>ACTIVE MINERS</center></h1></th>
          <tr>
              <td>ID</td>
              <td>NAME</td>
              <td>TYPE</td>
              <td>LEVEL</td>
              <td>LOCATION</td>
              </tr>`;
          //console.log(miners)
          let authUser = await commands.authUser(drazToken)
          let socket.name = authUser.user_name;
          let socket.id = authUser.user_id;
          //console.log("Host ID is: ",socket.id)
          for(var i = 0;i<miners.length;i++){
            //console.log(miners[i].software_creator, miners[i].software_location)
            if( (miners[i].software_creator == socket.id) && (socket.id != miners[i].software_location) ){
              let error, softLocale = await db.query(`SELECT terminal_ip FROM user_terminal WHERE user_id = ${miners[i].software_location}`)
              //console.log(miners[i].software_name)
              returnString = returnString +`
              <tr>
              <td>${miners[i].software_id}</td>
              <td>${miners[i].software_name}</td>
              <td>${miners[i].software_type}</td>
              <td>${miners[i].software_level}</td>
              <td>${softLocale[0].terminal_ip}</td>
              </tr>
              `
            }
          }
          //console.log(returnString)
          io.to(socket.id).emit("minersUpdate", returnString);
          //console.log(`${socket.id} is requesting miners`)
        }
      }
      else if (event == "chathistory"){ //get the last 50 lines of chat history for the suer
        //show chat history
        let error, chatHistory = await db.query(`SELECT * FROM (
            SELECT * FROM log_chat ORDER BY log_chat_id DESC LIMIT 50
        ) sub
        ORDER BY log_chat_id ASC`)
        if(!chatHistory[0]){
            console.log("error with chathisrtoy")
        }else{
            
            var history;
            for(var i=0;i<chatHistory.length;i++){
                history += `<small><small><i>(${chatHistory[i].log_chat_time.slice(12,17)})</i></small></small> <b>[${chatHistory[i].log_chat_username}] </b>${chatHistory[i].log_chat_message}<br>`
            }
            await socket.emit('chat', history)   
        }
      }
      else if (event == "cmdhistory"){ //Get the last 50 lines of terminal history for the user
        //show chat history
        let error, cmdHistory = await db.query(`SELECT * FROM (
          SELECT * FROM log_terminal
          WHERE user_id = '${socket.id}'
          ORDER BY log_terminal_id DESC LIMIT 50
      ) sub
      ORDER BY log_terminal_id ASC`)
      if(!cmdHistory[0]){
          console.log("No CMD history.")
      }else{
          
          var history;
          for(var i=0;i<cmdHistory.length;i++){
              history += `<p>${socket.name}@${cmdHistory[i].log_terminal_ip}:~$ ${cmdHistory[i].log_terminal_command}</p><p>${cmdHistory[i].log_terminal_response}</p>`
          }
          
          await socket.emit('cmd', history)   
      }
      }
      else if (event == "browser"){ //return a web browser page to the user
        
        let pagedir = `/${__dirname}/websites/${data_sanitized}.html`
        let cssdir = `/${__dirname}/websites/${data_sanitized}.css`
        var fs = require('fs').promises;
        try {
          let websitedata = await fs.readFile(pagedir, 'utf8');
          let cssdata = await  fs.readFile(cssdir, 'utf8');
          
          response = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta http-equiv="X-UA-Compatible" content="IE=edge">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>${cssdata}</style>
              <title>${data_sanitized}</title>
          </head>
          <body>
              ${websitedata}
          </body>
          </html>
          `
          await socket.emit('browser', response)
          //console.log(response)
        } catch (error) {
          
          var response = `<h1> 404 PAGE NOT FOUND <br> '${data_sanitized}' </h1>`
          await socket.emit('browser', response)
          //console.log(response);
        }     
      }
      else if (event == "4.18.1.26"){
        socket.to(data).emit("local_cmd",`<ul>${socket.name} You have used the chat...</ul>`); 
        io.emit('chat', `${socket.name} IP: ${socket.ip}`) //broadcast the chat to all clients using the 'chat' channel
        // let randomColor = Math.floor(Math.random()*16777215).toString(16);
        let colourName = `<span style="color:#${randomColor};">${socket.name}</span>`
        messageString = `<small><small><i>(${timestamp.slice(0,5)})</i></small></small> <b>[${colourName}]</b> ${data_sanitized}`
        return io.emit('chat', messageString) //broadcast the chat to all clients using the 'chat' channel
      }
      else{ //Unauthoried event, log it.
        //END socket logic and return nothing
        return funcs.log(`[({UNAUTHORIZED EVENT})] [${geoString}][EVENT: ${event}] [DATA: ${data}]`);
      }    
    });
}); //END SOCKETS

function keylogger (){

}
//START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});
console.log(`Server started on port ${port} ${__dirname}`);
