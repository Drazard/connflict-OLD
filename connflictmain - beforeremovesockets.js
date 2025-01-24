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
//define database
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
    try {
        db.query('SELECT 1');
    } catch (error) {
        process.exit()
    }
  
}, 5*60*1000);

var clients = [];

// setTimeout(() => {
//   io.emit("chat", `<p>(${timestamp}) Server was restarted</p>`);   
// }, 5000);



var serverRestart = 1;

setTimeout(() => {
  serverRestart = 0;
}, 60*1000);

db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `Server Restarted.`})
var antiSpam = []; //declair an array of antiSpam to catch spammers
setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.

//un-chatban everyone
db.query(`UPDATE users SET user_chatbanned = '0'`)

console.log("")

//Create Maps
// var commandsMap = new Map()
// var terminalMap = new Map()


// commandsMap.set("ssh", {'cmdTime':1, 'response':"Logged in."})
// commandsMap.set("dc", {'cmdTime':1, 'response':"Disconnected"})
// commandsMap.set("ddos", {'cmdTime':30, 'response':"DDOS Sent"})
// commandsMap.set("logout", {'cmdTime':1, 'response':"USer logged out"})
// commandsMap.set("destroy", {'cmdTime':1, 'response':"Command not Finished"})

// let commandList = [...commandsMap.keys()];
// commandsMap.set("help", {'cmdTime':1, 'response':`Avalible commands: <br> <p>${commandList}</p>`})
// commandsMap.set("unknown", {'cmdTime':1, 'response':"Command not recognised! <p>try using 'help'</p>"})
// commandsMap.set("login", {'cmdTime':1, 'response':"User logged in"})

//var user = new Object();


setTimeout( async() => {
      var clientlist = []
      io.sockets.sockets.forEach( async (client) => {
        clientlist.push(client.gameData.username)
        });
      console.log(`(${clientlist.length})(Connected clients: ${clientlist.join(", ")}`)
}, 5000);


//userSetup function
async function userSetup(socket){

    
    

    //get users ip address
    if (socket.handshake.address.substr(0, 7) == "::ffff:") {

        socket.irlip = socket.handshake.address.substr(7)
        var irlipaddress = socket.handshake.address.substr(7)
    }else{
        socket.irlip = socket.handshake.address
        var irlipaddress = socket.handshake.address
    }

    //get geodata
    let geo = await geoip.lookup(socket.handshake.address) 
    socket.geo = {country:geo.country, state:geo.region, city:geo.city, timezone:geo.timezone}

    //get cookies
    let cookies = cookie.parse(socket.request.headers.cookie || ''); //Get cookies from request headers
    socket.cookies = cookies.draz     // set cookies to socket

    //get user agent
    socket.useragent = socket.request.headers['user-agent']

    //authorize user (SELECT user_id, user_name, chat_color, user_chatbanned, user_banned user_admin, user_ip, user_email FROM users)
    let authData = await authUser(socket)                //return userdata if the user exists that matches the cookies
    //console.log(authData, "AUTHDATA")

    socket.userid = authData.user_id
    socket.name = authData.user_name
    socket.color = authData.chat_color
    socket.banned = authData.user_banned
    socket.chatbanned = authData.user_chatbanned
    socket.admin = authData.user_admin
    socket.activated = authData.user_activated

    //updating socket data
    await updateSocketid(socket)
    //get users socket id
    socket.socketid = socket.id

    //getting the users vps stats
    let userVps = await getGameData(socket)
    //console.log("uservps info",userVps)
    socket.hostip = userVps.vps_hostip
    socket.remoteip = userVps.vps_remoteip
    socket.terminalhistory = userVps.vps_history
    socket.proxy = userVps.vps_proxy
    socket.terminalbusy = userVps.terminalbusy
    //console.log(socket.name, "ip address in game is:", socket.hostip)

    //updating socket data
    // await updateSocketid(socket)
    // //get users socket id
    // socket.socketid = socket.id
    let geoInfo = {country:geo.country, state:geo.region, city:geo.city, timezone:geo.timezone}
    let connectionInfo = {ip:irlipaddress, cookie:cookies.draz, geoInfo:geoInfo, useragent:socket.request.headers['user-agent']}

    socket.gameData = {
        userid:authData.user_id,
        username:authData.user_name,
        usernameColour:authData.chat_color,
        bannedGame: authData.user_banned,
        bannedChat:authData.user_chatbanned,
        isAdmin:authData.user_admin,
        activated:authData.user_activated,
        socketid:socket.id,
        hostip:userVps.vps_hostip,
        remoteip:userVps.vps_remoteip,
        terminalHistory:userVps.vps_history,
        connectionInfo:connectionInfo}

}

async function getSocketData(clientname){
    let result = false
    io.sockets.sockets.forEach( async (client) => {
        if (client.gameData.username = clientname){ result =  client.gameData } 
        });
    return result
}

//console.log("CommandsMap\n",commandsMap)
//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)

    let socketAddress = socket.handshake.address.substr(7)
    console.log(socketAddress)
    // if (socketAddress == "112.213.37.147"){
    //     console.log("connflict bot logged in")
    // } else {

    //setup our new user with socket data.
    await userSetup(socket);

    await checkAuthorization(socket)
    
    await checkUserBanned(socket)

    await checkMultiUSers(socket)

    await notifyLogin(socket)

    await updateSocketid(socket)

    //log connection
    drazLog("CONNECTION",`${socket.name} connected \nIP: ${socket.irlip} \nGeoInfo: Country:${socket.geo.country} State:${socket.geo.state} City:${socket.geo.city} \nTimezone: ${socket.geo.timezone} \nUserAgent: ${socket.useragent}`)

    await showChatHistory(socket)

    await showCmdHistory(socket)
    //let remoteip111 = await getRemoteIp(socket.userid)
    //console.log(remoteip111, "remoteip for player.")
    
    //exampleLogs(socket)

    //clean this up prob
    if(!serverRestart){
      //io.emit('chat', `${socket.name} online.`)
      
      }
    
    setInterval(() => { socket.chatSpam = 0; socket.cmdSpam = 0 }, 1000); //reset antiSpam array to be empty every 1 second.


    // }
      

    //Start listening for sockets.
    socket.onAny( async (event, data) => { //When we get any emit  (on any)

        //log event
        var socketAddress = socket.handshake.address.substr(7)
        await updateSocketid(socket)
        switch (event) {

            //Send a chat message
            case 'chat':
                //Log the chat
                
                //sanitize message
                socket.message = await sanitize(data)
                
                //Create message object
                let chatData = {"user_id":socket.userid, "msg": `<${socket.hostip}> ${socket.message}`}

                //drazLog("DEBUG-CHAT",`User: ${user.name} \nMessage: ${message}`)

                //send to chat engine
                await sendChat(socket, chatData);

                break;

            //send a terminal command
            case 'command':
                //sanizite the terminal data
                let terminalData = await sanitize(data.command)

                //seperate command and arguments
                terminalData = terminalData.replace(",","").split(' ')

                //set the current time in seconds
                var starttime = Math.floor(Date.now() / 1000)

                var remoteTerminal = await getRemoteIp(socket.userid)

                //Create the command / args object
                socket.cmdData = {"command":terminalData[0], "args":terminalData.slice(1), "cmdTime":starttime, "cmdLocation":remoteTerminal}

                //send command to be processed.
                await processCommand(socket);
                

                break;

            //Send a chat message
            case 'commandstart':
                var socketid = await getSocketbyId(data.userid)
                // console.log(`command response: ${JSON.stringify(data)}`)
                // console.log(`PROCESSENGINE: sendto ${data.username} socket: ${socketid} message: ${data.success}`)

                //send the message to ourselves
                await io.to(socketid).emit("terminal", data.result)

                //send the message to users connected to us
                io.sockets.sockets.forEach( async (client) => {
                    if (client.gameData.remoteip = data.hostip){
                        if (client.gameData.hostip != data.hostip) {
                            console.log(`Senidng ${data.result} from (${data.name})to ${client.gameData.socketid} (${client.gameData.username})`)
                            io.to(client.gameData.socketid).emit("log", `"TEST-METHOD: " <p>${data.result}</p>`)
                        }
                    } 
                });
                //find all of the 'loggers' using the current socket ID, find all users whom are connected to the same terminal as we are.
                //var ownerID = await getIdbyName(data.owner)
                //var hostIP = await getHostIp(ownerID)
                var loggers = await getRemoteSocketByRemoteIp(data.hostip) // 

                //emit the command to every 'logger' that we find (people connected to the ip address of the current socket.userid)
                loggers.forEach( async (logger) => { 
                    console.log(logger.user_id, data.userid)
                    if (logger.user_id != data.userid){
                        await io.to(logger.vps_socket).emit("log", data.result)
                        // try {
                        //     console.log(`sending ${data.username}'s CMD from ${data.hostip} (${socketid}) to ${await getNameById(logger.user_id)} (${logger.vps_socket})`)
                        // } catch (error) {
                        //     console.log(`sending ${data.usrename}'s CMD from ${data.hostip} (${socketid}) to unknown (${logger.vps_socket})`)
                        // }
                        
                    } else {}
                });
                
                
                break;
            
            case 'commandrunning':
                var socketid = await getSocketbyId(data.userid)
                //send the message to ourselves
                // console.log("socketid", socketid, "sending",data.processmessage,"to",socketid)
                // console.log("data",data)
                await io.to(socketid).emit("process", data.processmessage)
                var loggers = await getRemoteSocketByRemoteIp(data.hostip) // 

                //emit the command to every 'logger' that we find (people connected to the ip address of the current socket.userid)
                loggers.forEach( async (logger) => { 
                    if (logger.user_id != data.userid){
                        await io.to(logger.vps_socket).emit("logprocess", data.processmessage)
                        // try {
                        //     console.log(`sending ${data.username}'s CMD from ${data.hostip} (${socketid}) to ${await getNameById(logger.user_id)} (${logger.vps_socket})`)
                        // } catch (error) {
                        //     console.log(`sending ${data.username}'s CMD from ${data.hostip} (${socketid}) to unknown (${logger.vps_socket})`)
                        // }
                        
                    } else {}
                });

            break;
            case 'finances':
                //send to users
                await sendFinance(data);
                //socket.emit('finainces', [funcs.randomIntB(100,10000),funcs.randomIntB(100,10000),funcs.randomIntB(100,10000),funcs.randomIntB(100,10000)])

                break;
            case 'chartdata':
                //send to users
                if (socketAddress == "112.213.37.147"){
                    await sendFinance(data);
                } else {
                    //await io.to(socket.socketid).emit("chat",`<p style="color:yellow"> ${socket.name}</> <p style="color:red">  <h1 style="color:red">STOP</h1> FUCKING WITH THE GAME. D:< <p> This action has been logged.`)
                }
                
                //socket.emit('finainces', [funcs.randomIntB(100,10000),funcs.randomIntB(100,10000),funcs.randomIntB(100,10000),funcs.randomIntB(100,10000)])

                break;

            
            case 'loaded':
                await updateSocketid(socket)
            break;

            default:
                await io.to(socket.socketid).emit("terminal",`<p style="color:yellow"> ${socket.name}</> <p style="color:red">  <h1 style="color:red">STOP</h1> <span style="color:red">FUCKING WITH THE GAME. D:< </span><p style="color:red"> This action has been logged.`)
                //drazLog("UNKNOWN EVENT",`User: ${socket.name} \nEvent: ${event} \nData: ${data}`)
                //console.log("BOT???",event, JSON.stringify(data))
                break;
        }
        //let logString = `${socket.name} \nIP: ${socket.ip} \nGeoInfo: Country:${socket.geo.country} State:${socket.geo.state} City:${socket.geo.city} \nTimezone: ${socket.geo.timezone} \nUserAgent: ${socket.useragent} \nEvent: ${event} \nData:\n\n${data}\n`
        //let socketAddress = socket.handshake.address.substr(7)
        //console.log(socketAddress)
        if (socketAddress == "112.213.37.147"){
            //console.log("connflict bot logged in")
        } else {
            drazLog(event,`User: ${socket.name}\nEvent: ${event}\nData: ${JSON.stringify(data)}`)
        }
        
    });

    socket.on('disconnect', function() {
        if (socket.handshake.address.substr(7) == "112.213.37.147"){
            //console.log("connflict bot logged in")
            //io.emit('chat', `GameBot-Finance has disconnected.`)
        } else{
            drazLog("DISCONNECT",`${socket.name} disconnected.`)
           // io.emit('chat', `${socket.name} has disconnected.`)
            notifyDisconnect(socket)
            //remove client from client list
        }
      
        socket.disconnect()
      // clients.splice(clients.indexOf(client), 1);
    });

}); //END SOCKETS

//authorizeUSer
async function authUser(socket){

    if (socket.irlip == "112.213.37.147"){
        var error, userAuth = await db.query(`
        SELECT user_id, user_name, chat_color, user_chatbanned 
        FROM users 
        WHERE user_id = 0`)
    } else{
        var error, userAuth = await db.query(`
        SELECT user_id, user_name, chat_color, user_chatbanned 
        FROM users 
        WHERE user_logintoken = '${socket.cookies}'`)
    }
    
    if(error){
        return console.log("Authentication error")
    }else if(userAuth && userAuth[0]){
        //console.log(`SUCCESS! loginToken: `, authSuccess[0].user_logintoken)
        return userAuth[0]
    }else{
        //console.log("USER NOT LOGGED IN?")
        return
        
    }
}

//get game data (vpsdata)
async function getGameData(socket){
    let error, vps = await db.query(`
    SELECT * 
    FROM user_vps 
    WHERE user_id = '${socket.userid}'
    `)
    if(error){
        return console.log("Authentication error")
    }else if(vps && vps[0]){

        return vps[0]
    }else{
        console.log("USER VPS NOT FOUND")
        console.log(vps);
        return
            
    }
}

//check User is auth'd
async function checkAuthorization(socket){
    if(!socket.name){ //check we are logged in
        drazLog("ERROR-authUser","USER DOES NOT EXIST??")
        timestamp = new Date().toLocaleTimeString();                                             //Set the current time
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);                      //send a redirect to logout
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: U0] - Try re-logging`);                 //let them know there has been an error (kinda pointless)
        return socket.disconnect();                                                              //disconnect the socketid for good measure
    } else{
        return true
    }
}

//banCheck
async function checkUserBanned(socket){
    if(socket.banned >= 1){ //check if the user is banned
        timestamp = new Date().toLocaleTimeString();    
        socket.emit("redirect", `https://connflict.com:3000/auth/logout`);
        socket.emit("chat", `(${timestamp}) [ERROR-CODE: B1] - youve been banned.`);  
        io.emit('chat', `<p style="color:red">[SYSTEM] ${socket.name} tried to login (banned) <p>`)
        setTimeout(() => { 
            socket.emit("redirect", `https://connflict.com:3000/auth/logout`);   
            socket.disconnect() 
        }, 3000);
        return              //send a redirect to logout  
    }
}

//check multi users
async function checkMultiUSers(){
    //does nothing for now,m need to re-do
}

//show chat history
async function showChatHistory(socket){
    let error, chatHistory = await db.query(`
    SELECT * FROM (
        SELECT * FROM log_chat ORDER BY log_chat_id DESC LIMIT 50 
    ) 
    sub ORDER BY log_chat_id ASC
    `)
    if(!chatHistory[0]){
        drazLog("ERROR-Chat History","Something went wrong with the chat history, line 265")
    }else{
        var history;
        for(var i=0;i<chatHistory.length;i++){
            new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            //sliceamount = (chatHistory[i].log_chat_time.length - 10, chatHistory[i].log_chat_time.length - 2)
            history = `<small><small><i>(${chatHistory[i].log_chat_time})</i></small></small> [${chatHistory[i].log_chat_username}] ${chatHistory[i].log_chat_message}<br>`
            await socket.emit('chat', history) 
        }
        // await socket.emit('chat', history)   
    }
}
//show cmd history
async function showCmdHistory(socket){
    let error, cmdHistory = await db.query(`
    SELECT * FROM (
        SELECT * FROM log_terminal
        WHERE username = '${socket.name}'
        ORDER BY id DESC LIMIT 50 
    ) 
    sub ORDER BY id ASC
    `)
    // if (await getRemoteIp(socket.userid) == await getHostIp(socket.userid)){
    //     var history = `<p style="color:darklime">localhost <${socket.hostip}></p>`;
    // }else{
    //     var history = `<p style="color:darklime">connection established... (${await getRemoteIp(socket.userid)})</p>`;
    // }
    
    if(!cmdHistory[0]){
        // drazLog("ERROR-CMD History","No history found")
    }else{
        for(var i=0;i<cmdHistory.length;i++){
            new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            //sliceamount = (chatHistory[i].log_chat_time.length - 10, chatHistory[i].log_chat_time.length - 2)
            // if (cmdHistory[i].command == "cls"){
            //     history = `<p>termninal cleared.</p>`
            // } else {
                history = `<p>${socket.name}@${cmdHistory[i].terminalip}:-$ ${cmdHistory[i].command} ${cmdHistory[i].args}</p>`
                await io.to(socket.socketid).emit('terminal', history)
            // }
            
        }
           
    }
    
}

//show cmd history
async function showCmdHistoryprocess(ip){
    //console.log("GETTING HISTORY FOR TERMINAL",process.args)
    let error, cmdHistory = await db.query(`
        SELECT * FROM log_terminal WHERE terminalip = '${ip}'
        ORDER BY id ASC LIMIT 50 
        `)
    var history = `<p style="color:darklime">connection established... -(${ip})-</p>`;
    
    if(!cmdHistory[0]){
        // drazLog("ERROR-CMD History","No history found")
    }else{
        for(var i=0;i<cmdHistory.length;i++){
            new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            //sliceamount = (chatHistory[i].log_chat_time.length - 10, chatHistory[i].log_chat_time.length - 2)
            if (cmdHistory[i].command == "cls"){
                history += `<p>termninal cleared.</p>`
            } else {
                history += `<p>${cmdHistory[i].username}@${cmdHistory[i].terminalip}:-$ ${cmdHistory[i].command} ${cmdHistory[i].args}</p>`
            }
            
        }
           
    }
    //console.log(process,"THIS IS PROCESS OBJCTE")
    let socketid = await db.query(`
    SELECT vps_socket 
    from user_vps
    WHERE vps_remoteip = '${ip}'`);
    //console.log("TRYING TO SEND HISTORY TO SOCKET ID",socketid[0].vps_socket)
    //console.log("Updating terminal history for",socketid[0].vps_socket)
    socketid.forEach( async (socketid) => {
        //console.log("socketid:",socketid.vps_socket)
        await io.to(socketid.vps_socket).emit("terminalhistory", history)
    });
    // await io.to(socketid[0].vps_socket).emit('terminalhistory', history)
}

//Example logs to be sent to players
async function exampleLogs(socket){
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
}


//updateHostIp
async function updateHostIp(socket){
    await db.query(`
    UPDATE user_vps 
    SET vps_hostip = '${socket.hostip}'
    WHERE user_id = ${socket.userid}`);
}

//updateSocketid
async function updateSocketid(socket){
    await db.query(`
    UPDATE user_vps 
    SET vps_socket = '${socket.id}'
    WHERE user_id = ${socket.userid}`);
}

//updateHostIp
async function updateHostIp(socket){
    socket.hostip = ip
    return await db.query(`
    UPDATE user_vps 
    SET vps_hostip = '${socket.hostip}'
    WHERE user_id = ${socket.userid}`);
}

//updateRemoteIp
async function updateRemoteIp(process, newip){
    await db.query(`
    UPDATE user_vps 
    SET vps_remoteip = '${newip}'
    WHERE user_id = ${process.user_id}`);
    return await showCmdHistoryprocess(newip)

}

async function getRemoteIp(userid){
    let remoteip = await db.query(`
    SELECT vps_remoteip 
    FROM user_vps
    WHERE user_id = ${userid}`);
    //console.log(remoteip[0].vps_remoteip, "this is the db thingo for the thingie remoteip")
    return remoteip[0].vps_remoteip 
}

async function getHostIp(userid){
    let remoteip = await db.query(`
    SELECT vps_hostip 
    FROM user_vps
    WHERE user_id = ${userid}`);
    //console.log(remoteip[0].vps_remoteip, "this is the db thingo for the thingie remoteip")
    return remoteip[0].vps_hostip 
}

async function getRemoteId(ip){
    let remoteip = await db.query(`
    SELECT user_id
    FROM user_vps
    WHERE vps_hostip = '${ip}'`);
    //console.log(remoteip[0].vps_remoteip, "this is the db thingo for the thingie remoteip")
    return remoteip[0].user_id
}

async function clearTerminal(process){
    console.log(process.terminal, "DELETING ALL LOGS")
    await db.query("DELETE FROM `log_terminal` WHERE `terminalip` = '"+await getRemoteIp(process.user_id)+"'");
    return await showCmdHistoryprocess(process.terminal);
}

//notify when user has logged in - "temrinal"
async function notifyLogin(socket){
    let error, loggers = await db.query(`
            SELECT vps_socket
            FROM user_vps
            WHERE vps_remoteip = '${socket.hostip}' `) //OR vps_hostip = '${ip}'

    if(error){
        return drazLog("ERROR- emitcommand",`ERROR within the emitCommand function`)
    }
    //console.log("users that are connected: ",emitSuccess)
    loggers.forEach( async (logger) => {
        //console.log("socketid:",socketid.vps_socket)
        await io.to(logger.vps_socket).emit("log", `<p>${socket.name}@${socket.hostip} came online.`)
    });
}

// notify disconnect
async function notifyDisconnect(socket){
    let error, loggers = await db.query(`
            SELECT vps_socket
            FROM user_vps
            WHERE vps_remoteip = '${socket.hostip}' `) //OR vps_hostip = '${ip}'

    if(error){
        return drazLog("ERROR- emitcommand",`ERROR within the emitCommand function`)
    }
    //console.log("users that are connected: ",emitSuccess)
    loggers.forEach( async (logger) => {
        //console.log("socketid:",socketid.vps_socket)
        await io.to(logger.vps_socket).emit("log", `<p>${socket.name}@${socket.hostip} Disconnected`)
    });
}

//get remote socketid
async function getRemoteSocketByRemoteIp(ip){
    return await db.query(`
    SELECT vps_socket, user_id 
    from user_vps
    WHERE vps_remoteip = '${ip}'`);
}

//get remote socketid
async function getSocketFromConnectedto(ip){
    return await db.query(`
    SELECT vps_socket, user_id 
    from user_vps
    WHERE vps_hostip = '${ip}'`);
}

//get files from connected ip
async function getFilesFromRemoteIp(socket){
    return await db.query(`
    SELECT * 
    from fileList
    WHERE fileLocation = ${await getRemoteIp(socket.userid)}`);
}

//Chat Function
async function sendChat(socket, chatData){

    //Check user isnt chat banned
    if (socket.chatbanned == 1){
        return drazLog("CHAT BANNED",`Chat banned user ${socket.name} tried to send \nmessage: ${chatData.msg}`)
    }

    //set the usernames colour and time
    var colourName = `<span style="color:${socket.color};">${socket.name}</span>`   //set the user's colorname
    chatTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); //setting time

    //set the message string
    let messageString = `<span style="color:white">${chatData.msg}</span>`

    //combine chat string
    var chatString = `<small><small><i>(${chatTime})</i></small></small> [${colourName}] ${messageString}`

    //Log chat
    //drazLog("SENDCHAT",`User: ${socket.name} \nMessage: ${chatData.msg}`)

    //Send Chat to database for logging
    db.query('INSERT log_chat SET ?', { user_id:socket.userid, log_chat_time: chatTime ,log_chat_username: colourName, log_chat_message:messageString}, (error, results) => {
        //console.log("Backing up chat to db")
          if(error){
                drazLog("ERROR-sendChat", `ERROR sending chat to the database ${error}`)
                return
          }             
        });

    //SEND CHAT TO USERS
    return await io.emit('chat', chatString)
}

//CMD function
async function sendCommand(socket){

    let responseString = `<p>Command: '${socket.cmdData.command}'<br>`

    if (socket.cmdData.args.length > 0){
        responseString = responseString + ` With Args: '${socket.cmdData.args}'<br>`
    }
    responseString = responseString + ` Accepted.</p>`

    //logging command
    //drazLog("SENDCMD", `User: ${socket.name} \ncmd: ${socket.cmdData.command} \nargs: ${socket.cmdData.args} \ncmdTime: ${socket.cmdData.cmdTime}`)

    //Send response to terminal
    let starttime = Math.floor(Date.now() / 1000)
    await io.to(socket.socketid).emit("terminal",`<p>${socket.name}@${await getRemoteIp(socket.userid)}:-$ ${socket.cmdData.command} ${socket.cmdData.args}</p><br>`)
    //Send response to loggers
    await emitCommand(socket, `<p>${socket.name}@${await getRemoteIp(socket.userid)}:-$ ${socket.cmdData.command} ${socket.cmdData.args}</p>`)



    //set terminal to busy

    //push command to the commands list
    if (!commandsMap.has(socket.cmdData.command)){
        socket.terminalBusy = 0;
        //console.log(`${command} DOES NOT EXIST!`)
        //emitCommand(ownerData.vps_hostip, terminalData, `${commandsMap.get("unknown").response}`)
        //return await io.to(ownerData.id).emit("terminal",`<p>${commandsMap.get("unknown").response}</p><br><br>`)
        return terminalMap.set(socket.name, {'terminalData':socket.cmdData, 'command':'unknown', 'args':socket.cmdData.args,'cmdTime':'0', 'socketid':socket.socketid, 'ip':socket.hostip, 'name':socket.name})
    }
    //console.log("CMDTIME IS",terminalData.time, "commandsMAP CMDTIME is",commandsMap.get(command).cmdTime)

    setTimeout(() => {
        socket.terminalBusy = 0;
    }, commandsMap.get(socket.cmdData.command).cmdTime * 1000);

    let cmdrunTime = await socket.cmdData.cmdTime + commandsMap.get(socket.cmdData.command).cmdTime
    //console.log("NEWcmdTime", cmdrunTime)
    //console.log("CMDMAP",commandsMap.get(command))
    
    let timeleft = commandsMap.get(socket.cmdData.command).cmdTime
    termupdate = new Object()
    termupdate.id = starttime
    termupdate.time = timeleft
    await io.to(socket.socketid).emit("terminalupdate", termupdate)
    await io.to(socket.socketid).emit("processwaiting",` executing command '${socket.cmdData.command}' .... (${timeleft})`)
    return await terminalMap.set(socket.name, {'terminalData':socket.cmdData, 'command':socket.cmdData.command, 'args':socket.cmdData.args,'cmdTime':cmdrunTime, 'socketid':socket.socketid, 'ip':socket.hostip, 'name':socket.name})
    //return commandsList.push(terminalData)
}

//Finance Function
async function sendFinance(financeData){
    //SEND Finances TO ALL USERS

    // //set the usernames colour and time
    // var colourName = `<span style="color:red;">SYSTEMS-TEST</span>`   //set the user's colorname
    // chatTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); //setting time

    // //set the message string
    // let messageString = `<span style="color:white">BTC: $${financeData.BTC}`

    // //combine chat string
    // var chatString = `<small><small><i>(${chatTime})</i></small></small> [${colourName}] ${messageString}`

    //SEND CHAT TO USERS


    return await io.emit('chartdata', financeData)
    //return await io.emit('chat', financeData)
}

async function emitCommand(socket, message){
    //send the message to ourselves
    await io.to(socket.id).emit("terminal", message)

    //send a log to our remote ip
    if (socket.remoteip != socket.hostip){
        let victim = await getSocketFromConnectedto(socket.remoteip)
        //console.log("victim",victim)
        //console.log("victim[0]",victim[0])
        io.to(victim[0].vps_socket).emit("log", message)
        }
    
    //find all of the 'loggers' using the current socket ID, find all users whom are connected to us.
    let hostIP = socket.hostip
    let loggers = await getRemoteSocketByRemoteIp(hostIP) // 
    //standard log for all commands
    await db.query(`INSERT log_terminal SET ?`,{username: socket.name, terminalip: await getRemoteIp(socket.userid), command:socket.cmdData.command, args:socket.cmdData.args.join(' ')})
    
    
    //emit the command to every 'logger' that we find (people connected to the ip address of the current socket.userid)
    loggers.forEach( async (logger) => { 
        if (logger.user_id != socket.userid){
            //console.log(`USERID:${logger.user_id} SENDING TO: ${socket.userid}  - ${message}`)
            io.to(logger.vps_socket).emit("log", message)
            // try {
            //     console.log(`sending ${socket.name}'s CMD from ${hostIP} (${socket.id}) to ${await getNameById(logger.user_id)} (${logger.vps_socket})`)
            // } catch (error) {
            //     console.log(`sending ${socket.name}'s CMD from ${hostIP} (${socket.id}) to unknown (${logger.vps_socket})`)
            // }
            
        }  
    });
}

async function emitCommandFinished(process, message){
    //get sockets via connected ips
    let loggers = await db.query(`
    SELECT vps_socket,
    FROM user_vps
    WHERE vps_remoteip = '${process.terminal}' `)
    await db.query(`INSERT log_terminal SET ?`,{username: "root", terminalip: process.terminal, command:message, args: process.args})
    loggers.forEach( async (logger) => {
        //console.log("LOGGER socketid:",logger.vps_socket)
        //await console.log(`sending forEach COMMAND to ${logger.vps_socket}`)
        await io.to(logger.vps_socket).emit("terminal", message)
    });
}

async function emitremoteip(ip, message){
    //get sockets via connected ips
    let loggers = await db.query(`
    SELECT vps_socket
    FROM user_vps
    WHERE vps_remoteip = '${ip}' `)
    //await db.query(`INSERT log_terminal SET ?`,{username: "root", terminalip: process.terminal, command:message, args: process.args})
    loggers.forEach( async (logger) => {
        //console.log("LOGGER socketid:",logger.vps_socket)
        //await console.log(`sending forEach COMMAND to ${logger.vps_socket}`)
        await io.to(logger.vps_socket).emit("log", message)
    });
}

async function emitResponse(userid, message){
    //get sockets via connected ips
    let loggers = await getRemoteSocketByRemoteIp(await getRemoteIp(userid))
    loggers.forEach( async (logger) => {
        //console.log("LOGGER socketid:",logger.vps_socket)
        //await console.log(`sending forEach COMMAND to ${logger.vps_socket}`)
        await io.to(logger.vps_socket).emit("log", message)
    });
}

async function getNameById(id){
    let username = await db.query(`
    SELECT user_name
    FROM users
    WHERE user_id = '${id}'
    LIMIT 1`)
    return username[0].user_name
}

async function getIdbyName(name){
    let username = await db.query(`
    SELECT user_id
    FROM users
    WHERE user_name = '${name}'
    LIMIT 1`)
    return username[0].user_id
}

async function getSocketbyName(name){
    let socketid = await db.query(`
    SELECT vps_socket
    FROM user_vps
    WHERE user_id = '${await getIdbyName(name)}'
    LIMIT 1`)
    return socketid[0].vps_socket
}

async function getSocketbyId(id){
    let socketid = await db.query(`
    SELECT vps_socket
    FROM user_vps
    WHERE user_id = '${id}'
    LIMIT 1`)
    return socketid[0].vps_socket
}

async function emitProcess(process){
    //console.log(`PROCESS ${process.command} BY USER ${process.user_id} on terminal ${process.terminal} STILL HAS ${process.timeleft} seconds left.`)
    let error, loggers = await db.query(`
            SELECT vps_socket
            FROM user_vps
            WHERE vps_remoteip = '${process.terminal}' `) //OR vps_hostip = '${ip}'

    if(error){
        return drazLog("ERROR- emitcommand",`ERROR within the emitCommand function`)
    }
    //console.log("users that are connected: ",emitSuccess)
    loggers.forEach( async (logger) => {
        //console.log("socketid:",logger.vps_socket)
        await io.to(logger.vps_socket).emit("process", process)
    });
    return
}

async function processCommand(socket){
    //setting variables for readability
    let userid = socket.userid
    let username = socket.name
    let hostip = socket.hostip
    let remoteip = socket.remoteip
    let command = socket.cmdData.command
    let args = socket.cmdData.args.toString()
    let time = socket.cmdData.cmdTime

    //check command
    let exists = await db.query(`SELECT * FROM terminal_commands WHERE cmd_name = '${command}'`)
    if (!exists[0]){
        await emitCommand(socket, `<p>${username}@${remoteip}:-$ ERROR: command does not exist '${command}'</p>`)   
    }else{
        //process command
        var commandData = {'userid':userid, 'username':username, 'hostip':hostip, 'remoteip':remoteip, 'command':command, 'args':args, 'time':time}
        let socketMessage = `ERROR?`
        
        //check procesesses for duplicate entries from the same userid
        let processRunning = await db.query(`SELECT command FROM terminal_processes2 WHERE userid = '${userid}' AND username = '${username}'`);
            
        if (processRunning.length > 0){ 
            socketMessage = `<p>${socket.name}@${remoteip}:-$ terminal already running command '${processRunning[0].command}'</p>`
            //send command only to user
            await io.to(socket.id).emit("terminal", socketMessage)
        }else{
            socketMessage = `<p>${username}@${remoteip}:-$ ${command} ${args}</p>`
            //send command to the stack
            await db.query(`INSERT terminal_processes2 SET ?`, {userid:userid, username:username, command:command, commandData:JSON.stringify(commandData)})
            //send command to user and loggers
            
            await emitCommand(socket, socketMessage)    
        }
    }

    

    
}

//Remove HTML from string
async function sanitize(text){
    //begin parsing the CMD and args
    return text        //sanitize the text
    .replace(/&/g, '&amp;')   //Remove &
    .replace(/</g, '&lt;')    //Remove <
    .replace(/>/g, '&gt;')    //Remove >
    .replace(/"/g, '&quot;')  //Remove " 
    .replace(/'/g, '&#039;')  //Remove '
}

//Custom logging function
async function drazLog(type, logString){
    let log = new Object();
    log.logString = logString
    log.type = type
    timestamp = new Date().toLocaleTimeString([], {year:'numeric', month:'numeric', day:'numeric', hour: '2-digit', minute:'2-digit'});
    console.log(`[DRAZLOG: '${log.type}' (${timestamp})] \n${log.logString}\n\n`)
    console.log(" ")
    if (!log.type.startsWith("DEBUG")){
        //send to database as debug log
        db.query(`INSERT drazlogs SET ?`, { 'logtype':log.type, 'logdata': log.logString ,'logtime':timestamp}, (error) => {
            //console.log("Backing up chat to db")
            if(error){
                drazLog("DEBUG-ERROR"`ERROR LOGGING LOGS?!? \n${error}`)
            }             
        });
    }
}

//START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});
console.log(`Server started on port ${port} ${__dirname}`);
