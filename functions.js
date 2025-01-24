const fs = require('fs');

module.exports = { 
    randomInt: function (int){
        return (Math.floor(Math.random() * int) + 1)
    },
    randomIntB: function (min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min);
    },
    randomFloat: function (int){
        return parseFloat(     (Math.floor(Math.random() * int) ) + "." + (Math.floor(Math.random() * 99) + 1)    )
    },
    randomFloatB: function (min,max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return parseFloat(     Math.floor(Math.random() * (max - min + 1) + min)    + "." +    (Math.floor(Math.random() * 99) + 1)     )
    },
    randomIP: function (){
        return ( String(Math.floor(Math.random() * 255) + 1)+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255)) );
    },
    log: function(string){
        let timeStamp_log = new Date().toLocaleString();
        let message = `(${timeStamp_log}) ${string}`
        console.log(message);
        fs.appendFile('log.txt', message+"\n", function (err) {
            if (err){
                console.log(err);
            }else{
                return
            }
            
          });
        
    },
    chathistory: function(fileName, chatmessage){
        fs.readFile(fileName, 'utf8', function(err, data){
            let splitArray = data.split('\n');
            //console.log(splitArray);
            let sliceArray = splitArray.slice(1);
            sliceArray.push(chatmessage);
            //console.log(sliceArray)
            let result = sliceArray.join('\n');
            //console.log(result);
            fs.writeFile(fileName, result, function(err, result){
                if (err) console.log('error', err);
            })
        })
    },
    randomIP: function(){
        return (Math.floor(Math.random() * 255) + 1)+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255));
    },
    insertDatabase: function(tableName, data){
        db.query(`INSERT ${tableName} SET ?`, data, (error, results) => {
            if(error){ console.log(error);console.log(`[ERROR DB0-${tableName}]`)}
            else{
               return console.log(`[${data}] INSERTED TO [${tableName}] `)
            }
        });
    },
 }
 timestamp = new Date().toLocaleTimeString();

//Running succesfully
let timeStamp_log = new Date().toLocaleString();
console.log(`(${timeStamp_log}) FUNCS. library - LOADED SUCCESFULLY`);