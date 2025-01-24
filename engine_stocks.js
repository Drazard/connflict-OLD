const mysql = require("mysql");
const dotenv = require("dotenv");
const { io } = require("socket.io-client");
const socket = io("https://connflict.com:3000");
//setting envpath
dotenv.config({ path: './.env' })

console.log("STARTING STOCKS")

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


///start stock engine

async function resetStocks(){
    var stockInfo = await db.query(`
    SELECT stock_name, stock_value_max
    FROM stocklist
    `)
    //console.log(stockInfo)
    for (const key in stockInfo) {
        //loop for each stock
        var stockName = await stockInfo[key].stock_name
        var maxPrice = await stockInfo[key].stock_value_max
        var initialMaxPrice

        switch (stockName) {
            case "BTC":
                initialMaxPrice = 12000
                var minChange = 0.85
                var maxChange = 0.50
            break;

            case "BURST":
                initialMaxPrice = 100
                var minChange = 0.75
                var maxChange = 0.50
            break;

            default:
                initialMaxPrice = (Math.random() * (20000 - 50) + 50).toFixed(3);
                var minChange = 0.85
                var maxChange = 0.50
            break;
        }
        
        
        var swingPercent = (Math.random() * (maxChange - minChange) + minChange).toFixed(3);

        var newMinStock = initialMaxPrice * swingPercent
        var newCurrentPrice = ((parseFloat(initialMaxPrice) + parseFloat(newMinStock)) * 0.5).toFixed(2)
        var newDesiredPrice = newCurrentPrice
        //console.log(`max price ${initialMaxPrice} newMinStock ${newMinStock}`)
        //console.log(`Updating ${stockName} with Current price: ${newCurrentPrice}`)

        await db.query(`
        UPDATE stocklist
        SET stock_value_current = ${newCurrentPrice}, stock_value_min = ${newMinStock}, stock_value_max = ${initialMaxPrice},  stock_value_desired = ${newDesiredPrice}
        WHERE stock_name = '${stockName}'
        `)
        
        console.log(`
        ${stockName}
        Min:           ${newMinStock}
        Max:           ${initialMaxPrice}
        Current:       ${newCurrentPrice}
        profit margin: ${(100 - (swingPercent * 100)).toFixed(2)}%
        `)
    } 
}

//get min and max values for stocks
async function getStockInfo(){
    //find min and max values
    var stockInfo = await db.query(`
        SELECT stock_name, stock_value_current, stock_value_min, stock_value_max, stock_value_desired
        FROM stocklist
        
        `)

    //create the list of updates stocks
    var stockUpdateList = []
    var stockNameList = []

    for (const key in stockInfo) {
        //set variables for our info
        var stockName = await stockInfo[key].stock_name
        var minPrice = await stockInfo[key].stock_value_min
        var maxPrice = await stockInfo[key].stock_value_max
        var desiredPrice = await stockInfo[key].stock_value_desired
        var currentPrice = await stockInfo[key].stock_value_current

        //get the last known value for the stock
        var stock_last = await db.query(`
        SELECT ${stockName}
        FROM log_stockchanges
        ORDER BY id DESC
        LIMIT 1
        `)
        //console.log(stock_last)
        var lastPrice = stock_last[0][`${stockName}`]
        
        //console.log(lastPrice.value)


        //setting the odds

        // if(lastPrice < (minPrice) ){
        //     //console.log("PRICE TOO LOW")
        //     var randIncrease = 0.75
        // }
        // else if(lastPrice > (maxPrice)){
        //     //console.log("PRICE TOO HIGH")
        //     var randIncrease = 0.25
        // }

        

        if( lastPrice < desiredPrice * 0.98){
            //console.log("PRICE SORTA LOW")
            var randIncrease = 0.60
        }
        else if( lastPrice > desiredPrice * 1.02){
            //console.log("PRICE SORTA HIGH")
            var randIncrease = 0.40
        }
        else {
            //console.log("PRICE STABLE")
            var randIncrease = 0.50
        }

        

        //setting the change value
        let minChange = 0.000
        let maxChange = 0.001
        let swingPercent = (Math.random() * (maxChange - minChange) + minChange).toFixed(5);

        //last known price multiplied by the percent 
        let deviation = currentPrice * swingPercent
        
        let randnum = Math.random().toFixed(2)
        
        const rand = randnum < randIncrease
        if (rand){
            //console.log("++++",swingPercent, "%")
            var newPrice = currentPrice + deviation
            var btcFlip = "+"
        } else {
            //console.log("----",swingPercent, "%")
            var newPrice = currentPrice - deviation
            var btcFlip = "-"
        }

        

        //check crash
        if (newPrice === 0) {
          //market Crashed
          var crashed = "[CRASHED]"
          var marketCrash = Math.random().toFixed(4)

          if (marketCrash < 0.001){
            //fix crash
            var newPrice = desiredPrice
            
          }
        } else{

          var crashed = ""
          //potential crash
          var marketCrash = Math.random().toFixed(4)

          if ( marketCrash < 0.0001){
            //Crash market
            var newPrice = 0
          }


        }
        
        //add the new value to the update list
        await stockNameList.push(stockName)
        await stockUpdateList.push(newPrice.toFixed(3))

        await db.query(`
        UPDATE stocklist
        SET stock_value_current = ${newPrice.toFixed(3)}
        WHERE stock_name = '${stockName}'
        `)




        console.log(`${stockName} ${crashed}
$${newPrice.toFixed(3)} ${btcFlip}${deviation.toFixed(3)}`)
    }

    //set the new values to the log
    //console.log(stockNameList, stockUpdateList)
    await db.query(`
    INSERT INTO log_stockchanges
    (${stockNameList})
    VALUES (${stockUpdateList})
    `)
    //console.log("STOCK INFO\n",stockInfo)

    console.log("--------------------------------------------------------------")
    //socket.emit("finances", {"nameList":stockNameList, "stockChanges":stockUpdateList})
    await updateUsers()
    
}

///update desired stock value
async function updateDesiredStocks(){
    console.log("UPDATING DESIRED PRICES")
    //get stock min max values
    var desiredPrices = await db.query(`
    SELECT stock_name, stock_value_min, stock_value_max
    FROM stocklist
    `)
    
    for (const key in desiredPrices) {

        var stockName = await desiredPrices[key].stock_name
        var minPrice = await desiredPrices[key].stock_value_min
        var maxPrice = await desiredPrices[key].stock_value_max

        let newDesiredPrice = (Math.random() * (maxPrice - minPrice) + minPrice).toFixed(2);

        await db.query(`
        UPDATE stocklist
        SET stock_value_desired = ${newDesiredPrice}
        WHERE stock_name = '${stockName}'
        `)

    }
    
}
 
async function updateUsers(){

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
    console.log("sending data to clients")
    return socket.emit("chartdata", financeObject)

    //return socket.emit("finances", stocklog)
}

async function main(){
    updateDesiredStocks()
    getStockInfo()
    setInterval(() => {
        getStockInfo()
    }, 1000*60);

    setInterval(() => {
        updateDesiredStocks()
    }, 1000*60*60*6);

}

main()
//resetStocks() 