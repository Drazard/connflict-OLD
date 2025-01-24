const mysql = require("mysql");
const dotenv = require("dotenv");
const { io } = require("socket.io-client");
const socket = io("https://connflict.com:3000");
//setting envpath
dotenv.config({ path: './.env' })

console.log("FINANCES STARTED")

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

updateBitcoin()

var updateTick = 60
setInterval(() => {
    updateBitcoin()
    
}, updateTick*1000);

var desiredPrice = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
//console.log("desiredPrice", desiredPrice)
setInterval(() => {
    desiredPrice = (Math.random() * (10000 - 1000) + 1000).toFixed(2);
    //console.log("desiredPrice", desiredPrice)

}, 1000*60*60);

async function deleteDatabase(){
    await db.query(`
    DELETE FROM bitcoin
    WHERE id > 1
    `)
    
}
async function updateBitcoin(){
    try {
        //grab the new bitcoin value
        let bitcoin_last = await getBitcoinLast()
        let newBitcoin = await setBitcoin(bitcoin_last)
        //console.log("Bitcoin Value:",newBitcoin)
        //insert new bitcoin value
        await db.query(`
        INSERT bitcoin
        SET value = ${newBitcoin}
        `)
        console.log(`New BTC price ${newBitcoin} sent to database\n-----------------------------------------------------------`)
    } catch (error) {
        console.log(error)
        return process.exit(1)
    }
    
}


  async function getBitcoinLast(){
    let bitcoin_last_error, bitcoin_last = await db.query(`
    SELECT value
    FROM bitcoin
    ORDER BY id DESC
    LIMIT 1
    `)

    if (bitcoin_last_error){
        //handle error for fetching the last bitcoin
        return console.log("ERROR WITH GRABBING BITCOIN LAST")
    }   else {
        return bitcoin_last[0].value
    }
  }

async function getBitcoinLastTen(){
    let num = 60*24
    let bitcoin_last_error, bitcoin_lastTen = await db.query(`
    SELECT value
    FROM bitcoin
    ORDER BY id DESC
    LIMIT ${num}
    `)

    if (bitcoin_last_error){
        //handle error for fetching the last bitcoin
        return console.log("ERROR WITH GRABBING BITCOIN LAST")
    }   else {
        var last_ten = []
        var last_ten_lables = []
        for (var i in bitcoin_lastTen) {
            last_ten.push(bitcoin_lastTen[i].value)
            last_ten_lables.push(i)
        }

        return {"btcvalues":last_ten.reverse(), "lables": last_ten_lables}
    }
}

  //define the math for the new bitcoin value
async function setBitcoin(bitcoin_last){
    let min = 0.01
    let max = 0.10

    if(bitcoin_last < (desiredPrice * 0.80) ){
        //console.log("PRICE TOO LOW")
        var randIncrease = 0.80
    }
    else if(bitcoin_last > (desiredPrice * 1.20)){
        //console.log("PRICE TOO HIGH")
        var randIncrease = 0.20
    }
    else if( bitcoin_last < desiredPrice * 0.90 ){
        //console.log("PRICE SORTA LOW")
        var randIncrease = 0.60
    }
    else if( bitcoin_last > desiredPrice * 1.10 ){
        //console.log("PRICE SORTA HIGH")
        var randIncrease = 0.40
    }
    else {
        //console.log("PRICE STABLE")
        var randIncrease = 0.50
    }

    let swingPercent = (Math.random() * (max - min) + min).toFixed(3);
    //let swingPercent = 0.03
    let deviation = bitcoin_last * swingPercent
    
    let currentPrice = bitcoin_last
    let randnum = Math.random().toFixed(2)
    const rand = randnum < randIncrease
    //console.log("percent:",randIncrease)
    //console.log("result:",randnum, rand)
    if (rand){
        //console.log("++++",swingPercent, "%")
        var btcChange = currentPrice + deviation
        var btcFlip = "+"
    } else {
        //console.log("----",swingPercent, "%")
        var btcChange = currentPrice - deviation
        var btcFlip = "-"
    }
    btcChange = btcChange.toFixed(2)
    deviation = deviation.toFixed(2)
    
    let changeStats = `
    Last:     ${bitcoin_last}
    Desired:  ${desiredPrice}
    Odds:     ${randIncrease}
    result:   ${randnum} 
    swing:    ${btcFlip}${deviation} (${swingPercent}%) 
    new:      ${btcChange}

    last 10: ${await getBitcoinLastTen().btcvalues}
    `
    await console.log(changeStats)
    await sendResults(btcChange)
    return btcChange
}

async function sendResults(results){
    
    // socket.onAny((eventName, ...args) => {
    //     //console.log(eventName, args)
    //   });
    //socket.emit("finance", {"BTC":results});
    socket.emit("finances", await getBitcoinLastTen())
    console.log(`New BTC price ${results} sent to server\n`)
}
//wipe database and return to the defualt 5000
//deleteDatabase()

//start engine
async function testFunction(){
    setInterval(() => {
        console.log(setBitcoin(5000))
    }, 1*1000);

    }

function test(){
    try {
        testFunction()
    } catch (error) {
        console.log("ERROR SOMETHIGN BROKE")
    }
}  


function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
  }
