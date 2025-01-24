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

var admins = ["Drazard", "ADMIN", "Draz"]
//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)
    //get the ip address of our new connection
    let newConnIP = socket.handshake.address
    let newConnID = socket.id
    //get a list of all the connected clients
    //let socketclients = await io.allSockets()
    //clientArray = Array.from(socketclients)
    console.log(`NEW CLIENT TAB FROM SOCKET ${newConnID}`)
    //clients.push({"socketid":socket.id,"socketip":newConnIP})
    //console.log(`Connected Clients: `,clients)
    
    //Check sockets for duplicate users
    //disconnect all oldest sockets that share this account

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
    socket.key = Math.random().toString(36).substring(2) // gives the socket a unique random key (c1a7v2t6a7t)
    
    //getting the users vps stats
    let errorVps, userVps = await commands.vpsData(authUser.user_id);
    if(errorVps){
      console.log(errorVps)
      socket.emit("chat", "There is an error with your account, try re-verifiying")
    }
    //set the users vps stats
    try {
      socket.vps_hostip = userVps.vps_hostip
      socket.vps_remoteip = userVps.vps_remoteip
      socket.vps_socket = userVps.vps_socket
      socket.vps_cpu = userVps.vps_cpu
      socket.vps_ram = userVps.vps_ram
      socket.vps_hdd = userVps.vps_hdd
      socket.vps_network = userVps.vps_network
      socket.vps_power = userVps.vps_power
      socket.vps_history = userVps.vps_history
      socket.vps_proxy = userVps.vps_proxy
    } catch (error) {
      console.log(`ERROR: ${socket.user_name} account error!`)
    }
    

    clients.push({"username":socket.user_name,"ip":socket.irl_ip, "id":socket.id}); 
    console.log(`User: ${socket.user_name} Color: ${socket.chat_color} IP: ${socket.vps_hostip} connected to: ${socket.vps_remoteip} proxy: ${socket.vps_proxy} socket: ${socket.vps_socket} cpu: ${socket.vps_cpu} ram: ${socket.vps_ram} hdd: ${socket.vps_hdd}`)
    //announce when a  user joins, only if we didnt recently restart the server


    //check for duplicate sockets

    for (i of clients){
      
      //if the socket is NOT the same as our current socket, check the ip
      if (  (i['id'] != newConnID)   &&   (i['ip'] == newConnIP)  ){
        //if our current socket is not a match, check the ip address
        console.log(`CLIENT USERNAME: ${i['username']} CLIENT IP: ${i['ip']} CLIENT ID: ${i['id']} DISCONNECTED`)
        console.log(`NEW CLIENT SOCKET IS ${newConnID}`)
        //console.log(i,`Should be removed from clients array`)
        //socket.disconnect(`${i['id']}`); 
        //console.log("connections",io.allSockets())
        io.sockets.sockets.forEach(async (socket) => {
              // If given socket id is exist in list of all sockets, kill it
              if(socket.id === i['id'])
                  //await socket.emit("chat", `(${timestamp}) [ERROR-CODE: DualLogin] - disconnected`);  
                  socket.disconnect(true);

          });
          clients = clients.filter(function(item) {
            return item !== i
        })
        }else{
          console.log(`${i['id']} is the NEw user, do not disconnect.`)
        }
    }
    console.log("socket Clients:",clients)


    if(!serverRestart){
      io.emit('chat', `${socket.user_name} online.`)
      }
    
    var antiSpam = []; //declair an array of antiSpam to catch spammers
    setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.

    // let remoteVps = await commands.userVps(socket.vps_remoteip)
    // if(!remoteVps){
    //   await socket.emit("cmd", "close");
    //   // response = `Connection to remote host lost`;
    //   // socket.emit("local_cmd", `<ul>${response}</ul><br>`);
    //   await commands.disconnect(socket.user_id, socket.vps_hostip);
    // }
    // else if(socket.vps_hostip == socket.vps_remoteip){
    //   await socket.emit("cmd", "close");
    //   // response = `Connection to remote host lost`;
    //   // socket.emit("local_cmd", `<ul>${response}</ul><br>`);
    //   await commands.disconnect(socket.user_id, socket.vps_hostip);
    // }
    // else if(socket.vps_hostip == "NULL"){
    //   await socket.emit("cmd", "close");
    //   // response = `Connection to remote host lost`;
    //   // socket.emit("local_cmd", `<ul>${response}</ul><br>`);
    //   await commands.disconnect(socket.user_id, socket.vps_hostip);
    // }else{
    //   //await socket.emit("cmd", `!!open ${socket.vps_remoteip}`);
    // }
    
    setInterval( async () => {
      timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      //console.log(datetimestamp); //Log the time
      // var update = new Object();
      // update.time = timestamp;
      // socket.emit("gametick", update);
      let exampleKeylog = `
      <p style ="color:red">
      EXAMPLE: keylogger log<br>
      localhost@${funcs.randomIP()} connected to ${funcs.randomIP()}</p>
      `
      let exampleLog = `
      <p style ="color:limegreen">
      EXAMPLE: normal log<br>
      localhost@${funcs.randomIP()} connected to ${funcs.randomIP()}</p>
      `
      await socket.emit("keylog", exampleKeylog);
      await socket.emit("log", exampleLog);
    }, funcs.randomIntB(1000,20000));



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
                //sliceamount = (chatHistory[i].log_chat_time.length - 10, chatHistory[i].log_chat_time.length - 2)
                history += `<small><small><i>(${chatHistory[i].log_chat_time})</i></small></small> [${chatHistory[i].log_chat_username}] ${chatHistory[i].log_chat_message}<br>`
            }
            await socket.emit('chat', history)   
        }
    
    socket.onAny( async (event, data) => { //When we get any emit  (on any)

         //Set TimeStamps
        timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); //console.log(timestamp); //Timestamp (2:19:30 am)
        datestamp = new Date().toLocaleDateString(); //console.log(datestamp) // Datestamp (17/02/2021)
        datetimestamp = new Date().toLocaleString(); //console.log(datetimestamp) // Datestamp (17/02/2021, 2:19:30 am)

        logstring = `
        [TIME: ${datetimestamp}]
        [EVENT: ${event}] 
        [CLIENT: ${socket.user_name} ${socket.geolocation}]
        [DATA: ${JSON.stringify(data)}]
        `
        console.log(logstring) //log the data incase we fuck somehting up.

        if(typeof data != "object"){
          data_sanitized = data         //Sanitize the data so we dont get shafted.
            .replace(/&/g, '&amp;')   //Remove &
            .replace(/</g, '&lt;')    //Remove <
            .replace(/>/g, '&gt;')    //Remove >
            .replace(/"/g, '&quot;')  //Remove " 
            .replace(/'/g, '&#039;')  //Remove '

            if (data_sanitized.length > 500){
              data_sanitized = `${data_sanitized.substring(0, 500)}...`
            } 
        }     

      let authUser = await commands.authUser(socket.cookies)                                        //run function to check if the user matches a real user

      //ANTI SPAM
      var spamCount = {};                                                            //set the spamcount to nothing.
      if (!admins.includes(authUser.user_name)){
        await antiSpam.push(socket.id)           
      }                                       //add a count to our array (this can be improved on)
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

      if(tooMuchSpam > 4){ //Check we havent spammed too hard.
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
      

      if (event == "chat"){ //parse and handle users chat messages and chat commands (chat commands not implemented yet)

        //they wanted colored names........ fuckem.
        var randomColor = Math.floor(Math.random()*16777215).toString(16);                   //create a random color hex code
        var colourName = `<span style="color:${socket.chat_color};">${socket.user_name}</span>`   //set the user's colorname

        //LOG CHAT
        await db.query('INSERT log_chat SET ?', { user_id:socket.user_id, log_chat_time: timestamp, log_chat_username: colourName, log_chat_message:data_sanitized}, (error, results) => {
          //console.log("Backing up chat to db")
          if(error){
              console.log(error);return console.log("ERROR ADDINS CHATHISTORY")
          }             
        });

        //PARSE IMGUR LINKS
        if(data.startsWith("https://i.imgur.com/")){
          data_sanitized = `<li>${data}<br><img src='${data}'  style="border:5px solid black; max-height:200px; max-width:100%"></li>`
        }
        
        //ADMIN COMMANDS
        if(data.startsWith("!")){
          function commandParse(data){
            cmdSplit = data.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
            cmd = cmdSplit[0];                        //the command will be the first entity (0)
            cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
            return cmd, cmd_args
          }
          if(admins.includes(socket.user_name)){
            var cmd, cmdargs = await commandParse(data) // parse the data and split into command / args
            switch(cmd){
              case "!ban":
                let banuser = cmdargs[0];
                let banseconds = eval(cmdargs[1])
                try {
                  eval(cmdargs[1])
                } catch (error) {
                  return socket.emit('chat', `<p style="color:orange">'${banseconds}' isnt a valid time dumbass...</p>`)
                }
                io.emit('chat', `<p style="color:red">[SYSTEM] ${banuser} banned for ${banseconds} seconds by by ${socket.user_name}.<p>`)  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                await db.query(`UPDATE users SET user_banned = '1' WHERE user_name = '${banuser}'`)
                //io.to(socket.id).emit("redirect", `https://connflict.com:3000/auth/logout`);
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
                let unbanuser = cmdargs[0]
                io.emit('chat', `<p style="color:green">[SYSTEM] ${unbanuser} has been unbanned by ${socket.user_name}... (plznospam)<p>`) //let everyone know they are back.  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                await db.query(`UPDATE users SET user_banned = '0' WHERE user_name = '${unbanuser}'`)
              break;
              case "!refresh":
                io.emit('redirect', `https://connflict.com:3000/`)
              break;
              case "!online":
                //console.log(clients)
                for (let index = 0; index < clients.length; index++) {
                  const element = clients[index].username;
                  io.to(socket.id).emit("chat",`<ul><p>${element}</p></ul>`); 
                }
                //io.to(socket.id).emit("chat",`<ul><p>${element}</p></ul>`); 
              break;
              case "!kick":
                //io.to(socket.user_name).emit("redirect", `https://connflict.com:3000/auth/logout`);
                setTimeout(() => { io.emit('chat', `<p style="color:red">[SYSTEM] ${cmd_args[0]} has been kicked`)  }, 500);
              break;
              case "!term":
                await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
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

        //Broadcast the chat message to everyone in chat as well as ourselves on a succesfull database entry
        
        messageString = `<small><small><i>(${timestamp})</i></small></small> [${colourName}] ${data_sanitized}`
        return io.emit('chat', messageString) //broadcast the chat to all clients using the 'chat' channel
        
        
      }
      if (event == "process"){

        //getting the users vps stats
        let errorVps, userVps = await db.query(`SELECT * FROM user_vps WHERE user_id = '${socket.user_id}'`)
        if(errorVps){
          console.log(errorVps)
          return socket.emit("chat", "There is an error with your account, try re-verifiying")
        }
        //set the users vps stats
        userVps = userVps[0]
        try {
          socket.vps_hostip = userVps.vps_hostip
          socket.vps_remoteip = userVps.vps_remoteip
          socket.vps_socket = userVps.vps_socket
          socket.vps_cpu = userVps.vps_cpu
          socket.vps_ram = userVps.vps_ram
          socket.vps_hdd = userVps.vps_hdd
          socket.vps_network = userVps.vps_network
          socket.vps_power = userVps.vps_power
          socket.vps_history = userVps.vps_history
          socket.vps_proxy = userVps.vps_proxy
          socket.terminalbusy = userVps.terminalbusy
        } catch (error) {
          console.log(`ERROR: ${socket.user_name} account error! (IN COMMANDS)`)
        }
        
        //check we havent already got a task
        if (socket.terminalbusy == 1){
          if (data.command == "temppage"){
            console.log(`${socket.user_name} has just refreshed the page, dont ban.`)
          }else{
            console.log("TERMINAL BUSY FROM USER",socket.user_name)

          console.log(`i should ban ${socket.user_name} for attempting ${data.command}`)
          templog = `${socket.user_name} - ${data.command}`
          await db.query(`INSERT templog SET log = ?`, [templog]);
          //double check we have a task running
          //check user isnt a bot, give a warning
          
          }
          return
        }
        //set the terminal to busy
        
        //send socket to client to not accept any more commands?

        //begin parsing the CMD and args

        cmd = data.command        //sanitize
        .replace(/&/g, '&amp;')   //Remove &
        .replace(/</g, '&lt;')    //Remove <
        .replace(/>/g, '&gt;')    //Remove >
        .replace(/"/g, '&quot;')  //Remove " 
        .replace(/'/g, '&#039;')  //Remove '
        term = data.terminal      //sanitize
        .replace(/&/g, '&amp;')   //Remove &
        .replace(/</g, '&lt;')    //Remove <
        .replace(/>/g, '&gt;')    //Remove >
        .replace(/"/g, '&quot;')  //Remove " 
        .replace(/'/g, '&#039;')  //Remove '       

        //console log this so we get it right
        console.log(`${socket.user_name} Used command: ${cmd} Sent to: ${data.terminal}`);

        
        if (cmd.length > 300){
          await socket.emit("cmd", `<p>${socket.user_name}@${socket.vps_hostip}:~$ CMD invalid<p>`) //send a log to our user
          await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
          await io.to(socket.id).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
          return
        }
        var cmdSplit = data.command.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas                      //the command will be the first entity (0)
        cmd =  cmdSplit[0];        //slice off the first item (1) to leave us with our command arg's
        args = cmdSplit.slice(1);
        //if (args.length < 1){args = "null"}
        //console.log(`${socket.user_name}'s Commmand: [${cmd}] With Args: [${args}]`)

        //Relay to our user the command they entered
        await socket.emit("cmd", `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd} ${args}<p>`) //send a log to our user

        //check the command exists
        // let commands = ["help", "ip"]
        // if (commands.includes(cmd) == false){
        //   await io.to(socket.id).emit("processwaiting",`executing command '${cmd}' ....`)
        //   setTimeout( async () => {
        //     socket.emit("cmd", `<p>Command '${cmd}' Does not exist try using 'help' <p>`) //send a log to our user
        //     await socket.emit("unfreezecmd", `Unfreeze the terminal`); //let the user use their temrinal again
        //     await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
        //     await io.to(socket.id).emit("processwaiting",` `)
        //   }, 5000);
        //   return
        // }

        await db.query(`UPDATE user_vps SET terminalbusy = 1 WHERE user_id = ?`, [socket.user_id]);


        ///handle commands
        let usererror, usersucc = await  db.query(`SELECT * FROM users WHERE user_id = ?`, [socket.user_id])
        if(usererror){ 
          await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
          await io.to(socket.user_id).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
          return console.log("ERROR FETCHING USERDATA FOR COMMAND")}
        if (!usersucc[0]){
          await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
          await io.to(socket.user_id).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
          return console.log("ERROR USERDATA NOT FOUND")}
        let cmderror, cmdsuccess = await  db.query(`SELECT * FROM commands WHERE cmd = ?`, [cmd])
        if (cmderror){ 
          await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
          await io.to(socket.user_id).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
          return console.log("ERROR FETCHING COMMANDS")}
        if (!cmdsuccess[0]){
          await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
          await io.to(socket.id).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
          return console.log("ERROR COMMAND NOT FOUND",cmd, cmdsuccess)}

        let user_id = usersucc[0].user_id;
        let cmdcommand = cmdsuccess[0].cmd
        let cmdDesc = cmdsuccess[0].description
        let costtime = cmdsuccess[0].costtime

        console.log(`costtime is `,costtime)
        console.log("currenttime",Math.floor(Date.now() / 1000))
        //get the information of the users from database
        let currentTimeInt = Math.floor(Date.now() / 1000) + costtime
        // let userdata = await commands.vpsData(socket.user_id)
        // let localip = userdata.vps_hostip
        // let remoteip = userdata.vps_remoteip
        // let proxyip = userdata.vps_proxy
        

        await io.to(socket.id).emit("processwaiting",`${cmd}ing ....`)
        //send command to the table
        await db.query(`INSERT processes SET ?`, {user_id: socket.user_id, command:`${cmd}`, arguments:`${args}`, time:currentTimeInt, localip:socket.vps_hostip, remoteip:socket.vps_remoteip, proxyip:socket.vps_proxy, socket_id:socket.id})  



        //check that there is a command in the commands table
        //if the command exists, lock users terminal and set terminal busy to 1

        //fetch instructions commands table
        //fetch response from commands table
        //fetch command delay time
        //fetch commands cpu cost

        //return response to user

        //begin the timer in terminal

        // setTimeout( async () => {
        //   await socket.emit("cmd", `
        //   (SORRY) Terminal is undergoing maitenence<br>
        //   `);
        //   await socket.emit("unfreezecmd", `Unfreeze the terminal`);
        //   socket.terminalBusy = false;
        // }, 2000);
        
        
      }
      else if (event == "cmd"){ // handle the commands from terminal (OLD, needs to be changed and removed)

        //check we havent already got a task
        //if we have a task, do nothing


        //begin parsing the CMD and args

        cmd = data.command        //sanitize
        .replace(/&/g, '&amp;')   //Remove &
        .replace(/</g, '&lt;')    //Remove <
        .replace(/>/g, '&gt;')    //Remove >
        .replace(/"/g, '&quot;')  //Remove " 
        .replace(/'/g, '&#039;')  //Remove '
        term = data.terminal      //sanitize
        .replace(/&/g, '&amp;')   //Remove &
        .replace(/</g, '&lt;')    //Remove <
        .replace(/>/g, '&gt;')    //Remove >
        .replace(/"/g, '&quot;')  //Remove " 
        .replace(/'/g, '&#039;')  //Remove '       

        //console log this so we get it right
        //console.log(`${socket.user_name} Used command: ${cmd} Sent to: ${data.terminal}`);

        
        if (cmd.length > 100){
          await socket.emit("cmd", `<p>${socket.user_name}@${socket.vps_hostip}:~$ CMD invalid, stop flooding terminal.<p>`) //send a log to our user
          return
        }

        var cmdSplit = data.command.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas                      //the command will be the first entity (0)
        cmd =  cmdSplit[0];        //slice off the first item (1) to leave us with our command arg's
        args = cmdSplit.slice(1);
        console.log(`${socket.user_name}'s Commmand: [${cmd}] With Args: [${args}]`)

        //send the command to the process table.
        
        var response;
        
        if(term == "local"){
          //send users command back to them to prove it worked.
          socket.emit("local_cmd", `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd} ${args}<p>`) //send a log to our user

          let remoteVps = await commands.userVps(socket.vps_remoteip)
          if(!remoteVps){
            await socket.emit("cmd", "close");
            response = `Connection to remote host lost`;
            socket.emit("local_cmd", `<ul>${response}</ul><br>`);
            await commands.disconnect(socket.user_id, socket.vps_hostip);
          }
          else if(socket.vps_hostip == socket.vps_remoteip){
            await socket.emit("cmd", "close");
            response = `Connection to remote host lost`;
            socket.emit("local_cmd", `<ul>${response}</ul><br>`);
            await commands.disconnect(socket.user_id, socket.vps_hostip);
          }
          else if(socket.vps_hostip == "NULL"){
            await socket.emit("cmd", "close");
            response = `Connection to remote host lost`;
            socket.emit("local_cmd", `<ul>${response}</ul><br>`);
            await commands.disconnect(socket.user_id, socket.vps_hostip);
          }else{
            //await socket.emit("cmd", `!!open ${socket.vps_remoteip}`);
          }

          switch(cmd){
            case "create":
              response = await commands.create(socket.vps_hostip, socket.user_id, cmd, args);
              break;

            case "del":
            case "delete":
              response = await commands.localdelete(socket.user_id, args);
              break;

            case "upload":
              response = await commands.upload(socket.vps_hostip, socket.user_id, args, socket.vps_remoteip);
              break;

            case "help":
              response = await commands.help()
              break;

            case "connect":
              if(socket.vps_hostip == args[0]){
                response = `LOL NICE TRY ${socket.user_name.toUpperCase()}!!  ...you cant connect to yourself...`
              }else{
                connect = await commands.connect(socket.user_id, args);
                if(connect.result = "success"){
                  socket.vps_remoteip = args;
                  let remoteHistory = await db.query(`SELECT vps_history FROM user_vps WHERE vps_hostip = ?`, [args])
                  await socket.emit("remote_cmd", remoteHistory[0].vps_history)
                  //await socket.emit("cmd", `!!open ${socket.vps_remoteip}`);
                  response = connect.data;
                }else{
                  response = connect.data;
                }
              }
              break;

            case "disconnect":
              response = await commands.disconnect(socket.user_id);
              await socket.emit("cmd", "close");
              await socket.emit("local_cmd", "Remote conneciton Lost");
              socket.vps_remoteip = 'NULL';
            break;

            case "ls":
              response = await commands.localls(socket.user_id);
            break;

            case "crypto":
              response = await commands.crypto(socket.user_id);
            break;

            case "cls":
              await db.query(`UPDATE user_vps SET vps_history = ' ' WHERE user_id = ?`, [socket.user_id]);
              return socket.emit("cls", "local_cmd");
            break;

            case "logout":
              response = "logout";
              socket.emit("redirect", `https://connflict.com:3000/auth/logout`);
              socket.disconnect(); 
            break;

            case "proxy":
              response = await commands.proxy(args[0], socket.user_id);
              if(response.includes("SUCCESS:")){
                socket.vps_proxy = args[0]
              }
              
            break;

            default:
              response = `Command ${cmd} does not exist` 
            break;

          }

          //send a log to the database
          await db.query(`INSERT log_terminal SET ?`, {user_id: socket.user_id, log_terminal_command:`${cmdSplit}`,log_terminal_ip:socket.vps_remoteip, log_terminal_response:response, log_terminal_time:`${datetimestamp}`})  

          //send the command to the process database


          //Send the response from our commands to the user
          socket.emit("local_cmd", `<ul>${response}</ul><br>`);
          //putting the command and response into a nice string for anybody connected
          let connectedusers = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [socket.vps_hostip])
            for (var i=0;i<connectedusers.length;i++){
            io.to(connectedusers[i].vps_socket).emit("remote_cmd",`<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd} ${args}</p> <ul>${response}</ul><br>`);
          }
          
          //Send the command + response from our commands to anyone connected to us.
          // let connectedusers = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [socket.vps_hostip])
          // for (var i=0;i<connectedusers.length;i++){
          //   io.to(connectedusers[i].vps_socket).emit("remote_cmd",remoteLog);
          // }

          //get all users who have loggers on me
          let loggerserror, loggers = await db.query(`SELECT creator_ip,software_location,software_creator from gamesoftware WHERE software_type = 'klog' AND software_location = ?`,[socket.user_id])
          console.log("loggers results",loggers)
          //check we have a result
          if (loggers[0]){ 
            console.log("We have loggers")
            //loop throught each result
            for(var i = 0;i<loggers.length; i++){
              var software_location = loggers[i].software_location;
              var software_creator = loggers[i].software_creator;
              //console.log("location", loggers[i].software_location)
              //console.log("keyloggers:",software_creator, software_location)
              //console.log("keyloggers:",loggers[i].software_creator, loggers[i].software_creator)
              if(!(software_creator == software_location)){  //if the owner isnt yourself
                var keylogTarget = await db.query(`SELECT vps_socket from user_vps WHERE user_id = ?`, [software_creator])
                var keylogTargetdest = keylogTarget[0].vps_socket
                //console.log("keylogdest",keylogTargetdest)
                response = `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd} ${args}</p><ul>${response}</ul><br>`
                //console.log(`${keylogTargetdest} needs to be sent the command ${response}`)
                //console.log("joining room", keylogTarget, socket.rooms)
                command = {terminal:"keylog", command: response}
                io.to(keylogTargetdest).emit("keylog",command) //send an emit to everyone connected (will need to change this?)
              }else{
                console.log("KEylogger on self", )
              }
            }
            //send commands to said people
            //socket.in(keyloggerGroup).emit("cmd_log",`<p style="color:darkgreen">${socket.name}@${hostIP}:~$ ${data_sanitized}</p>`) //send an emit to everyone connected (will need to change this?)
          }else{
            console.log("We DO NOT have loggers")
          }

          //Getting the command history from our user
          let oldHistory = await db.query(`SELECT vps_history FROM user_vps WHERE user_id = ?`, [socket.user_id])

          //Joining the command we just submitted a the end of the command history and sending it back
          let newHistory = oldHistory[0].vps_history + `<p>${response}</p>`
          await db.query(`UPDATE user_vps SET vps_history = ? WHERE user_id = ?`, [newHistory, socket.user_id])
          
          //submitting the new data to the remote window for some reason? why the fuck was this here?
          //socket.emit('remote_cmd', `<ul>${newHistory}</ul><br>`);
            
        }
        else if(term == "remote"){
          
          let remoteVps = await commands.userVps(socket.vps_remoteip)
          if(!remoteVps){
            await socket.emit("cmd", "close");
            response = `Connection to remote host lost`;
            socket.emit("local_cmd", `<ul>${response}</ul><br>`);
            await commands.disconnect(socket.user_id, socket.vps_hostip);
          }
          else if(socket.vps_hostip == socket.vps_remoteip){
            await socket.emit("cmd", "close");
            response = `Connection to remote host lost`;
            socket.emit("local_cmd", `<ul>${response}</ul><br>`);
            await commands.disconnect(socket.user_id, socket.vps_hostip);
          }
          else if(socket.vps_hostip == "NULL"){
            await socket.emit("cmd", "close");
            response = `Connection to remote host lost`;
            socket.emit("local_cmd", `<ul>${response}</ul><br>`);
            await commands.disconnect(socket.user_id, socket.vps_hostip);
          }else{
            //await socket.emit("cmd", `!!open ${socket.vps_remoteip}`);
          }
          switch(cmd){
            case "disconnect":
              response = await commands.disconnect(socket.user_id, socket.vps_hostip);
              socket.vps_remoteip = "NULL";
              await socket.emit("cmd", "close");
            break;

            case "ls":
              response = await commands.remotels(socket.user_id, socket.vps_hostip, socket.vps_remoteip);
            break;

            case "del":
              response = await commands.remotedelete(socket.vps_remoteip, args[0]);
            break;

            default:
              response = `ACCESS DENIED: Command '${cmd} rejected from ${socket.vps_remoteip}'`  
            break;
          
          }
            socket.emit("remote_cmd", `<ul>${response}</ul><br>`);
            if(socket.vps_proxy){
              console.log(`Proxy server: ${socket.vps_proxy}`)
              //send the log to our proxy
              let connectedusersproxy = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [socket.vps_proxy])
              for (var i=0;i<connectedusersproxy.length;i++){
                io.to(connectedusersproxy[i].vps_socket).emit("remote_cmd",`<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd} ${args}</p> <ul>${response}</ul><br>`);
              }
  
              //send the fake log to connected
              let connectedusers = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [socket.vps_remoteip])
              for (var i=0;i<connectedusers.length;i++){
                io.to(connectedusers[i].vps_socket).emit("remote_cmd",`<p>${socket.user_name}@${socket.vps_proxy}:~$ ${cmd} ${args}</p> <ul>${response}</ul><br>`);
              }
  
            }else{
              let connectedusers = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [socket.vps_remoteip])
              for (var i=0;i<connectedusers.length;i++){
                io.to(connectedusers[i].vps_socket).emit("remote_cmd",`<p>${socket.user_name}@${socket.vps_proxy}:~$ ${cmd} ${args}</p> <ul>${response}</ul><br>`);
              }
            }


        }else if(term == "keylog"){
          await socket.emit("keylog", data);
        }
      }
      else if (event == "chathistory2"){ //get the last 50 lines of chat history for the suer
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
                //sliceamount = (chatHistory[i].log_chat_time.length - 10, chatHistory[i].log_chat_time.length - 2)
                history += `<small><small><i>(${chatHistory[i].log_chat_time})</i></small></small> [${chatHistory[i].log_chat_username}] ${chatHistory[i].log_chat_message}<br>`
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
      else if (event == "requestpage"){ //return a web browser page to the user
        
        data_sanitized = data_sanitized.replace(" ","");
        
        let pagedir = `/${__dirname}/websites/${data_sanitized}/${data_sanitized}.html`
        let cssdir = `/${__dirname}/websites/${data_sanitized}/${data_sanitized}.css`
        let jsdir = `/${__dirname}/websites/${data_sanitized}/${data_sanitized}.js`
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
          await socket.emit('servepage', response)
          //console.log(response)
        } catch (error) {
          let errordir = `/${__dirname}/websites/404/404.html`
          let errorpage = await  fs.readFile(errordir, 'utf8');
          await socket.emit('servepage', errorpage)
          //console.log(response);
        }     
      }
      else if (event == "frombrowser"){
        if(socket.vps_proxy){
          var visitor = socket.vps_proxy
          console.log(`Browser see's proxy: ${visitor}`)
        }else{
          var visitor = socket.vps_hostip
          console.log(`Browser see's real IP: ${visitor}`)
        }
        console.log("===========================BROWSER==================================")
        //console.log("frombrowser data",data)
        //console.log(`Key: ${data.key} Event: ${data.event} Data: ${data.data}`)
        let ip = data
        //console.log(`ip is '${ip}' and is type ${ip.constructor}`)
        let somevarerr, somevar = await db.query(`SELECT vps_socket, vps_hostip FROM user_vps WHERE vps_remoteip = ?`, [ip])
        //console.log("somevar",somevar)
        if (somevarerr){console.log(somevarerr)}else{
          for(i=0;i<somevar.length;i++){
            let usrsocket = somevar[i].vps_socket;
            let userip = somevar[i].vps_hostip
              //console.log(`usersocket(${i}) ${usrsocket}`)

              let response = `<p>WEBSERVER@${ip}~$ CONNECTION ESTABLISHED: (${timestamp})</p>
                              [IP:${visitor}]<br>
                              [NAME:${socket.user_name}]<br>
                              [ISP: unidentified]<br>
` 

              io.to(usrsocket).emit('remote_cmd', response);
          }
        }
      }
      else if (event == "browser_redirect"){
        socket.emit("browserresponse", data)
      }
      else if (event == "4.18.1.26"){
        socket.to(data).emit("local_cmd",`<ul><p>UNORTHARIZED ACTION: ${socket.ip} (${socket.user_name}) You have used the chat! broadcasting ip address....</p></ul>`); 
        //io.emit('chat', `${socket.user_name} IP: ${socket.ip}`) //broadcast the chat to all clients using the 'chat' channel
        // let randomColor = Math.floor(Math.random()*16777215).toString(16);
        let colourName = `<span style="color:#${randomColor};">${socket.user_name}</span>`
        messageString = `<small><small><i>(${timestamp})</i></small></small> [${colourName}] ${socket.user_name} IP: ${socket.ip}`
        return socket.emit('chat', messageString) //broadcast the chat to all clients using the 'chat' channel
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

    //generate a new key for the socket.
    socket.key = Math.random().toString(36).substring(2) // gives the socket a unique random key (c1a7v2t6a7t)

    socket.on('disconnect', function() {
      console.log(`${socket.user_name} has disconnected.`)
      io.emit('chat', `${socket.user_name} has disconnected.`)
      //remove client from client list

      // clients.splice(clients.indexOf(client), 1);
    });

}); //END SOCKETS

//START CMD ENGINE

setInterval( async () => {
  let processError, process = await db.query(`SELECT * FROM processes`)  
  if(processError){
    return console.log(processError)
  }
  for(var i = 0;i<process.length; i++){
    let processid = process[i].process_id
    let userid = process[i].user_id
    let command = process[i].command
    let args = process[i].arguments
    let processtime = process[i].time
    let localip = process[i].localip
    let remoteip = process[i].remoteip
    let proxyip = process[i].proxyip

    let socketupdateError, socketupdateSucc = await db.query(`SELECT vps_socket FROM user_vps WHERE user_id = ?`, [userid]);
    let socketid = socketupdateSucc[0].vps_socket
    process[i].socketid = socketid
    process[i].arguments = args.split(",");
    let currenttime = Math.floor(Date.now() / 1000)
    let timeleft = processtime - currenttime 
    if (currenttime > processtime){
      await io.to(socketid).emit("processwaiting",` `)

      //Complete the process
      completeProcess(process[i])
      
      //socket.emit("cmd", `${command} process completed.`)
      await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [userid]);
      await db.query(`DELETE FROM processes WHERE process_id = ?`, [processid]); 
    }else{
      await io.to(socketid).emit("processwaiting",` executing command '${command}' .... (${timeleft})`)
    }   
  }
  //console.log(processSuccess)
}, 1000);

//complete processes

async function completeProcess(process){
  console.log(`Completing process`, process.command)
  commandHandler(process.command, process.arguments, process.user_id)
  switch (process.command) {
    case "help":
        //send help
        await io.to(process.socketid).emit("cmd",`<p style="color:yellow">${process.command}: <br>The game is currently in Alpha 1.1, gameplay is subject to change and/or break!<br><br> Avalible commands: <br> Help<br> ip <br> ls <br>  ddos <br>  pcstatus <br> logout <p>`) //send an emit to socket
      break;

    case "ip":
      await io.to(process.socketid).emit("cmd",` Your ${process.command} is: TBA`) //send an emit to socket
    break;

    case "ls":
      await io.to(process.socketid).emit("cmd",` You Dont have any files`) //send an emit to socket
    break;

    case "ddos":
      if (process.arguments.length >= 1){
        await io.to(process.socketid).emit("cmd",`DDOS SENT TO '${process.arguments[0]}' for ${funcs.randomIntB(100,10000)}MHz damage!`) //send an emit to socket
        //start a ddos for X seconds.
      }else{
        console.log("args length",process.arguments.length)
        await io.to(process.socketid).emit("cmd",`ERROR: '${process.command}' requires 1 args (ddos target)`) //send an emit to socket
      }      
    break;

    case "pcstatus":
      await io.to(process.socketid).emit("cmd",` PCSTATUS:<br>Online`) //send an emit to socket
    break;

    case "logout":
      await io.to(process.socketid).emit("cmd",` Logging out`) //send an emit to socket
      await io.to(process.socketid).emit("redirect",`https://connflict.com:3000/auth/logout`) //send an emit to socket
    break;

    default:
      await io.to(process.socketid).emit("cmd",`Command '${process.command}' Not Found.`) //send an emit to socket
      break;
  }
      console.log("Giving back the temrinal to :",process.user_id)
      await io.to(process.socketid).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
}

async function commandHandler(command, cmdarguments, userid){
  ///handle commands
  let usererror, usersucc = await  db.query(`SELECT * FROM users WHERE user_id = ?`, [userid])
  if(usererror){ return console.log("ERROR FETCHING USERDATA FOR COMMAND")}
  if (!usersucc[0]){return console.log("ERROR USERDATA NOT FOUND")}
  let cmderror, cmdsuccess = await  db.query(`SELECT * FROM commands WHERE cmd = ?`, [command])
  if (cmderror){ return console.log("ERROR FETCHING COMMANDS")}
  if (!cmdsuccess[0]){return console.log("ERROR COMMAND NOT FOUND",command, cmdsuccess)}

  let user_id = usersucc[0].user_id;
  let cmdcommand = cmdsuccess[0].cmd
  let cmdDesc = cmdsuccess[0].description
  console.log("userid sent command",user_id,cmdcommand,cmdDesc)
}
//START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});
console.log(`Server started on port ${port} ${__dirname}`);
