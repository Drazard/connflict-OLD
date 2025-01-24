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

var clients = [];

// setTimeout(() => {
//   io.emit("chat", `<p>(${timestamp}) Server was restarted</p>`);   
// }, 5000);



var serverRestart = 1;

setTimeout(() => {
  serverRestart = 0;
}, 60*1000);

var admins = ["Drazard", "ADMIN"]
//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)

    
    //console.log(socket.rooms)
    let cookies = cookie.parse(socket.request.headers.cookie || ''); //Get cookies from request headers
    socket.cookies = cookies.draz                                     //Turn cookies into a managable string
    let authUser = await commands.authUser(socket.cookies)                //return userdata if the user exists that matches the cookies
    
    if(!authUser){ //check we are logged in
        timestamp = new Date().toLocaleTimeString();                                             //Set the current time
        let geo = await geoip.lookup(socket.handshake.address)                                   //Grab the users geo location data from IP
        let geoString = `${socket.handshake.address}>${geo.country}>${geo.region}>${geo.city}`   //format the geodata into a nice string
        funcs.log(`[{(?BOT DETECTED?)}] (${timestamp}) [${geoString}]`)                          //WE might have a bot, so make a special alert for this in the log.
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                      //send a redirect to logout
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: U0] - Try re-logging`);                 //let them know there has been an error (kinda pointless)
        return socket.disconnect();                                                              //disconnect the socketid for good measure
    }else{
        //set our socket to authorized
        socket.authorized = 1
        let geo = await geoip.lookup(socket.handshake.address)   
        socket.geolocation = `${socket.handshake.address}>${geo.country}>${geo.region}>${geo.city}`    
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
    //give our user vps his socket.id
    await db.query(`UPDATE user_vps SET ? WHERE user_id = '${authUser.user_id}'`, {vps_socket: socket.id}) 

    //Grab the geolocation data from our user
    let geo = await geoip.lookup(socket.handshake.address)     
    //Set the geolocation data from our user
    socket.irl_ip = socket.handshake.address    
    socket.irl_country = geo.country         
    socket.irl_state = geo.region    
    socket.irl_city = geo.city     

    //setup our user socet with data
    socket.user_name = authUser.user_name;  //set name
    socket.user_id = authUser.user_id;  //set userid
    socket.chat_color = authUser.chat_color

    
      //getting the users vps stats
      let errorVps, userVps = await commands.vpsData(authUser.user_id);
      if(errorVps){
        console.log(errorVps)
      }
      //set the users vps stats
      socket.vps_hostip = userVps.vps_hostip
      socket.vps_remoteip = userVps.vps_remoteip
      socket.vps_socket = userVps.vps_socket
      socket.vps_cpu = userVps.vps_cpu
      socket.vps_ram = userVps.vps_ram
      socket.vps_hdd = userVps.vps_hdd
      socket.vps_network = userVps.vps_network
      socket.vps_power = userVps.vps_power
      socket.vps_history = userVps.vps_history


    
    clients.push(socket.user_name); 
    
    //announce when a  user joins, only if we didnt recently restart the server
    if(!serverRestart){
      io.emit('chat', `${socket.user_name} online.`)
    }
    
    var antiSpam = []; //declair an array of antiSpam to catch spammers
    setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.
    
    socket.onAny( async (event, data) => { //When we get any emit  (on any)

         //Set TimeStamps
        timestamp = new Date().toLocaleTimeString(); //console.log(timestamp); //Timestamp (2:19:30 am)
        datestamp = new Date().toLocaleDateString(); //console.log(datestamp) // Datestamp (17/02/2021)
        datetimestamp = new Date().toLocaleString(); //console.log(datetimestamp) // Datestamp (17/02/2021, 2:19:30 am)
        logstring = `
        (${datetimestamp}) ${socket.id}
        [EVENT: ${event}] 
        [DATA: ${data}]
        [GEO: ${socket.geolocation}]
        `
        console.log(logstring) //log the data incase we fuck somehting up.
        if(typeof data != "object"){
          data_sanitized = data         //Sanitize the data so we dont get shafted.
            .replace(/&/g, '&amp;')   //Remove &
            .replace(/</g, '&lt;')    //Remove <
            .replace(/>/g, '&gt;')    //Remove >
            .replace(/"/g, '&quot;')  //Remove " 
            .replace(/'/g, '&#039;')  //Remove '
        }
        

      let authUser = await commands.authUser(socket.cookies)                                        //run function to check if the user matches a real user

      //ANTI SPAM
      var spamCount = {};                                                            //set the spamcount to nothing.
      await antiSpam.push(socket.id)                                                  //add a count to our array (this can be improved on)
      await antiSpam.forEach(function(x) { spamCount[x] = (spamCount[x] || 0)+1; }); //this... does something? adds up the spam count per socketid
      let tooMuchSpam = spamCount[socket.id]     

      if(!authUser){  //Chekc that the user is authenticated correctly                              
        funcs.log(`[Unauthorized User] ${logstring}`)    //WE might have a bot, so make a special alert for this in the log.
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);        //send a redirect to logout
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: U0] - Try re-logging`);   //let them know there has been an error
        return socket.disconnect() //disconnect the socketid for good measure
      }else{
          socket.authorized = 1;
      }

      if(authUser.user_banned >= 1){ //check if the user is banned
        funcs.log(`[Banned User] ${logstring}`)
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: B1] - youve been banned.`);  
        setTimeout(() => { 
          socket.emit("redirect", `https://connflict.com:3000/auth/logout`);   
          socket.disconnect() 
        }, 3000);          
        return              //send a redirect to logout 
      }



      if(tooMuchSpam > 10){ //Check we havent spammed too hard.
        await db.query(`UPDATE users SET user_banned = '1' WHERE user_id = ${socket.user_id}`)
        io.emit('chat', `<p style="color:red">[SYSTEM] ${authUser.user_name}  autobanned for 5 minutes (spam)<p>`) //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
        funcs.log(`[AUTOBANNED] ${logstring}`)  //log our spammer
        
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`); //logout our spammer
        console.log(`Banning user ${socket.user_name}`)
        setInterval(() => {
          console.log(`UN-banning user ${socket.user_name}`)
          db.query(`UPDATE users SET user_banned = '0' WHERE user_id = ${socket.user_id}`)
        }, 5*60*1000);
        socket.disconnect() //disconnect the socketid for good measure
      }

      //setup command parsing
      function commandParse(data){
        cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
        cmd = cmdSplit[0];                        //the command will be the first entity (0)
        cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
        return cmd, cmd_args
      }

      // setTimeout(() => {
      //   io.to(socket.id).emit('local_cmd', "testing this even works");
      // }, 2500);

      if (event == "chat"){ //parse and handle users chat messages and chat commands (chat commands not implemented yet)

        //they wanted colored names........ fuckem.
        var randomColor = Math.floor(Math.random()*16777215).toString(16);                   //create a random color hex code
        var colourName = `<span style="color:#${randomColor};">${socket.user_name}</span>`   //set the user's colorname

        if(data.startsWith("https://i.imgur.com/")){
          data_sanitized = `<li>${data}<br><img src='${data}'  style="border:5px solid black; max-height:350px; max-width:100%"></li>`
        }
        
        //Chat command logic
        if(data.startsWith("!")){
          if(admins.includes(socket.user_name)){
            var cmd, cmdargs = await commandParse(data) // parse the data and split into command / args
            switch(cmd){
              case "!ban":
                let banuser = cmdargs[0];
                let banseconds = eval(cmd_args[1])
                try {
                  eval(cmdargs[1])
                } catch (error) {
                  return socket.emit('chat', `<p style="color:orange">'${banseconds}' isnt a valid time dumbass...</p>`)
                }
                io.emit('chat', `<p style="color:red">[SYSTEM] ${banuser} banned for ${banseconds} seconds by by ${socket.user_name}.<p>`)  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                await db.query(`UPDATE users SET user_banned = '1' WHERE user_name = '${banuser}'`)
                io.to(socket.id).emit("redirect", `https://connflict.com:3000/auth/logout`);
                setTimeout(() => {
                  console.log(`UN-banning user ${banuser}`)
                  db.query(`UPDATE users SET user_banned = '0' WHERE user_name = '${banuser}'`)
                  io.emit('chat', `<p style="color:green">[SYSTEM] ${banuser} has been unbanned by the system... (plznospam)<p>`) //let everyone know they are back.
                }, banseconds*1000);
              break;
              case "!unban":
                //console.log("Banning logic activated by"+socket.user_name)
                //let cmd, cmd_args = await commandParse(data) // parse the data and split into command / args
                //console.log("cmd and cmdargs", cmd, cmd_args)
                let unbanuser = cmd_args[0]
                io.emit('chat', `<p style="color:green">[SYSTEM] ${unbanuser} has been unbanned by ${socket.user_name}... (plznospam)<p>`) //let everyone know they are back.  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                await db.query(`UPDATE users SET user_banned = '0' WHERE user_name = '${unbanuser}'`)
              break;
              case "!refresh":
                io.emit('redirect', `https://connflict.com:3000/`)
              break;
              case "!online":
                //console.log(clients)
                io.to(socket.id).emit("chat",`<ul><p>${clients}</p></ul>`); 
              break;
              case "!kick":
                io.to(socket.user_name).emit("redirect", `https://connflict.com:3000/auth/logout`);
                setTimeout(() => { io.emit('chat', `<p style="color:red">[SYSTEM] ${cmd_args[0]} has been kicked`)  }, 500);
              break;
              default:
                io.to(socket.id).emit('chat', `${cmd} is not a command`);
                break;
            }

          }else{
            let nameUpper = socket.user_name.toUpperCase()
            return socket.emit('chat', `<p style="color:red">${nameUpper} YOU ARE NOT AN ADMIN...</p>`)
          }
          return;
        }
        //kick user

        //INSERT the chat line to the database so we can log it and also retraive later (should turn this into a function for inserting stuff in general...)
        await db.query('INSERT log_chat SET ?', { user_id:socket.user_id, log_chat_time: datetimestamp, log_chat_username: colourName, log_chat_message:data_sanitized}, (error, results) => {
          //console.log("Backing up chat to db")
          if(error){
              console.log(error);return console.log("ERROR ADDINS CHATHISTORY")
          }             
        });

        //Broadcast the chat message to everyone in chat as well as ourselves on a succesfull database entry
        messageString = `<small><small><i>(${timestamp.slice(0,5)})</i></small></small> <b>[${colourName}]</b> ${data_sanitized}`
        return io.emit('chat', messageString) //broadcast the chat to all clients using the 'chat' channel
      }
      // else if (event == "local_cmd"){ //handle the commands from within the localhost temrinal  (NEW unfinished)
      //   //find our users terminal based off his socket.id
      //   let userTerminal = await commands.userTerminal(socket.id)    


      //   cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
      //   cmd = cmdSplit[0];                        //the command will be the first entity (0)
      //   args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's

      //   var remoteIP = userTerminal.terminal_connectedto;  //define our users target
      //   if(socket.ip == remoteIP)
      //   console.log(`[LOCAL_CMMD] (${timestamp.slice(0,5)}) ${socket.id} ${socket.name}@${socket.ip}:~$ ${data}`) // just console log this i guess?
      //   socket.emit("local_cmd", `<p>${socket.name}@${socket.ip}:~$ ${data_sanitized}<p>`) //send a log to our user
        
      //   function commandParse(data){
      //     cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
      //     cmd = cmdSplit[0];                        //the command will be the first entity (0)
      //     cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
      //     return cmd, cmd_args
      //   }

      //   var cmd, cmd_args = await commandParse(data) // parse the data and split into command / args

      //   //Handle our command and args
      //   if(cmd == "create")                             {     response = await commands.create(socket.ip, socket.id, cmd, cmd_args);                                                                          }
      //   else if(cmd == "del")                           {     response = await commands.delete(socket.ip, cmd_args[0]);                                                                                  }
      //   else if(cmd == "upload")                        {     response = await commands.upload(socket.ip, socket.id, cmd_args[0], remoteIP);                                                                  }
      //   else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
      //   else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.id, cmd_args[0]); await socket.join(cmd_args[0]);              }
      //   else if(cmd == "disconnect")                    {     response = `You cannot disconnect from yourself?... try running this command in the remote terminal`                                                }
      //   else if(cmd == "ls")                            {     response = await commands.ls(socket.ip);                                                                                                   }
      //   else if(cmd == "crypto")                        {     response = await commands.crypto(socket.id);                                                                                                 }
      //   else if(cmd == "cls")                           {     response = "cls";                                                                                                                         }
      //   else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
      //   else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

      //   //log the terminal command used to the database
      //   await db.query(`INSERT log_terminal SET ?`, {user_id: socket.id, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:socket.vps_hostip, log_terminal_response: response})

      //   //send response and keylogs
      //   //get all users who have loggers on me
      //   let loggerserror, loggers = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog' AND software_location = '${socket.id}'`)
      //   //check we have a result
      //   if (loggers[0]){ 
      //     //loop throught each result
      //     for(var i = 0;i<loggers.length; i++){
      //       var software_location = loggers[i].software_location;
      //       var software_creator = loggers[i].software_creator;
      //       //console.log("location", loggers[i].software_location)
      //       if(!(software_creator == software_location)){  //if the owner isnt yourself
      //         //var keylogTarget = await db.query(`SELECT user_socket from users WHERE user_id = '${software_creator}'`)
      //         var keylogTarget = socket.id
      //         //await socket.to(keylogTarget).emit("cmd_log",`<ul style="color:red">THIS IS KEYLOGGER: ${response}</ul><br>`); 
      //         //console.log(`${keylogTarget} needs to be sent the command ${data_sanitized}`)
      //         //console.log("joining room", keylogTarget, socket.rooms)
      //         io.to(keylogTarget).emit("key_log",`<p style="color:darkred">${socket.name}@${socket.vps_hostip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
      //         io.to(keylogTarget).emit("key_log",`<ul style="color:darkred">${response}</ul><br>`);
      //       }
      //     }
      //     //send commands to said people
      //     //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
      //   }
      //   //make an array to hold userids
      //   var remoteID = await db.query(`SELECT user_id from user_terminal WHERE terminal_connectedto = '${socket.vps_remoteip}'`)
      //   for(var i = 0;i<remoteID.length; i++){ //for each ID that is connected to my ip address.
      //     if(remoteID[i].user_id == socket.id){}else{ 
      //       socket.to(remoteID[i].user_id).emit("cmd_remote", "open");
      //       //console.log(`user connected to ${socket.id} is ${remoteID[i].user_id}`)//chekc to make sure its not our user.
      //       socket.to(remoteID[i].user_id).emit("cmd_remote",`<p style="color:darkgreen">${socket.name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
      //       socket.to(remoteID[i].user_id).emit("cmd_remote",`<ul style="color:darkgreen">${response}</ul><br>`); 
            
      //     }
      //   }
      //   return socket.emit("local_cmd", `<ul>${response}</ul><br>`);
      // }
      // else if (event == "remote_cmd"){ //handle commands from within the remotehost terminal  (NEW unfinished)
      //   //find our users terminal based off his socket.id
      //   let userTerminal = await commands.userTerminal(socket.id)    

      //   socket.ip = userTerminal.terminal_ip;             //define our users ip address
      //   var remoteIP = userTerminal.terminal_connectedto;  //define our users target

      //   console.log(`[REMOTE_CMMD] (${timestamp.slice(0,5)}) ${socket.id} ${socket.name}@${socket.ip}:~$ ${data}`) // just console log this i guess?
      //   socket.emit("remote_cmd", `<p>${socket.name}@${socket.ip}:~$ ${data_sanitized}<p>`) //send a log to our user

      //   var cmd, cmd_args = await commandParse(data) // parse the data and split into command / args

      //   //Handle our command and args
      //   if(socket.ip == remoteIP)                          {     response = `You are not connected to a target`                                                                                          }
      //   else if(cmd == "create")                             {     response = `ACCESS DENIED: Msising chron permissions to create '${cmd_args[0]}'`                                                                          }
      //   else if(cmd == "del")                           {     response = await commands.delete(remoteIP, cmd_args[0]);                                                                                  }
      //   else if(cmd == "upload")                        {     response = `You cannot use that command here.`                                                                  }
      //   else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
      //   else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.id, cmd_args[0]); await socket.join(cmd_args[0]);               }
      //   else if(cmd == "disconnect")                    {     response = await commands.disconnect(socket.id, socket.ip);                                                }
      //   else if(cmd == "ls")                            {     response = await commands.ls(remoteIP);                                                                                                   }
      //   else if(cmd == "crypto")                        {     response = await commands.crypto(remoteID);                                                                                                 }
      //   else if(cmd == "cls")                           {     response = "cls";                                                                                                                         }
      //   else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
      //   else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

      //   //log the terminal command used to the database
      //   await db.query(`INSERT log_terminal SET ?`, {user_id: socket.id, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:socket.ip, log_terminal_response: response})

      //   //send response and keylogs
      //   //get all users who have loggers on me
      //   let loggerserror, loggers = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog' AND software_location = '${socket.id}'`)
      //   //check we have a result
      //   if (loggers[0]){ 
      //     //loop throught each result
      //     for(var i = 0;i<loggers.length; i++){
      //       var software_location = loggers[i].software_location;
      //       var software_creator = loggers[i].software_creator;
      //       //console.log("location", loggers[i].software_location)
      //       if(!(software_creator == software_location)){  //if the owner isnt yourself
      //         var keylogTarget = await db.query(`SELECT user_id from users WHERE user_id = '${software_creator}'`)
      //         var keylogTarget = keylogTarget[0].user_id
      //         //await socket.to(keylogTarget).emit("cmd_log",`<ul style="color:red">THIS IS KEYLOGGER: ${response}</ul><br>`); 
      //         //console.log(`${keylogTarget} needs to be sent the command ${data_sanitized}`)
      //         //console.log("joining room", keylogTarget, socket.rooms)
      //         io.to(keylogTarget).emit("key_log",`<p style="color:darkred">${socket.name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
      //         io.to(keylogTarget).emit("key_log",`<ul style="color:darkred">${response}</ul><br>`);
      //       }
      //     }
      //     //send commands to said people
      //     //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
      //   }
      //   //make an array to hold userids
      //   var remoteID = await db.query(`SELECT user_id from user_terminal WHERE terminal_connectedto = '${socket.ip}'`)
      //   for(var i = 0;i<remoteID.length; i++){ //for each ID that is connected to my ip address.
      //     if(remoteID[i].user_id == socket.id){}else{ 
      //       socket.to(remoteID[i].user_id).emit("cmd_remote", "open");
      //       //console.log(`user connected to ${socket.id} is ${remoteID[i].user_id}`)//chekc to make sure its not our user.
      //       socket.to(remoteID[i].user_id).emit("cmd_remote",`<p style="color:darkgreen">${socket.name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
      //       socket.to(remoteID[i].user_id).emit("cmd_remote",`<ul style="color:darkgreen">${response}</ul><br>`); 
            
      //     }
      //   }
      //   return socket.emit("remote_cmd", `<ul>${response}</ul><br>`);
      // }
      // else if (event == "klog_cmd"){ //handle the commands from within the keylogger terminal (NEW unfinished)
      //   //commands for the keylogger window
      //   return socket.emit("klog_cmd", `<ul>${data_sanitized}</ul><br>`);
      // }
      else if (event == "cmd"){ // handle the commands from terminal (OLD, needs to be changed and removed)

          var cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
          var term = cmdSplit[0];                        //the command will be the first entity (0)
          var cmd =  cmdSplit[1];        //slice off the first item (1) to leave us with our command arg's
          var cmdargs = cmdSplit.slice(2);

        socket.emit(term, `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${data_sanitized}<p>`) //send a log to our user
        
        if(term == "local_cmd"){
            // let cmd, cmdargs = await commandParseCmd(userCommand) // parse the data and split into command / args
            //logi here for command.

            //Handle our command and args
            if(cmd == "create")                             {     response = await commands.create(socket.vps_hostip, socket.user_id, cmd, cmdargs);                                                                          }
            else if(cmd == "del")                           {     response = await commands.localdelete(socket.user_id, cmdargs);                                                                                  }
            else if(cmd == "upload")                        {     response = await commands.upload(socket.vps_hostip, socket.user_id, cmdargs, socket.vps_remoteip);                                                                  }
            else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
            else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.user_id, cmdargs);      socket.vps_remoteip = cmdargs; if(response.includes("Connected")){await socket.emit("cmd", "open");} } 
            else if(cmd == "disconnect")                    {     response = await commands.disconnect(socket.user_id, socket.vps_hostip);     socket.vps_remoteip = socket.vps_hostip ; await socket.emit("cmd", "close"); } 
            else if(cmd == "ls")                            {     response = await commands.localls(socket.user_id);                                                                                                   }
            else if(cmd == "crypto")                        {     response = await commands.crypto(socket.user_id);                                                                                                 }
            else if(cmd == "cls")                           {     await db.query(`UPDATE user_vps SET vps_history = ' ' WHERE user_id = ?`, [socket.user_id]); return socket.emit("cls", term);                                                                                                                  }
            else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
            else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

            //response = `[LOCAL] Command: '${cmd}'
            //Args: '${cmdargs}'`
            let connectedusers = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [socket.vps_hostip])
            for (var i=0;i<connectedusers.length;i++){
              console.log(connectedusers[i].vps_socket)
              console.log(connectedusers[i].vps_hostip)
              console.log(`id like to PM this log to ${connectedusers[i].vps_socket}`)
              io.to(connectedusers[i].vps_socket).emit("remote_cmd",`<p>${socket.user_name}@${socket.vps_hostip}:~$ ${data_sanitized}</p> <br> <ul>${response}</ul><br>`);
            }
            let history = `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${data_sanitized}</p> <ul>${response}</ul><br>`
            let oldHistory = await db.query(`SELECT vps_history FROM user_vps WHERE user_id = ?`, [history, socket.user_id])
            let newHistory = oldHistory[0].vps_history + 
            await db.query(`UPDATE user_vps SET vps_history = CONCAT(vps_history,?) WHERE user_id = ?`, [history, socket.user_id])
            socket.emit(term, `<ul>${response}</ul><br>`);
            socket.emit('remote_cmd', `<ul>${newHistory}</ul><br>`);
            
        }
        else if(term == "remote_cmd"){
            let remoteVps = await commands.userVps(socket.vps_remoteip)
            //Handle our command and args
            if(socket.vps_hostip == socket.vps_remoteip)    {     await socket.emit("cmd", "close");    socket.emit("local_cmd", `<ul>Remtoe host lost, disconnected.</ul><br>`);                   }
            else if(!remoteVps)                             {     response = `Connection to remote host lost`;  await commands.disconnect(socket.user_id, socket.vps_hostip);               }
            else if(cmd == "create")                        {     response = `ACCESS DENIED: Msising chron permissions to create '${cmdargs[0]}'`;                                                                          }
            else if(cmd == "del")                           {     response = await commands.remotedelete(socket.vps_remoteip, cmdargs[0]);                                                                                  }
            else if(cmd == "upload")                        {     response = `You cannot use that command here.`                                                                  }
            else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
            else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.user_id, cmdargs);      socket.vps_remoteip = cmdargs; if(response.includes("Connected")){await socket.emit("cmd", "open");} }
            else if(cmd == "disconnect")                    {     response = await commands.disconnect(socket.user_id, socket.vps_hostip);       socket.vps_remoteip = socket.vps_hostip ;   await socket.emit("cmd", "close");                      }
            else if(cmd == "ls")                            {     response = await commands.remotels(socket.user_id, socket.vps_hostip, socket.vps_remoteip);                                                                                                   }
            else if(cmd == "crypto")                        {     response = `ACCESS DENIED: Cannot request crypto from '${socket.vps_remoteip}' (yet)`                                                                                               }
            else if(cmd == "cls")                           {     return socket.emit("cls", term);                                                                                                                     }
            else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
            else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }

            //log the terminal command used to the database
            //await db.query(`INSERT log_terminal SET ?`, {user_id: socket.vps_hostid, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:socket.ip, log_terminal_response: response})

            socket.emit(term, `<ul>${response}</ul><br>`);
            
        }else{
          // let term, cmd, cmdargs = await commandParseCmd(userCommand) // parse the data and split into command / args
          //console.log("loc, cmd, arg", term, cmd, cmdargs)
        }
        
        
        // // //Handle our command and args
        // // if(cmd == "create")                             {     response = await commands.create(socket.ip, socket.id, cmd, cmd_args);                                                                          }
        // // else if(cmd == "del")                           {     response = await commands.delete(remoteIP, cmd_args[0]);                                                                                  }
        // // else if(cmd == "upload")                        {     response = await commands.upload(socket.ip, socket.id, cmd_args[0], remoteIP);                                                                  }
        // // else if(cmd == "help")                          {     response = await commands.help()                                                                                                          }
        // // else if(cmd == "connect" || (cmd == "-c"))      {     response = await commands.connect(socket.id, cmd_args[0]); await socket.join(cmd_args[0]);  socket.emit("cmd_remote", "open");               }
        // // else if(cmd == "disconnect")                    {     response = await commands.disconnect(socket.id, socket.ip);  socket.emit("cmd_remote", "close");                                                }
        // // else if(cmd == "ls")                            {     response = await commands.ls(remoteIP);                                                                                                   }
        // // else if(cmd == "crypto")                        {     response = await commands.crypto(socket.id);                                                                                                 }
        // // else if(cmd == "cls")                           {     response = "cls";                                                                                                                         }
        // // else if(cmd == "logout")                        {     response = "logout"; socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                                                   }
        // // else                                            {     response = `Command '${cmd}' does not exist`                                                                                              }


        // //log the terminal command used to the database
        // await db.query(`INSERT log_terminal SET ?`, {user_id: socket.user_id, log_terminal_command:data_sanitized, log_terminal_time:datetimestamp, log_terminal_ip:"testing", log_terminal_response: response})

        // //send response and keylogs
        // //get all users who have loggers on me
        // let loggerserror, loggers = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog' AND software_location = '${socket.id}'`)
        // //check we have a result
        // if (loggers[0]){ 
        //   //loop throught each result
        //   for(var i = 0;i<loggers.length; i++){
        //     var software_location = loggers[i].software_location;
        //     var software_creator = loggers[i].software_creator;
        //     //console.log("location", loggers[i].software_location)
        //     if(!(software_creator == software_location)){  //if the owner isnt yourself
        //       var keylogTarget = await db.query(`SELECT user_socket from users WHERE user_id = '${software_creator}'`)
        //       var keylogTarget = keylogTarget[0].user_socket
        //       //await socket.to(keylogTarget).emit("cmd_log",`<ul style="color:red">THIS IS KEYLOGGER: ${response}</ul><br>`); 
        //       //console.log(`${keylogTarget} needs to be sent the command ${data_sanitized}`)
        //       //console.log("joining room", keylogTarget, socket.rooms)
        //       io.to(keylogTarget).emit("key_log",`<p style="color:darkred">${socket.user_name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
        //       io.to(keylogTarget).emit("key_log",`<ul style="color:darkred">${response}</ul><br>`);
        //     }
        //   }
        //   //send commands to said people
        //   //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
        // }
        // //make an array to hold userids
        // var remoteUsers = await db.query(`SELECT user_socket, user_id from user_terminal WHERE terminal_connectedto = '${socket.vps_hostip}'`)
        // for(var i = 0;i<remoteUsers.length; i++){ //for each ID that is connected to my ip address.
        //   if(remoteUsers[i].user_socket == socket.id){}else{ 
        //     socket.to(remoteUsers[i].user_socket).emit("cmd_remote", "open");
        //     //console.log(`user connected to ${socket.id} is ${remoteUsers[i].user_id}`)//chekc to make sure its not our user.
        //     socket.to(remoteUsers[i].user_socket).emit("cmd_remote",`<p style="color:darkgreen">${socket.user_name}@${socket.ip}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
        //     socket.to(remoteUsers[i].user_socket).emit("cmd_remote",`<ul style="color:darkgreen">${response}</ul><br>`); 
            
        //   }
        // }
        // let cmd, cmdargs = await commandParse(userCommand) // parse the data and split into command / args
        //     //logi here for command.
        //     response = `[UNKNOWN]Command: ${cmd} Args: ${cmdargs}`
        // return socket.emit("local_cmd", `<ul>${response}</ul><br>`);
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
          WHERE user_id = '${socket.user_id}'
          ORDER BY log_terminal_id DESC LIMIT 50
      ) sub
      ORDER BY log_terminal_id ASC`)
      if(!cmdHistory[0]){
          console.log("No CMD history.")
      }else{
          
          var history;
          for(var i=0;i<cmdHistory.length;i++){
              history += `<p>${socket.user_name}@${cmdHistory[i].log_terminal_ip}:~$ ${cmdHistory[i].log_terminal_command}</p><p>${cmdHistory[i].log_terminal_response}</p>`
          }
          
          await socket.emit('local_cmd', history)   
      }
      }
      else if (event == "browser"){ //return a web browser page to the user
        data_sanitized = data_sanitized.replace(" ","");
        
        let pagedir = `/${__dirname}/websites/${data_sanitized}/${data_sanitized}.html`
        let cssdir = `/${__dirname}/websites/${data_sanitized}/${data_sanitized}.css`
        let jsdir = `/${__dirname}/websites/${data_sanitized}/${data_sanitized}.js`
        let errordir = `/${__dirname}/websites/404/404.html`
        var fs = require('fs').promises;
        try {
          let websitedata = await fs.readFile(pagedir, 'utf8');
          let cssdata = await  fs.readFile(cssdir, 'utf8');
          let jsdata = await  fs.readFile(jsdir, 'utf8');
          
          response = 
`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data_sanitized}</title>
    <style>${cssdata}</style>
    <script>${jsdata}</script>
</head>
<body>
    ${websitedata}
</body>
</html>
`
          //response = {html:websitedata, css:cssdata, js:jsdata}
          await socket.emit('browser', response)
          //console.log(response)
        } catch (error) {
          let errordir = `/${__dirname}/websites/404/404.html`
          let errorpage = await  fs.readFile(errordir, 'utf8');
          await socket.emit('browser', errorpage)
          //console.log(response);
        }     
      }
      else if (event == "frombrowser"){
        console.log("=============================================================")
        console.log("frombrowser data",data)
        console.log(`Key: ${data.key} Event: ${data.event} Data: ${data.data}`)
        let ip = data
        console.log(`ip is '${ip}' and is type ${ip.constructor}`)
        let somevarerr, somevar = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [ip])
        console.log("somevar",somevar)
        if (somevarerr){console.log(somevarerr)}else{
          for(i=0;i<somevar.length;i++){
            let usrsocket = somevar[i].vps_socket;
            let userip = somevar[i].vps_hostip
              console.log(`usersocket(${i}) ${usrsocket}`)
              let response = `<p>WEBSERVER@${ip}~$ CONNECTION ESTABLISHED: (${timestamp})</p>
                              [IP:${socket.vps_hostip}]<br>
                              [NAME:${socket.user_name}]<br>
                              [ISP: unidentified]<br>
` 

              io.to(usrsocket).emit('remote_cmd', response);
          }
        }
      }
      else if (event == "browser_redirect"){
        socket.emit("browser", data)
      }
      else if (event == "4.18.1.26"){
        socket.to(data).emit("local_cmd",`<ul><p>UNORTHARIZED ACTION: ${socket.ip} (${socket.user_name}) You have used the chat! broadcasting ip address....</p></ul>`); 
        //io.emit('chat', `${socket.user_name} IP: ${socket.ip}`) //broadcast the chat to all clients using the 'chat' channel
        // let randomColor = Math.floor(Math.random()*16777215).toString(16);
        let colourName = `<span style="color:#${randomColor};">${socket.user_name}</span>`
        messageString = `<small><small><i>(${timestamp.slice(0,5)})</i></small></small> <b>[${colourName}]</b> ${socket.user_name} IP: ${socket.ip}`
        return io.emit('chat', messageString) //broadcast the chat to all clients using the 'chat' channel
      }
      else if(event == "disconnect"){
        socket.emit('chat', `${socket.user_name} disconnected.`)
        clients.splice(clients.indexOf(client), 1);
      }
      else{ //Unauthoried event, log it.
        //END socket logic and return nothing
        return funcs.log(`[UNAUTHORIZED EVENT] ${logstring}`);
      }    
    });
}); //END SOCKETS

io.sockets.on('disconnect', function() {
  io.emit('chat', `${socket.user_name} disconnected.`)
  clients.splice(clients.indexOf(client), 1);
});

//START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});
console.log(`Server started on port ${port} ${__dirname}`);
