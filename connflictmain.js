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

// var clients = [];

// setTimeout(() => {
//   io.emit("chat", `<p>(${timestamp}) Server was restarted</p>`);   
// }, 5000);



var serverRestart = 1;

// setTimeout(() => {
//   serverRestart = 0;
// }, 60*1000);

// db.query(`INSERT sockethandler SET ?`, {user_id:"0", event: "chat", data: `Server Restarted.`})
// var antiSpam = []; //declair an array of antiSpam to catch spammers
// setInterval(() => { antiSpam = []; }, 1000); //reset antiSpam array to be empty every 1 second.

//un-chatban everyone
db.query(`UPDATE users SET user_chatbanned = '0'`)

console.log("")

//reset all user ips
async function resetAllIps(){
    console.log("RESETTING ALL USER IPS TO RANDOM ONES!")
    var allusers = await db.query(`\
    SELECT user_name
    FROM users`)
    allusers.forEach(async(user)=>{
        let newip = funcs.randomIP()
        // if (user.username != "NPC"){

        console.log(`SETTING NEW IP FOR ${user.user_name} (${newip})`)

            await db.query(`
            UPDATE users 
            SET hostip = '${newip}'
            WHERE user_name = '${user.user_name}'`)

            await db.query(`
            UPDATE users 
            SET remoteip = '${newip}'
            WHERE user_name = '${user.user_name}'`)
        // }
    })
}

// resetAllIps()

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


//userSetup function
async function userSetup(socket){

    let userip = await findIP(socket.handshake.address) //get users ivp4 address '255.255.255.255'
    let usergeo = await geoip.lookup(userip)  //get user geodata from ip
    let usercookies = cookie.parse(socket.request.headers.cookie || ''); //Get cookies from request headers (authcookie is usercookies.draz)

    let gameData = {
        connectionInfo:{
            ip:userip,
            cookie:usercookies.draz,
            geoInfo:{
                country:usergeo.country, state:usergeo.region, city:usergeo.city, timezone:usergeo.timezone
            },
            useragent:socket.request.headers['user-agent']
        }
    }

    var authError, authData = await db.query(`
        SELECT *
        FROM users 
        WHERE user_logintoken = '${usercookies.draz}'`)

        //check if we got any gamedata
    if (authError){
        console.log("ERROR AUTHENTICATING USER")
        return socket.disconnect();
    } 
        //check if we got any gamedata
    if (!authData[0]) { 
        drazLog("ERROR-authUser","USER DOES NOT EXIST??")
        return socket.disconnect();
    }
    
    //build the gameData object
    authData = authData[0]
    gameData = {
        userid:authData.user_id,
        username:authData.user_name,
        usernameColour:authData.chat_color,
        bannedGame: authData.user_banned,
        bannedChat:authData.user_chatbanned,
        isAdmin:authData.user_admin,
        activated:authData.user_activated,
        socketid:socket.id,
        hostip:authData.hostip,
        remoteip:authData.remoteip,
        connectionInfo:{
            ip:userip,
            cookie:usercookies.draz,
            geoInfo:{
                country:usergeo.country, state:usergeo.region, city:usergeo.city, timezone:usergeo.timezone
            },
            useragent:socket.request.headers['user-agent']
        }
    }

    //bancheck
    if (gameData.bannedGame != 0) { return socket.disconnect()}

    return gameData
}

async function notifyLogin(gameData){
    await io.to(gameData.userid).emit("chat", `${gameData.username}@${gameData.hostip} online.`)
    let error, loggers = await db.query(`
            SELECT user_id, user_name, hostip, remoteip
            FROM users
            WHERE remoteip = '${gameData.hostip}' `) //OR vps_hostip = '${ip}'

    if(error){
        return drazLog("ERROR- emitcommand",`ERROR within the emitCommand function`)
    }
    //console.log("users that are connected: ",emitSuccess)
    loggers.forEach( async (logger) => {
        if (logger.hostip != gameData.hostip){
            console.log(`letting ${logger.user_name} know that ${gameData.username} has logged in`)
            io.to(logger.user_id).emit("log", `<p>${gameData.username}@${gameData.hostip} came online.`)
        }
        
    });
}

async function findIP(string){
    let regex = /(\d+\.+){3}\d+/gm;
    // let match = 'unknown'
    let match = string.match(regex)[0]
    //console.log(`IP MATCH: ${match}`)
    if (match === undefined){
        return "unknown?"
    }
    return match
    
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
        drazLog("ERROR-Chat History","Something went wrong with the chat history")
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
async function showCmdHistory(gameData){
    let error, cmdHistory = await db.query(`
    SELECT * FROM (
        SELECT * FROM log_terminal
        WHERE userid = '${gameData.userid}'
        ORDER BY id DESC LIMIT 50 
    ) 
    sub ORDER BY id ASC
    `)
    
    if(!cmdHistory[0]){
        // drazLog("ERROR-CMD History","No history found")
    }else{
        await io.to(gameData.userid).emit('cls', `Clearing your terminal :D`)
        cmdHistory.forEach(async (log) => {
            await io.to(gameData.userid).emit('terminal', `${log.historystring}<br>`)
        });           
    }   
}

//Chat Function
async function sendChat(gameData, chatData){

    //Check user isnt chat banned
    if (gameData.bannedChat != 0){
        return drazLog("CHAT BANNED",`Chat banned user ${socket.name} tried to send \nmessage: ${chatData.msg}`)
    }

    //set the usernames colour and time
    var colourName = `<span style="color:${gameData.usernameColour};">${gameData.username}</span>`   //set the user's colorname
    chatTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); //setting time

    //set the message string
    let messageString = `<span style="color:white">${chatData.msg}</span>`

    //combine chat string
    var chatString = `<small><small><i>(${chatTime})</i></small></small> [${colourName}] ${messageString}`

    //Log chat
    //drazLog("SENDCHAT",`User: ${socket.name} \nMessage: ${chatData.msg}`)

    //Send Chat to database for logging
    db.query('INSERT log_chat SET ?', { user_id:gameData.userid, log_chat_time: chatTime ,log_chat_username: colourName, log_chat_message:messageString}, (error, results) => {
        //console.log("Backing up chat to db")
          if(error){
                drazLog("ERROR-sendChat", `ERROR sending chat to the database ${error}`)
                return
          }             
        });

    //SEND CHAT TO USERS
    return await io.emit('chat', chatString)
}

//START SOCKETS
io.sockets.on('connection', async (socket) => { // When we get a new connection to the game (on connection)

    //send stocks
    setTimeout(() => {
        updateUsersStocks()
    }, 500);
    //setup basic anti spam
    setInterval(() => {
        socket.spam = 0
    }, 2500);

    //setup our user with their gameData
    var gameData = await userSetup(socket);

    //join a socket room that matches our userid
    socket.join(gameData.userid)

    //notify users we have logged in
    await notifyLogin(gameData)

    //allow the use of the terminal and chat
    socket.terminallock = false

    //log connection
    drazLog("CONNECTION",`${gameData.username} connected \nIP: ${gameData.connectionInfo.ip} \nGeoInfo: Country:${gameData.connectionInfo.geoInfo.country} State:${gameData.connectionInfo.geoInfo.state} City:${gameData.connectionInfo.geoInfo.city} \nTimezone: ${gameData.connectionInfo.geoInfo.timezone} \nUserAgent: ${gameData.connectionInfo.useragent}`)

    await showChatHistory(socket)

    await showCmdHistory(gameData)

    //Start listening for sockets.
    socket.onAny( async (event, data) => { //When we get any emit  (on any)

        //log connection
        drazLog(event,`User: ${gameData.username} (${gameData.connectionInfo.ip})\nEvent: ${event}\nData: ${JSON.stringify(data)}`)

        socket.spam = socket.spam + 1

        if (socket.spam > 4){
            socket.emit('chat', `<p ><h2 style="color:red">DISCONNECTED FOR SPAM</h2>`)
            socket.emit('terminal', `<p ><h2 style="color:red">DISCONNECTED FOR SPAM</h2>`)
            socket.disconnect()
        }

        gameData = await userSetup(socket);

        switch (event) {

            //Send a chat message
            case 'chat':
                //Log the chat
                
                //sanitize message
                message = await sanitize(data)
                
                //Create message object
                let chatData = {"user_id":gameData.userid, "msg": `<${gameData.hostip}> ${message}`}

                //drazLog("DEBUG-CHAT",`User: ${user.name} \nMessage: ${message}`)

                //send to chat engine
                await sendChat(gameData, chatData);

                break;

            //send a terminal command
            case 'command':
                //console.log("terminallock status:",socket.terminallock)
                if (socket.terminallock == true){return}
                else{
                    socket.terminallock = true
                    //sanizite the terminal data
                    let terminalData = await sanitize(data.command)

                    //seperate command and arguments
                    terminalData = terminalData.replace(",","").split(' ')

                    //set the current time in seconds
                    var currenttime = Math.floor(Date.now() / 1000)

                    //Create the command / args object
                    commandData = {
                        "userid":gameData.userid,
                        "username":gameData.username,
                        "userstring":`${gameData.username}@${gameData.remoteip}:-$`,
                        "command":terminalData[0],
                        "args":terminalData.slice(1),
                        "argslen":terminalData.slice(1).length,
                        "commandstring":`${terminalData[0]} ${terminalData.slice(1).join (' ')}`,
                        "hostip":gameData.hostip,
                        "remoteip":gameData.remoteip,
                        "cmdtime":currenttime,
                    }
                    
                    //check procesesses for duplicate entries from the same userid
                    let processRunning = await db.query(`SELECT userid, username FROM terminal_processes2 WHERE userid = '${gameData.userid}' AND username = '${gameData.username}'`);
                    //console.log(`PROCESS RUNNIG ${processRunning.length} ${processRunning} ${processRunning[0]}`)    
                    if (processRunning.length > 0){ 
                        return setTimeout(() => { 
                            socket.terminallock = false
                        }, 1000); 
                    }else{ 

                        //display command to user and loggers
                        commandData.response = `${gameData.username}@${gameData.remoteip}:-$ ${terminalData[0]} ${terminalData.slice(1).join (' ')}`
                        await emitCommand(commandData)

                        //See if command exists
                        //check the command exists
                        var commandExists = await db.query(`SELECT * FROM terminal_commands WHERE cmd_name = '${commandData.command}'`)
                        //console.log("commandExists returns:")
                        //console.log(commandExists)
                        //console.log(commandExists[0])
                        if(!commandExists[0]){
                            commandData.response = `${gameData.username}@${gameData.remoteip}:-$ ERROR: Command not found '${commandData.command}'`
                            await emitCommand(commandData)
                            return setTimeout(() => { 
                                socket.terminallock = false
                            }, 1000);
                        }
                        //set the initial command_run response
                        commandData.response = `${gameData.username}@${gameData.remoteip}:-$ ${commandExists[0].cmd_run}`
                        commandData.success = commandExists[0].success
                        commandData.fail = commandExists[0].fail

                        //reset spam counter on successful command
                        socket.spam = socket.spam = 0 

                        //release the terminal
                        setTimeout(() => { 
                            socket.terminallock = false
                        }, 1000);                         
                        
                        //send command to user and loggers
                        await emitCommand(commandData)    

                        //calcaulte command length
                        let commandexpire = (Math.floor(Date.now() / 1000)) + commandExists[0].time



                        //send command to the stack for processing
                        await db.query(`INSERT terminal_processes2 SET ?`, {userid:gameData.userid, username:gameData.username, hostip:gameData.hostip, remoteip:gameData.remoteip,command:terminalData[0], commandData:JSON.stringify(commandData), start:Math.floor(Date.now() / 1000), expire:commandexpire})
                    }
                }

                break;

            //Send a chat message
            case 'commandstart':
                var socketid = await getSocketbyId(data.userid)
                //console.log(`command response: ${JSON.stringify(data)}`)
                //console.log(`PROCESSENGINE: sendto ${data.username} socket: ${socketid} message: ${data.success}`)

                //send the message to ourselves
                await io.to(socketid).emit("terminal", data.result)

                //send the message to users connected to us
                io.sockets.sockets.forEach( async (client) => {
                    if (client.gameData.remoteip = data.hostip){
                        if (client.gameData.hostip != data.hostip) {
                            //console.log(`Senidng ${data.result} from (${data.name})to ${client.gameData.socketid} (${client.gameData.username})`)
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
                    //console.log(logger.user_id, data.userid)
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
                    await sendFinance(data);
                    //await io.to(socket.socketid).emit("chat",`<p style="color:yellow"> ${socket.name}</> <p style="color:red">  <h1 style="color:red">STOP</h1> FUCKING WITH THE GAME. D:< <p> This action has been logged.`)
                }
                
                //socket.emit('finainces', [funcs.randomIntB(100,10000),funcs.randomIntB(100,10000),funcs.randomIntB(100,10000),funcs.randomIntB(100,10000)])

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
        if (gameData.connectionInfo.ip == "112.213.37.147"){
            drazLog(event,`User: ${gameData.connectionInfo.ip}\nEvent: ${event}\nData: ${JSON.stringify(data)}`)
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

// //updateRemoteIp
// async function updateRemoteIp(process, newip){
//     await db.query(`
//     UPDATE user_vps 
//     SET vps_remoteip = '${newip}'
//     WHERE user_id = ${process.user_id}`);
//     return await showCmdHistoryprocess(newip)

// }

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
    FROM users
    WHERE hostip = '${ip}'`);
    //console.log(remoteip[0].vps_remoteip, "this is the db thingo for the thingie remoteip")
    return remoteip[0].user_id
}

async function clearTerminal(process){
    console.log(process.terminal, "DELETING ALL LOGS")
    await db.query("DELETE FROM `log_terminal` WHERE `terminalip` = '"+await getRemoteIp(process.user_id)+"'");
    return await showCmdHistoryprocess(process.terminal);
}

//notify when user has logged in - "temrinal"


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

//get files from connected ip
async function getFilesFromRemoteIp(socket){
    return await db.query(`
    SELECT * 
    from fileList
    WHERE fileLocation = ${await getRemoteIp(socket.userid)}`);
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

async function emitCommand(commandData){
    //set the log message
    var message = commandData.response
    //send the message to ourselves
    await io.to(commandData.userid).emit("terminal", message)

    //send a log to our remote ip
    let remoteid = await getRemoteId(commandData.remoteip)
    await io.to(remoteid).emit("log", message)
    
    //standard log for all commands
    await db.query(`INSERT log_terminal SET ?`,{
        userid: commandData.userid,
        username: commandData.username, 
        hostip: commandData.hostip, 
        remoteip: commandData.remoteip,
        command: commandData.command, 
        args: commandData.args.toString(), 
        historystring: message
    })
    
    //send log to all our loggers
    let loggers = await db.query(`
    SELECT hostip, user_id, user_name, remoteip
    FROM users
    WHERE remoteip = '${commandData.hostip}' `)

      
    //emit the command to every 'logger' that we find
    loggers.forEach( async (logger) => { 
        //console.log(`${logger.user_name} is logged into ${commandData.username}`)
        if (logger.user_id != commandData.userid){
            io.to(logger.user_id).emit("log", message)
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
    db.query(`INSERT drazlogs SET ?`, { 'logtype':log.type, 'logdata': log.logString ,'logtime':timestamp}, (error) => {
        //console.log("Backing up chat to db")
        if(error){
            console.log("ERROR DRAZLOG\n",error)
            drazLog("DEBUG-ERROR"`ERROR LOGGING LOGS?!? \n${error}`)
        }             
    });
}



//////////////////////////////////////////////////-----------------------------COMMANDS ENGINE----------------------////////////////////////////////////////



async function commandEngine(){

    //get a list of processes on the stack
    let processes = await db.query(`SELECT * FROM terminal_processes2`) //get all of the live processes

    processes.forEach(async (process) =>{
        //find loggers
        var loggers = await db.query(`
            SELECT hostip, user_id, user_name, remoteip
            FROM users
            WHERE remoteip = '${process.hostip}' `)

        //setup the commanddata variable
        var commandData = JSON.parse(process.commandData)
        var currenttime = Math.floor(Date.now() / 1000)

        //check to see if the process has expired
        if (process.expire > currenttime){  //if the process hasnt expired
            //console.log(`command: ${commandData.command} expires: ${process.expire} currenttime:${currenttime} (${process.expire - currenttime}) left`)
            let processslength = process.expire - process.start
            let timeelapsed =  currenttime - process.start
            processpercent = ((timeelapsed / processslength) * 100).toFixed(2)
            // await io.to(process.userid).emit("process", `${commandData.command} (${process.expire - currenttime}) [Timeleft: ${timeelapsed} ] (total: ${processslength} ) [%${processpercent}]`)
            await io.to(process.userid).emit("process", `${commandData.command} [%${processpercent}]`)

            //find all loggers and send
            //send log to all our loggers
            

            
            //emit the command to every 'logger' that we find
            loggers.forEach( async (logger) => { 
                //console.log(`${logger.user_name} is logged into ${commandData.username}`)
                if (logger.user_id != commandData.userid){
                    
                    await io.to(logger.user_id).emit("logprocess", `${commandData.command} (${process.expire - currenttime}) `)
                }  
            });

        }else{  //if the process is ready to commence

            loggers.forEach( async (logger) => { 
                //console.log(`${logger.user_name} is logged into ${commandData.username}`)
                if (logger.user_id != commandData.userid){
                    await io.to(logger.user_id).emit("logprocess", "")
                    await io.to(logger.user_id).emit("log", `${commandData.userstring} ${commandData.commandstring}`)
                }  
            });

            //console.log(`Completing command ${commandData.command}`)
            //wipe process from user
            await io.to(process.userid).emit("process", "")

            //wipe process from loggers
            await io.to(process.userid).emit("logprocess", "")

            //delete the entry so the user may make another command
            await db.query(`DELETE FROM terminal_processes2 WHERE id = ${process.id}`)

            //finish the command
            
            executeCommand(commandData)

            
        }
    })

}

async function executeCommand(commandData){
    switch (commandData.command.toLowerCase()) {
        case 'help':
            let help = await db.query(`
                SELECT cmd_name, cmd_args, cmd_desc
                FROM terminal_commands
            `)

            var helplist = [`<br>command : description<br><br>`]
            help.forEach(async (command) =>{
                helplist.push(`${command.cmd_name} : ${command.cmd_desc}<br>`)
            })
            commandData.response = helplist.join(" ")
            emitCommand(commandData)
            break;
        case 'ssh':
           // console.log(commandData)
            let ipExists = await db.query(`
            SELECT hostip
            FROM  users
            WHERE hostip = '${commandData.args[0]}'`);
            if (ipExists[0]){
                //console.log("logged into",ipExists[0], ipExists)
                await updateRemoteIp(commandData)
                commandData.response = `'${commandData.args[0]}' Connection Established`
                let remoteid = await getRemoteId(commandData.args[0])
                await io.to(remoteid).emit("log", `${commandData.username}@${commandData.hostip} connected.`)
                await emitCommand(commandData)
            }else{
                commandData.response = `Connection refused: '${commandData.args[0]}' Not found`
                await emitCommand(commandData)
            }
            break;
        
        case 'dc':
            // set remoteip to same as host
            await db.query(`
            UPDATE users
            SET remoteip = '${commandData.hostip}'
            WHERE user_id = '${commandData.userid}'`);

            //emit to all users that we disconnected
            commandData.response = `Connection terminated: '${commandData.remoteip}'`
            emitCommand(commandData)
            break;
        case 'cls':
            await db.query(`
            DELETE FROM log_terminal WHERE userid = '${commandData.userid}'
            `)
            await io.to(commandData.userid).emit('cls', `Clearing your terminal :D`)
            commandData.response = `Terminal cleared.`
            emitCommand(commandData)
        break;
        default:
            commandData.response = `Uhhh, sorry!! i havent finished this command yet!!`
            emitCommand(commandData)

            break;
    }

}

//updateRemoteIp
async function updateRemoteIp(commandData){
    //check if the remote ip exists

    //change remote ip
    await db.query(`
    UPDATE users 
    SET remoteip = '${commandData.args[0]}'
    WHERE user_id = ${commandData.userid}`);
    //tell client to update
}

setInterval(() => {
    //test if users are even online
    commandEngine()
}, 100);
/////////////////////////////////////////////////////////////////////////////////////////STOCK STUFF////////////////////////////////////////////////////////////////////////////////////

async function updateUsersStocks(){

    var financeObject = {}

    var num = 60*24 //last 1440 (24 hours)
    var stocklist = ['BTC', 'BURST', 'coin1', 'coin2', 'coin3', 'coin4', 'coin5', 'stock1', 'stock2', 'stock3', 'stock4', 'stock5', 'stock6', 'stock7', 'stock8', 'stock9', 'stock10', 'stock11', 'stock12', 'stock13', 'stock14', 'stock15', 'stock16', 'stock17', 'stock18', 'stock19', 'stock20']
    //console.log("stocklist", stocklist)
    for (var stockName in stocklist) {

      var currentStockName = stocklist[stockName]

      var stocklog = await db.query(`
      SELECT ${currentStockName}
      FROM log_stockchanges
      ORDER BY id DESC
      LIMIT ${num}
      `)

      var stockArray = []
      for (var value in stocklog) {
        let stockValue = stocklog[value][currentStockName]
        

        //console.log(stocklog[value][currentStockName])
        //console.log(stocklist[stockName])
        stockArray.push(stockValue)
      }
      let name = stocklist[stockName]
      financeObject[name] = stockArray
      
    }
    //console.log(financeObject)
    //console.log("sending data to clients")
    return io.emit("chartdata", financeObject)

    //return socket.emit("finances", stocklog)
}

setInterval(() => {
    updateUsersStocks()
}, 1000*60);

// ------------------------------------------------------------------------------------------------------------START SERVER
server.listen(port, () => {
  console.log("server starting on port : " + port)
});
console.log(`Server started on port ${port} ${__dirname}`);
