//Requires
const mysql = require("mysql");
const funcs = require('./functions'); // My module
const dotenv = require("dotenv");
dotenv.config({ path: './.env' })

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

//TimeStamps
timestamp = new Date().toLocaleTimeString(); //console.log(timestamp); //Timestamp (2:19:30 am)
datestamp = new Date().toLocaleDateString(); //console.log(datestamp) // Datestamp (17/02/2021)
datetimestamp = new Date().toLocaleString(); //console.log(datetimestamp) // Datestamp (17/02/2021, 2:19:30 am)

module.exports = {
    authUser: async (drazToken) => {
        let authError, authSuccess = await db.query(`SELECT * FROM users WHERE user_logintoken = '${drazToken}'`)
        if(authError){
            return console.log("Authentication error")
        }else if(authSuccess && authSuccess[0]){
            //console.log(`SUCCESS! loginToken: `, authSuccess[0].user_logintoken)
            return authSuccess[0]
        }else{
            //console.log("USER NOT LOGGED IN?")
            return
            
        }
    },
    vpsData: async (userid) => {
        let vpsError, vpsSuccess = await db.query(`SELECT * FROM user_vps WHERE user_id = '${userid}'`)
        if(vpsError){
            return console.log("Authentication error")
        }else if(vpsSuccess && vpsSuccess[0]){

            return vpsSuccess[0]
        }else{
            console.log("USER VPS NOT FOUND")
            console.log(vpsSuccess);
            return
             
        }
    },
    create: async (ipaddr, id, cmd, cmd_args) => {
        //Create software
        let allowedCreate = ['btcminer', 'burstminer', 'klog']
        if(cmd == 'create' && allowedCreate.includes(cmd_args[0]) && cmd_args[1]){
            //check we have hard drive space!
            

            //if we have enough hard drive space
            var userHardDrive = await db.query(`SELECT harddrive from user_hardware WHERE user_id = '${id}'`)
            userHardDrive = userHardDrive[0].harddrive
            //console.log("harddrive Space", userHardDrive)

            var userSoftware = await db.query(`SELECT software_size from gamesoftware WHERE software_location = '${id}'`)
            //console.log("usersoft", userSoftware)
            
            var softwareSpace = 0;
            for (i=0;i<userSoftware.length; i++){
                softwareSpace += userSoftware[i].software_size
            }
            //console.log("softspace ", softwareSpace)

            if(softwareSpace >= userHardDrive){
                return `User has no free space!!`
            }else{
                const rexgex = /[^\w]/gm
                var sname = cmd_args[1]
                .replace(rexgex,"")
                
                // if (cmd_args[0] == "klog"){
                //     var sname = "keylogger"
                // }else{
                //     var sname = cmd_args[1]
                // }
                await db.query(`INSERT gamesoftware SET ?`, {software_creator: id, software_name: sname, software_type: cmd_args[0], software_location: id, creator_ip: ipaddr})   
                return `${cmd_args[0]} '${sname}' Created!`
            }   
        }  else {
            return `'${cmd_args[0]}'  is invalid software`
        }       
    },
    remotedelete: async (ip, soft_id) => {
        let termerror, termsuccess = await db.query(`SELECT user_id FROM user_vps WHERE vps_hostip = '${ip}'`)
        if(!termsuccess[0]){
            return `ERROR WITH CONNECTION`
        }
        termsuccess = termsuccess[0].user_id
        //console.log("Deleting",termsuccess)
        //Delete software
        var userSoftware = await db.query(`SELECT software_id from gamesoftware WHERE software_location = '${termsuccess}'`)
        var softwareList = new Array()
        for(var i =0;i<userSoftware.length; i++){
            softwareList.push(userSoftware[i].software_id)
        }
        //console.log("softid ", soft_id)
        //console.log("software found ",softwareList)
        if (softwareList.includes(parseInt(soft_id))){
            await db.query(`DELETE from gamesoftware WHERE software_id = '${soft_id}'`)
            return `File Deleted!` 
        }else{
            //console.log(softwareList)
            return `File not found!` 
        }
             
    },
    localdelete: async (id, soft_id) => {
        var userSoftware = await db.query(`SELECT software_id from gamesoftware WHERE software_location = '${id}'`)
        var softwareList = new Array()
        for(var i =0;i<userSoftware.length; i++){
            softwareList.push(userSoftware[i].software_id)
        }
        //console.log("softid ", soft_id)
        //console.log("software found ",softwareList)
        if (softwareList.includes(parseInt(soft_id))){
            await db.query(`DELETE from gamesoftware WHERE software_id = '${soft_id}'`)
            return `File Deleted!` 
        }else{
            //console.log(softwareList)
            return `File not found!` 
        }
             
    },
    upload: async (ipaddr, id, cmd_args, connectedto) => {
        // get userid of connectedto
        //console.log(`connected to ${connectedto}`)
        var remoteIP = await db.query(`SELECT user_id from user_vps WHERE vps_hostip = '${connectedto}'`)
        let remoteID = remoteIP[0].user_id
        //console.log(`connected to ${connectedto} ${remoteIP[0].user_id}`)
        //check we arent urselves
        if(id == remoteID){
            return `You are connected to yourself, nice try.`
        }
        //if we have enough hard drive space
        var userHardDrive = await db.query(`SELECT harddrive from user_hardware WHERE user_id = '${remoteID}'`)
        userHardDrive = userHardDrive[0].harddrive
        //console.log("harddrive Space", userHardDrive)
        var localSoftware = await db.query(`SELECT * from gamesoftware WHERE software_location = '${id}'`)
        //console.log(localSoftware)
        let localsoftArray = []
        var softName;
        var softType;
        var softID;
        for(var i=0;i<localSoftware.length;i++){
            if (localSoftware[i].software_id == cmd_args){
                
                softName = localSoftware[i].software_name
                softType = localSoftware[i].software_type
                softID = localSoftware[i].software_id
                softOwner = localSoftware[i].software_creator
                //console.log(softID)
                //console.log(softName)
                //console.log(softType)
            }
        }
        if(softID){
            //console.log("software exists.. continues")
        }else{
            return `software id '${cmd_args}' does not exist`
        }
        var userSoftware = await db.query(`SELECT * from gamesoftware WHERE software_location = '${remoteID}'`)
        //console.log("usersoft", userSoftware)
        for (var i = 0;i<userSoftware.length;i++){
            //console.log("softType", softType)
            //console.log("softOwner", softOwner)
            //console.log("remote creatoe", userSoftware[i].software_creator)
            //console.log("remote type", userSoftware[i].software_type)
            if ( (userSoftware[i].software_creator == softOwner) && (userSoftware[i].software_type == softType) ){
                return `${connectedto} already has one of your ${softType}'s`
            }
        }
        var softwareSpace = 0;
        for (i=0;i<userSoftware.length; i++){
            softwareSpace += userSoftware[i].software_size
        }
        //console.log("softspace ", softwareSpace)

        
        if(softwareSpace >= userHardDrive){
            return `User has no free space!!`
        }else{
        //await db.query(`INSERT gamesoftware SET ?`, {software_creator: id, software_name: cmd_args[1], software_type: cmd_args[0], software_location: id})   
        await db.query(`INSERT gamesoftware SET ?`, {software_creator: id, software_name:softName, software_type: softType, software_location: remoteID, creator_ip: ipaddr})
        return `${cmd_args} Uploaded to ${connectedto}`
        }   
    },       
    userVps: async (ip) => {
        let error, success = await db.query(`SELECT * FROM user_vps WHERE vps_hostip = '${ip}'`)
        if(error){
            return console.log("Authentication error")
        }else if(success && success[0]){
            //console.log(`SUCCESS! loginToken: `, authSuccess[0].user_logintoken)
            return success[0]
        }
    },
    help: async () => {
        let commandsList = [
        "create [create] [softwaretype] [softwarename] ",
        "del [del] [software_id]", 
        "ls (list files on the curretn dir)", 
        "upload - [upload] [softwareid]", 
        "connect - [connect] [ip]", 
        "disconnect (disconnect form current mcahine)", 
        "cls (clear temrinal)",
        "crypto (shows current wallets)",
        "logout (logout of the game)",
        "proxy [proxy] [ip]",
        "software types: <br> btcminer, burstminer, klog"
        
        ]
        let response = `<li> Commands: </li>`
        for(var i=0;i<commandsList.length;i++){
            response = response += `<li>-${commandsList[i]}</li>`
        }
        return response;

    },
    connect: async (host_id, command_arg) => {
        let cmderror, cmdsuccess = await db.query(`SELECT vps_hostip FROM user_vps WHERE vps_hostip = '${command_arg}'`)
        if(cmdsuccess && cmdsuccess[0]){
            let historyerror, history = await db.query(`SELECT vps_history FROM user_vps WHERE vps_hostip = ?`, [command_arg])
            await db.query(`UPDATE user_vps SET vps_remoteip = '${command_arg}' WHERE user_id = '${host_id}'`)
            //console.log("histroy of connected",history[0].vps_history)
            results = {result: "success", data: `<p>${command_arg} History: </p><p>${history[0].vps_history}</p>`}
            return results
        }else{
            results = {result: "fail", data: `IP address '${command_arg}' not found`}
            return results
        }

    },
    disconnect: async (user_id) => {
        await db.query(`UPDATE user_vps SET vps_remoteip = ? WHERE user_id = ?`, ["NULL", user_id])
        return `Disconnected`
    },
    remotels: async(user_id, hostip, remoteip) => {
        try {
            let cmderror, cmdsuccess = await db.query(`SELECT user_id FROM user_vps WHERE vps_hostip = '${remoteip}'`)
            if(!cmdsuccess[0]){
                await db.query(`UPDATE user_vps SET vps_remoteip = '${hostip}' WHERE user_id = '${user_id}'`)
                return `IP '${remoteip}' NOT found IP no longer valid? ( Disconnecting )`
            }
            lsTarget = cmdsuccess[0].user_id;
            //console.log("LS SUCCESS, looking for files owned by: ",lsTarget)
            let softerror, softsucc = await db.query(`SELECT * FROM gamesoftware WHERE software_location = '${lsTarget}'`)
            if(softsucc[0]){
                //console.log(results)
                let lsResults = `<li> ${remoteip} - FILES</li><li> [id] software_name (type)</li>
                `;
                for(i =0;i<softsucc.length;i++){
                    //console.log(JSON.stringify(results))
                    lsResults = lsResults+ `<li>[${softsucc[i].software_id}] ${softsucc[i].software_name} (${softsucc[i].software_type})</li>
                    `    
                }
                //console.log(lsResults)
                return `${lsResults}`
                //socket.emit("cmd", `::localhost> ${JSON.stringify(results)}`)
            }else{
                return `<li> ${remoteip} - FILES</li> <li>No Files Found.</li>`
            }
        } 
        catch (error) {
            console.log(error)
        }
    },
    localls: async(id) => {
        try {
            let softerror, softsucc = await db.query(`SELECT * FROM gamesoftware WHERE software_location = '${id}'`)
            if(softsucc[0]){
                //console.log(results)
                let lsResults = `<li> localhost - FILES</li><li> [id] software_name (type)</li>
                `;
                for(i =0;i<softsucc.length;i++){
                    //console.log(JSON.stringify(results))
                    lsResults = lsResults+ `<li>[${softsucc[i].software_id}] ${softsucc[i].software_name} (${softsucc[i].software_type})</li>
                    `    
                }
                //console.log(lsResults)
                return `${lsResults}`
                //socket.emit("cmd", `::localhost> ${JSON.stringify(results)}`)
            }else{
                return `<li> localhost - FILES</li> <li>No Files Found.</li>`
            }
        } 
        catch (error) {
            console.log(error)
        }
    },
    crypto: async (host_id) => {
        let btcerror, btc = await db.query(`SELECT btc_amount from btc WHERE user_id = '${host_id}'`)
        let buresterror, burst = await db.query(`SELECT burst_amount from burst WHERE user_id = '${host_id}'`)
        try {
            return `
            <li>Bitcoin: ${btc[0].btc_amount} </li>
            <li>Burstcoin: ${burst[0].burst_amount}</li>`
        } catch (error) {
             //REGISTERING NEW BURST
             console.log(error)
             console.log("ERROR IN CRYPTO")
             let bursterr2, burstsucc = await db.query(`SELECT * FROM burst WHERE user_id = ${host_id}`)
             //console.log(burstsucc)
             if(!burstsucc || !burstsucc[0]){
                 let randIP = funcs.randomIP();
                 console.log("REGISTERING NEW BURST")
                 await db.query(`INSERT burst SET ?`, {user_id: host_id})
             }
             //REGISTERING NEW BTC
             let btcerr2, btcsucc = await db.query(`SELECT * FROM btc WHERE user_id = ${host_id}`)
             //console.log(btcsucc)
             if(!btcsucc || !btcsucc[0]){
                 let randIP = funcs.randomIP();
                 console.log("REGISTERING NEW BTC")
                 await db.query(`INSERT btc SET ?`, {user_id: host_id})
             }
             
             return `One or more Crypto missing! Accounts created! Use command 'crypto' again`
        }
        
    },
    proxy: async (ip, id) => {
        let proxyError, proxy = await db.query(`SELECT vps_hostip FROM user_vps WHERE vps_hostip = ?`, [ip])
        if(proxy[0]){
            //set the proxy.
            await db.query(`UPDATE user_vps SET vps_proxy = '${ip}' WHERE user_id = '${id}'`)
            return `SUCCESS: setting ${proxy[0].vps_hostip} as new proxy server`
        }else{
            return `ERROR: Cannot use ${ip} as proxy, does not exist`
        }
    }   
        
}

//Running succesfully
let timeStamp_log = new Date().toLocaleString();
console.log(`(${timeStamp_log}) CMD. library - LOADED SUCCESFULLY`);
