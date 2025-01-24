const mysql = require("mysql");
const dotenv = require("dotenv");
const { io } = require("socket.io-client");
const socket = io("https://connflict.com:3000");
//setting envpath
dotenv.config({ path: './.env' })

console.log("PROCESSES ENGINE STARTED")

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

  //keep the connection to the database open
setInterval(() => {
    db.query('SELECT 1');
  }, 5*60*1000);



//begin process engine

setInterval( async () => {
    
    let processes = await db.query(`SELECT * FROM terminal_processes2`) //get all of the live processes

    processes.forEach( async (process) =>{
        //set variables for the command info
        var processid = process.id
        var commandData = JSON.parse(process.commandData)

        // var userid = process.userid
        // var username = process.username
        // var args = process.args
        // var cmddate = process.date / 1000
        // var cmdowner = process.owner
        // var cmdorigin = process.origin
        //console.log(`PROCESSINFO: ---- : ${JSON.stringify(process)}`)
        //console.log(`CMDINFO:
        //cmd: ${cmd} args: ${args} date: ${cmddate} owner: ${cmdowner} ogigin: ${cmdorigin}`)

        

        //check the command exists
        let command = await db.query(`SELECT * FROM terminal_commands WHERE cmd_name = '${commandData.command}'`)

        //if the command doesnt exist, let use know.
        if (!command[0]){ 
            //console.log("deleting process " + processid)
            commandData.result = `ERROR: command does not exist '${commandData.command}'`
            sendTerminal(commandData)
            await db.query(`DELETE FROM terminal_processes2 WHERE id = ${processid}`)
            } //if we do not find a command, return "does not exist"

        
        else{

            //set command info to commandData object
            commandData.success = command[0].cmd_success
            commandData.fail = command[0].cmd_fail
            commandData.running = command[0].cmd_running
            commandData.reqargs = command[0].cmd_args.split(" ")

            //set expiry date for command
            var cmdtime = command[0].time
           // console.log("cmdtime",cmdtime)
            //console.log("commandtime",cmdtime)
            //set current time
            var currentTime = Math.floor(Date.now() / 1000) //set the current time
            var cmdexpire = commandData.time + cmdtime
            //console.log("commandData.time",commandData.time)
            var cmdtimeleft = cmdexpire - currentTime
            //console.log(`Currenttime is: ${currentTime} CMD '${commandData.command}' expires @ ${cmdexpire} timeleft: ${cmdtimeleft}`)

            //check the args are correct
            console.log("args:",commandData.args)
            console.log("which is :",commandData.args.length,"args")
            console.log("we need this many args:",commandData.reqargs.length)
            console.log("Args we need are:",commandData.reqargs)
            console.log("Which has a lgnth of",commandData.reqargs[0].length)
            if (  (commandData.args.length < commandData.reqargs.length) && (commandData.reqargs[0].length > 0)  ){  
                var reqargsResponse = []
                await commandData.reqargs.forEach(async (arg) => {
                    reqargsResponse.push(`&lt;${arg}&gt;`) 
                })
                var reqargsResponsejoined = reqargsResponse.join(' ')
                commandData.result = `ERROR: missing args (${commandData.reqargs.length} required) Usage: ${commandData.command} ${reqargsResponsejoined}`
                sendTerminal(commandData)
                await db.query(`DELETE FROM terminal_processes2 WHERE id = ${processid}`)
            }
            else if (cmdexpire >= currentTime){ //waiting for command still
                commandData.processmessage = `${commandData.running} ( ${cmdtimeleft} )`
                await sendTerminalWaiting(commandData)
                //console.log(process.owner, process.command, command.cmd_running)
                
            } else{
                //command can now run

                //delete command from stack and run the command
                db.query(`DELETE FROM terminal_processes2 WHERE id = ${processid}`)

                //remove command countdown
                commandData.processmessage = ""
                sendTerminalWaiting(commandData)
                
                //set the command response to the default 'success' resposne
                commandData.result = command[0].cmd_success

                //attempt to allow the command to run
                runCommand(commandData)
                
            }
        }
  
    })
}, 1000);

async function runCommand(commandData){
    //check the host ip address is still the same - else fail

    //check target is till connected to origin ip address - else fail

    //check the remoteip still exists - else fail
    let command = commandData.command
    let args = commandData.args.split(",")
    console.log(command, args,commandData.args.split(",")[0])


    switch (commandData.command) {
        case 'help':
            commandData.result = `${commandData.command} will display all of the avalible commands and a descrition (not complete)`
            break;

        case 'test':
            commandData.result = `${commandData.command} is just a testing command, if you see this its worked.`
            break;
            
        case 'argstest':
            commandData.result = `${commandData.command} is just an args test cmd, if you see this its worked.`
            break;
        
            
        case 'ssh':
            let ipExists = await db.query(`
            SELECT vps_hostip
            FROM  user_vps
            WHERE vps_hostip = ${args[0]}`);
            if (ipExists[0]){
                console.log("logged into",ipExists[0], ipExists)
                updateRemoteIp(commandData)
                commandData.result = `'${args[0]}' Connection Established`
            }else{
                commandData.result = `Connection refused: '${args[0]}' Not found`
            }
            
            break;
        
             
        case 'touch':
            commandData.result = `${commandData.command} is what you would use to create a text file... when i finish coding it. (need to make nano command)`
            break;
        
            
        default:
            break;
    }
    await sendTerminal(commandData)//complete and send results of command
    //console.log("completing command",commandData.command,"for",commandData.username)
    
    
    sendTerminalWaiting(commandData)
    //finally delete 
    
}

async function sendTerminal(commandData){
    socket.emit("commandstart", commandData);  
}

async function sendTerminalWaiting(commandData){
    socket.emit("commandrunning", commandData);  
}

//updateRemoteIp
async function updateRemoteIp(commandData){
    //check if the remote ip exists

    //change remote ip
    await db.query(`
    UPDATE user_vps 
    SET vps_remoteip = '${commandData.args.split(",")[0]}'
    WHERE user_id = ${commandData.userid}`);
    //tell client to update
}