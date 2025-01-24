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

var admins = ["ADMIN", "Draz"]
db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `Server Restarted.`})
var antiSpam = []; //declair an array of antiSpam to catch spammers
setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.

//un-chatban everyone
db.query(`UPDATE users SET user_chatbanned = '0'`)
//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)
    //get the ip address of our new connection
    let newConnIP = socket.handshake.address
    let newConnID = socket.id
    //get a list of all the connected clients
    //let socketclients = await io.allSockets()
    //clientArray = Array.from(socketclients)
    //console.log(`NEW CLIENT TAB FROM SOCKET ${newConnID}`)
    //clients.push({"socketid":socket.id,"socketip":newConnIP})
    //console.log(`Connected Clients: `,clients)
    
    //Check sockets for duplicate users
    //disconnect all oldest sockets that share this account

    //console.log(socket.rooms)
    let cookies = cookie.parse(socket.request.headers.cookie || ''); //Get cookies from request headers
    socket.cookies = cookies.draz                                     //Turn cookies into a managable string
    let authUser = await commands.authUser(socket.cookies)                //return userdata if the user exists that matches the cookies
    console.log("SOCKET COOKIES",socket.cookies)
    console.log("authUSER",authUser)
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

    //setup our user socket with data
    socket.user_name = authUser.user_name;  //set name
    socket.user_id = authUser.user_id;  //set userid
    socket.chat_color = authUser.chat_color
    socket.chatbanned = authUser.user_chatbanned
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
    //console.log(`User: ${socket.user_name} Color: ${socket.chat_color} IP: ${socket.vps_hostip} connected to: ${socket.vps_remoteip} proxy: ${socket.vps_proxy} socket: ${socket.vps_socket} cpu: ${socket.vps_cpu} ram: ${socket.vps_ram} hdd: ${socket.vps_hdd}`)
    //announce when a  user joins, only if we didnt recently restart the server

    console.log(socket.user_name, "connected")
    //check for duplicate sockets

    for (i of clients){
      
      //if the socket is NOT the same as our current socket, check the ip
      if (  (i['id'] != newConnID)   &&   (i['ip'] == newConnIP)  ){
        //if our current socket is not a match, check the ip address
        //console.log(`CLIENT USERNAME: ${i['username']} CLIENT IP: ${i['ip']} CLIENT ID: ${i['id']} DISCONNECTED`)
        //console.log(`NEW CLIENT SOCKET IS ${newConnID}`)
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
          //console.log(`${i['id']} is the NEw user, do not disconnect.`)
        }
    }
    //console.log("socket Clients:",clients)


    if(!serverRestart){
      io.emit('chat', `${socket.user_name} online.`)
      }
    
    var antiSpam = []; //declair an array of antiSpam to catch spammers
    setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.

    // let remoteVps = await commands.userVps(socket.vps_remoteip)
    // if(!remoteVps){
    //   await socket.emit("terminal", "close");
    //   // response = `Connection to remote host lost`;
    //   // socket.emit("local_cmd", `<ul>${response}</ul><br>`);
    //   await commands.disconnect(socket.user_id, socket.vps_hostip);
    // }
    // else if(socket.vps_hostip == socket.vps_remoteip){
    //   await socket.emit("terminal", "close");
    //   // response = `Connection to remote host lost`;
    //   // socket.emit("local_cmd", `<ul>${response}</ul><br>`);
    //   await commands.disconnect(socket.user_id, socket.vps_hostip);
    // }
    // else if(socket.vps_hostip == "NULL"){
    //   await socket.emit("terminal", "close");
    //   // response = `Connection to remote host lost`;
    //   // socket.emit("local_cmd", `<ul>${response}</ul><br>`);
    //   await commands.disconnect(socket.user_id, socket.vps_hostip);
    // }else{
    //   //await socket.emit("terminal", `!!open ${socket.vps_remoteip}`);
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
      await socket.emit("log", exampleKeylog);
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
        console.log(`${socket.user_name} (${event}) ${JSON.stringify(data)}`)
        
        switch (event) {
            case 'chat':
                await db.query(`INSERT sockethandler SET ?`, {user_id:socket.user_id, event: event, data: JSON.stringify(data)})
                break;
            case 'process':
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
                            //await socket.emit("terminal", `<p>${socket.user_name}@${socket.vps_hostip}:~$ Terminal busy...<p>`) //send a log to our user
                            let processError, process = await db.query(`SELECT * FROM processes WHERE user_id = ${socket.user_id}`)  
                            let currenttime = Math.floor(Date.now() / 1000)
                            let timeleft = process[0].time - currenttime 
                            await socket.emit("terminal", `<p>${socket.user_name}@${socket.vps_hostip}:~$ Terminal busy (${timeleft}) secs remaining on ${process[0].command} command<p>`) //send a log to our user 
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
                          await socket.emit("terminal", `<p>${socket.user_name}@${socket.vps_hostip}:~$ CMD invalid<p>`) //send a log to our user
                          await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [socket.user_id]);
                          await io.to(socket.id).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
                          return
                        }
                        var cmdSplit = data.command.replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas                      //the command will be the first entity (0)
                        //cmd =  cmdSplit[0];        //slice off the first item (1) to leave us with our command arg's
                        args = cmdSplit.slice(1);
                        //if (args.length < 1){args = "null"}
                        //console.log(`${socket.user_name}'s Commmand: [${cmd}] With Args: [${args}]`)

                        //Relay to our user the command they entered
                        await socket.emit("terminal", `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd} ${args}<p>`) //send a log to our user

                        //check the command exists
                        // let commands = ["help", "ip"]
                        // if (commands.includes(cmd) == false){
                        //   await io.to(socket.id).emit("processwaiting",`executing command '${cmd}' ....`)
                        //   setTimeout( async () => {
                        //     socket.emit("terminal", `<p>Command '${cmd}' Does not exist try using 'help' <p>`) //send a log to our user
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
                        

                        //await io.to(socket.id).emit("processwaiting",`${cmd}ing ....`)
                        //send command to the table
                        //console.log("-------------------------COMMAND IS"+cmd)
                        await db.query(`INSERT processes SET ?`, {user_id: socket.user_id, command:`${cmd}`, arguments:`${args}`, time:currentTimeInt, localip:socket.vps_hostip, remoteip:socket.vps_remoteip, proxyip:socket.vps_proxy, socket_id:socket.id})  
                        
                    //    await db.query(`INSERT engineCommands SET ?`, {user_id: socket.user_id, command:`${cmd}`, arguments:`${args}`, time:currentTimeInt, localip:socket.vps_hostip, remoteip:socket.vps_remoteip, proxyip:socket.vps_proxy, socket_id:socket.id})  



                        //check that there is a command in the commands table
                        //if the command exists, lock users terminal and set terminal busy to 1

                        //fetch instructions commands table
                        //fetch response from commands table
                        //fetch command delay time
                        //fetch commands cpu cost

                        //return response to user

                        //begin the timer in terminal

                        // setTimeout( async () => {
                        //   await socket.emit("terminal", `
                        //   (SORRY) Terminal is undergoing maitenence<br>
                        //   `);
                        //   await socket.emit("unfreezecmd", `Unfreeze the terminal`);
                        //   socket.terminalBusy = false;
                        // }, 2000);
        
        
//       }
                await db.query(`INSERT sockethandler SET ?`, {user_id:socket.user_id, event: event, data: JSON.stringify(data)})
                break;
        
            case 'command':
                if (socket.terminalBusy == 1){
                    break;
                }else{     
                  //check if temrinal is already busy.
                  socket.terminalBusy = 1
                  var starttime = Math.floor(Date.now() / 1000)
                  //await socket.emit("terminal", `<p>original command: "${data.command}"<p>`)
                  let command = await sanitize(data.command)
                  console.log("sanitized command", command)
                  //await socket.emit("terminal", `<p>Sanitized command: "${command}"<p>`)
                  command = command.replace(",","").split(' ')
                  let cmd = new Object()
                  cmd.command = command[0]
                  cmd.args = command.slice(1)
                  cmd.owner = socket.user_name
                  console.log(cmd)

                  await socket.emit("terminal", `<p>${socket.user_name}@${socket.vps_hostip}:~$ ${cmd.command} ${cmd.args}<p>`) //send a log to our user
                  //await socket.emit("terminal", `${cmd.command} ${cmd.args} \n<div class="progressbar" id="${starttime}"> <div>`) //send a log to our user
                  // make object
                  termupdate = new Object()
                  termupdate.id = starttime
                  termupdate.time = funcs.randomIntB(1,10)
                  await socket.emit("terminalupdate", termupdate)
                  // if (cmd.args.length > 0){
                  //     for (var i=0;i<cmd.args.length;i++){
                  //         let arg = cmd.args[i] 
                  //         setTimeout( async(i) => {
                  //             await socket.emit("terminal", `<p>ARG "${arg}" Processing...<p>`) //send a log to our user
                  //         }, 1000*i+1000);  
                  //     } 
                  // }
                  setTimeout( async () => {
                      var endtime = Math.floor(Date.now() / 1000)
                      await socket.emit("terminal", `<p>Command ${cmd.command} Complete<p>`) //send a log to our user
                      socket.terminalBusy = 0;
                  }, 1000*termupdate.time);
                }
                break;

            default:
                console.log("ERROR EVENT NOT FOUND?")
                break;
        }


    });

    //generate a new key for the socket.
    //socket.key = Math.random().toString(36).substring(2) // gives the socket a unique random key (c1a7v2t6a7t)

    socket.on('disconnect', function() {
      console.log(`${socket.user_name} has disconnected.`)
      io.emit('chat', `${socket.user_name} has disconnected.`)
      //remove client from client list

      // clients.splice(clients.indexOf(client), 1);
    });

}); //END SOCKETS


//START CHAT ENGINE
setInterval( async() => {
    let socketError, socketSuccess = await db.query(`SELECT * FROM sockethandler WHERE event = 'chat' LIMIT 1`)  
    if(socketError){
        return console.log(socketError)
    }
    if (socketSuccess[0]){
        if (socketSuccess[0].event == "chat"){

            //find the owner of the chat message

            let authError, authSuccess = await db.query(`
            SELECT user_id, user_name, chat_color, user_banned, user_chatbanned, user_admin 
            FROM users WHERE user_id = '${socketSuccess[0].user_id}'`)

            if(authError){
                return console.log("ERROR FINDING CHAT OWNER")
            }

            chatOwner = authSuccess[0]
            
            // let spamError, spamSuccess = await db.query(`
            // SELECT user_name, user_chatbanned, user_admin 
            // FROM users WHERE user_id = '${socketSuccess[0].user_id}'`)

            //check muted
            if (chatOwner.user_chatbanned == 1){
                await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[0].id]); 
                return console.log(`Chat banned user ${chatOwner.user_name} tried to send message: ${socketSuccess[0].data}`)

            } 

            var spamCount = {};                                                            //set the spamcount to nothing.
            await antiSpam.push(chatOwner.user_id)                                               //add a count to our array (this can be improved on)
            await antiSpam.forEach(function(x) { spamCount[x] = (spamCount[x] || 0)+1; }); //this... does something? adds up the spam count per socketid
            let tooMuchSpam = spamCount[chatOwner.user_id]    
            

            if( (tooMuchSpam > 4) && (chatOwner.user_admin == 0) ){ //Check we havent spammed too hard.
                let banuser = chatOwner.user_name
                let banuserid = chatOwner.user_id
                await db.query(`UPDATE users SET user_chatbanned = '1' WHERE user_id = ${banuserid}`)
                //io.emit('chat', `<p style="color:red">[SYSTEM] ${chatOwner.user_name}  auto chat banned for 1 minutes (spam)<p>`) //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                await db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `${banuser}  auto chat banned for 1 minutes (spam)`})
                //socket.emit("redirect", `https://connflict.com:3000/auth/logout`); //logout our spammer
                console.log(`Banning user ${banuser}`)
                setTimeout( async() => {
                  console.log(`UN-banning user ${banuser}`)
                  //io.emit('chat', `<p style="color:green">[SYSTEM] ${chatOwner.user_name}  has been unbanned <p>`) //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                  await db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `${banuser}  Unbanned`})
                  await db.query(`UPDATE users SET user_chatbanned = '0' WHERE user_id = ${banuserid}`)
                }, 1*60*1000);
                //socket.disconnect() //disconnect the socketid for good measure
              }


            //Sanitize the data so we dont get shafted.
            data_sanitized = socketSuccess[0].data
            .replace(/^"(.+)"$/,'$1')         
            .replace(/&/g, '&amp;')   //Remove &
            .replace(/</g, '&lt;')    //Remove <
            .replace(/>/g, '&gt;')    //Remove >
            .replace(/"/g, '&quot;')  //Remove " 
            .replace(/'/g, '&#039;')  //Remove '

            if (data_sanitized.length > 500){
                data_sanitized = `${data_sanitized.substring(0, 500)}...`
              } 
            //get username and admin status data based on userid

            
            
            //set the usernames colour and time
            var colourName = `<span style="color:${chatOwner.chat_color};">${chatOwner.user_name}</span>`   //set the user's colorname
            timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            //check admin status
            if (chatOwner.user_admin == 1){
                data_sanitized = `<span style="color:white">${data_sanitized}</span>`

                //admin commands

                if(socketSuccess[0].data.replace(/^"(.+)"$/,'$1').startsWith("!")){
                    console.log("ADMIN COMMAND RECEIVED")
                    function commandParse(data){
                    cmdSplit = data.replace(/^"(.+)"$/,'$1').replace(",","").split(' ') //Split the message into an array between whitespaces after removing all commas
                    cmd = cmdSplit[0];                        //the command will be the first entity (0)
                    console.log("cmd",cmd)
                    cmd_args = cmdSplit.slice(1)              //slice off the first item (1) to leave us with our command arg's
                    console.log("cmd_args",cmd_args)
                    return cmd, cmd_args
                    }
                    var cmd, cmdargs = await commandParse(socketSuccess[0].data) // parse the data and split into command / args
                    switch(cmd){
                        case "!ban":
                        let banuser = cmdargs[0];
                        let banseconds = eval(cmdargs[1])
                        try {
                            eval(cmdargs[1])
                        } catch (error) {
                             io.emit('chat', `<p style="color:orange">'${banseconds}' isnt a valid time dumbass...</p>`)
                            await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[0].id]);
                            return
                        }
                        //io.emit('chat', `<p style="color:red">[SYSTEM] ${banuser} chat banned for ${banseconds} seconds by ${chatOwner.user_name}.<p>`)  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                        db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `${banuser}  chat banned for ${banseconds} seconds by ${chatOwner.user_name}.`})
                        //socket.chatbanned = 1;
                        await db.query(`UPDATE users SET user_chatbanned = '1' WHERE user_name = '${banuser}'`)
                        //io.to(socket.id).emit("redirect", `https://connflict.com:3000/auth/logout`);
                        setTimeout( async () => {
                            console.log(`UN-banning user ${banuser}`)
                            //socket.chatbanned = 1;
                            await db.query(`UPDATE users SET user_chatbanned = '0' WHERE user_name = '${banuser}'`)
                            //io.emit('chat', `<p style="color:green">[SYSTEM] ${banuser} has been unbanned... <p>`) //let everyone know they are back.
                            await db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `${banuser} unbanned`})
                        }, banseconds*1000);
                        break;
                        case "!unban":
                        //console.log("Banning logic activated by"+socket.user_name)
                        //let cmd, cmd_args = await commandParse(data) // parse the data and split into command / args
                        //console.log("cmd and cmdargs", cmd, cmd_args)
                        let unbanuser = cmdargs[0]
                        //io.emit('chat', `<p style="color:green">[SYSTEM] ${unbanuser} has been unbanned by ${chatOwner.user_name}...<p>`) //let everyone know they are back.  //let EVERYONE know he got booted for spam (possibly add a short ban to logging in?)
                        db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `${unbanuser} has been unbanned by ${chatOwner.user_name}...`})
                        await db.query(`UPDATE users SET user_chatbanned = '0' WHERE user_name = '${unbanuser}'`)
                        break;
                        case "!refresh":
                        io.emit('redirect', `https://connflict.com:3000/`)
                        break;
                        case "!kick":
                        //io.to(socket.user_name).emit("redirect", `https://connflict.com:3000/auth/logout`);
                        setTimeout(() => { io.emit('chat', `<p style="color:red">[SYSTEM] ${cmd_args[0]} has been kicked`)  }, 500);
                        break;
                        case "!term":
                        await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [chatOwner.user_id]);
                        break;
                        default:
                        io.to(chatOwner.id).emit('chat', `${cmd} is not a command`);
                        break;
                    }
                    await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[0].id]);
                    return;
                }
            }else{
                //data_sanitized = data_sanitized
                data_sanitized = `<span style="color:white">${data_sanitized}</span>`
            }

            logstring = `\n
            [TIME: ${datetimestamp}] [EVENT: ${socketSuccess[0].event}] 
            [CLIENT: ${chatOwner.user_name}]
            [DATA: ${socketSuccess[0].data.replace(/^"(.+)"$/,'$1')}]
            `
            console.log(logstring) //log the data incase we fuck somehting up.


            
            //SEND CHAT TO USERS
            var messageString = `<small><small><i>(${timestamp})</i></small></small> [${colourName}] ${data_sanitized}`
            await io.emit('chat', messageString)
            await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[0].id]);   
            //LOG CHAT
            db.query('INSERT log_chat SET ?', { user_id:chatOwner.user_id, log_chat_time: timestamp ,log_chat_username: colourName, log_chat_message:data_sanitized}, (error, results) => {
            //console.log("Backing up chat to db")
              if(error){
                  console.log(error);return console.log("ERROR ADDINS CHATHISTORY")
              }             
            });
            
            //console.log("Deleting",socketSuccess[0].id)
        }else{
            return await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[0].id]); 
        }
    }else{
        return
    }
    
    //iterate over every item in the chat
    // for(var i = 0;i<socketSuccess.length; i++){
    //     if (socketSuccess[i].event == "chat"){

    //         //find the owner of the chat message

    //         let authError, authSuccess = await db.query(`SELECT user_id, user_name, chat_color, user_banned FROM users WHERE user_id = '${socketSuccess[i].user_id}'`)
    //         if(authError){
    //             return console.log("ERROR FINDING CHAT OWNER")
    //         }
    //         chatOwner = authSuccess[0]
    //         //Sanitize the data so we dont get shafted.
    //         data_sanitized = socketSuccess[i].data         
    //         .replace(/&/g, '&amp;')   //Remove &
    //         .replace(/</g, '&lt;')    //Remove <
    //         .replace(/>/g, '&gt;')    //Remove >
    //         .replace(/"/g, '&quot;')  //Remove " 
    //         .replace(/'/g, '&#039;')  //Remove '

    //         if (data_sanitized.length > 500){
    //             data_sanitized = `${data_sanitized.substring(0, 500)}...`
    //           } 
    //         //get username and admin status data based on userid
            
    //         await io.emit('chat', `Newchat: ${chatOwner.user_name}: ${data_sanitized}`)
    //         await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[i].id]); 
    //         console.log("Deleting",socketSuccess[i].id)
    //     }else{
    //         await db.query(`DELETE FROM sockethandler WHERE id = ?`, [socketSuccess[i].id]); 
    //     }
        
    // }
}, 100);


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
    command = command
    .replace(/&/g, '&amp;')   //Remove &
    .replace(/</g, '&lt;')    //Remove <
    .replace(/>/g, '&gt;')    //Remove >
    .replace(/"/g, '&quot;')  //Remove " 
    .replace(/'/g, '&#039;')  //Remove '
    let args = process[i].arguments
    args = args
    .replace(/&/g, '&amp;')   //Remove &
    .replace(/</g, '&lt;')    //Remove <
    .replace(/>/g, '&gt;')    //Remove >
    .replace(/"/g, '&quot;')  //Remove " 
    .replace(/'/g, '&#039;')  //Remove '
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
      
      //socket.emit("terminal", `${command} process completed.`)
      await db.query(`UPDATE user_vps SET terminalbusy = 0 WHERE user_id = ?`, [userid]);
      await db.query(`DELETE FROM processes WHERE process_id = ?`, [processid]); 
    }else{
      await io.to(socketid).emit("processwaiting",` executing command '${command}' .... (${timeleft})`)
    }   
  }
  //console.log(processSuccess)
}, 100);

//complete processes

async function completeProcess(process){
  console.log(`Completing process`, process.command)
  commandHandler(process.command, process.arguments, process.user_id, process.socket_id)
  switch (process.command) {
    case "help":
        //send help
        await io.to(process.socketid).emit("terminal",`<p style="color:yellow">${process.command}: <br>The game is currently in Alpha 1.1, gameplay is subject to change and/or break!<br><br> Avalible commands: <br> Help<br> ip <br> ls <br>  ddos <br>  pcstatus <br> logout <p>`) //send an emit to socket
      break;

    case "ip":
      await io.to(process.socketid).emit("terminal",` Your ${process.command} is: TBA`) //send an emit to socket
    break;

    case "ls":
      await io.to(process.socketid).emit("terminal",` You Dont have any files`) //send an emit to socket
    break;

    case "ddos":
        console.log("args length",process.arguments.length)
        console.log("process.arguments",process.arguments)
      if (process.arguments[0].length > 7){
        await io.to(process.socketid).emit("terminal",`DDOS SENT TO '${process.arguments[0]}' for ${funcs.randomIntB(100,10000)}MHz damage!`) //send an emit to socket
        //start a ddos for X seconds.
      }else{
        console.log("args length",process.arguments.length)
        await io.to(process.socketid).emit("terminal",`ERROR: '${process.command}' requires 1 args (ddos <target>)`) //send an emit to socket
      }      
    break;

    case "pcstatus":
      await io.to(process.socketid).emit("terminal",` PCSTATUS:<br>Online`) //send an emit to socket
    break;

    case "logout":
      await io.to(process.socketid).emit("terminal",` Logging out`) //send an emit to socket
      await io.to(process.socketid).emit("redirect",`https://connflict.com:3000/auth/logout`) //send an emit to socket
    break;

    default:
      await io.to(process.socketid).emit("terminal",`Command '${process.command}' Not Found.`) //send an emit to socket
      break;
  }
      console.log("Giving back the temrinal to :",process.user_id)
      await io.to(process.socketid).emit("unfreezecmd", `Unfreeze the terminal`) //send an emit to everyone connected (will need to change this?)
}

async function commandHandler(command, cmdarguments, userid,socketid){
  ///handle commands
  let usererror, usersucc = await  db.query(`SELECT * FROM users WHERE user_id = ?`, [userid])
  if(usererror){ return console.log("ERROR FETCHING USERDATA FOR COMMAND")}
  if (!usersucc[0]){return console.log("ERROR USERDATA NOT FOUND")}
  let cmderror, cmdsuccess = await  db.query(`SELECT * FROM commands WHERE cmd = ?`, [command])
  if (cmderror){ return console.log("ERROR FETCHING COMMANDS")}
  if (!cmdsuccess[0]){
    await io.to(socketid).emit("terminal",`Command '${command}' Not Found.`) //send an emit to socket  
    return console.log("ERROR COMMAND NOT FOUND",command, cmdsuccess)}


  let user_id = usersucc[0].user_id;
  let cmdcommand = cmdsuccess[0].cmd
  let cmdDesc = cmdsuccess[0].description
  console.log("userid sent command",user_id,cmdcommand,cmdDesc)
}

async function sanitize(text){
    //begin parsing the CMD and args
    return text        //sanitize the text
    .replace(/&/g, '&amp;')   //Remove &
    .replace(/</g, '&lt;')    //Remove <
    .replace(/>/g, '&gt;')    //Remove >
    .replace(/"/g, '&quot;')  //Remove " 
    .replace(/'/g, '&#039;')  //Remove '
}
//START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});
console.log(`Server started on port ${port} ${__dirname}`);
