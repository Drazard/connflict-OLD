//WSS 'wss://www.slavehack2.com/wss2'
const cheerio = require('cheerio');
const mysql = require("mysql");
const dotenv = require("dotenv");

dotenv.config({ path: './.env' })
//console.log("WSS STARTED")
var userMap = new Map();


function Database() {
    this.connection = mysql.createConnection({
      host     : process.env.DATABASE_HOST,
      user     : process.env.DATABASE_USER,
      password : process.env.DATABASE_PASS,
      database : 'sh2_db',
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

  //testing db
  async function test(){
    var dbTest = await db.query('SELECT 1');
    //console.log("DB TEST:",dbTest)
  }
test()
  
  
function main(){

  try {
      var WebSocketClient = require('websocket').client;
      var client = new WebSocketClient();
  
      client.on('connectFailed', function(error) {
          //console.log('Connect Error: ' + error.toString());
          process.exit()
      });
      
      client.on('connect', function(connection) {
          //console.log('WebSocket Client Connected');
          connection.on('error', function(error) {
              //console.log("Connection Error: " + error.toString());
              process.exit()
          });
          connection.on('close', function() {
              //console.log('echo-protocol Connection Closed');
              process.exit()
              return main()
          });
          connection.on('message', async function(message) {
            //console.log(message);
              if (message.type == 'update'){
                  return console.log("message",message)
              }
              if (message.type === 'utf8') {
                  //console.log("Received: '" + message.utf8Data + "'");   
                  var data = JSON.parse(message.utf8Data)
                  //console.log("data.type",data.type)
                  if (data.type == 'update'){
                      var timestamp = new Date().toLocaleTimeString();
                      data = data.content;
                      data.forEach( async function( val, idx ) {   
                          const $ = cheerio.load(val['username'])
                          var username = $(val['username']).text().trim()
  				                let socketdata = {'room':val['room'], 'username':username, 'id': val['owner'], 'message':val['message'], 'time':timestamp}
                          let logmessage = 
` 
[${timestamp}]      
${socketdata.username} (${socketdata.id})\n\n
\n        \n
      ${socketdata.message} 
`
                          console.log(logmessage)
                          await db.query(`INSERT log_sh2chat SET ?`, {'userid':socketdata.id, 'username':socketdata.username, 'message':socketdata.message})
  			            //socketdraz.emit('chat', socketdata);
                      });
                  }
                  if (data.type == 'typing'){
                      userMap.set(data.uid, {'username':data.name})
                      if (data.room != 0){
                          //data.room = userMap.get(data.room).username
                          try {
                              var typingTo = userMap.get(data.room).username
                          } catch (error) {
                              var typingTo = "unknown"
                              //console.log("error getting username")
                          }
                          
                          if (typingTo){
                              //console.log(data.name,"typing to",typingTo)
                          }else{
                              //console.log(data.name,"typing to",data.room)
                          }
                          
                      }
                      //console.log(data.name,"typing to main")
  
                  }
              }
              // if (message.type == 'update'){
              //     console.log("Received message: '" + message + "'");
              // }
          });
      });
      
  
      client.connect('wss://www.slavehack2.com/wss2');
  
  } catch (error) {
      console.log(error)
      process.exit()
  }
}


main()