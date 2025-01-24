const mysql = require("mysql");
const dotenv = require("dotenv");
var io = require('socket.io-client'),
socket = io.connect("http://211.26.122.213:4000")

socket.on('connect', function () { 
  console.log("gameloop connected"); 
  socket.emit('admin', 'Gameloop Started')
});




dotenv.config({ path: './.env' })

//define database
function Database() {
    this.connection = mysql.createConnection({
      host     : process.env.DATABASE_HOST,
      user     : process.env.DATABASE_USER,
      password : process.env.DATABASE_PASS,
      database : process.env.DATABASE,
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

console.log("Starting miners")

///BTC MINERS
setInterval( async () => {
  console.log("Looping BTC miners.")
    // find BTC miners

    let gameSoftsbtc = await db.query(`SELECT * from gamesoftware WHERE software_type = 'btcminer'`)
      if (!gameSoftsbtc[0]){ 
        return console.log("NO MINERS")
      }else{
        for (var i=0; i<gameSoftsbtc.length;i++){
          var software_id = gameSoftsbtc[i].software_id;
          var location = gameSoftsbtc[i].software_location;
          var owner = gameSoftsbtc[i].software_creator;
          var btclevel = gameSoftsbtc[i].software_level;
          var minerName = gameSoftsbtc[i].software_name;
          var creatorip = gameSoftsbtc[i].creator_ip;
          //console.log("creatorip", creatorip)
          //console.log(`Location: ${location} Owner: ${owner}`)
          if(owner && location != owner){
            let btcminers = await db.query(`SELECT user_id FROM user_vps WHERE vps_hostip = '${creatorip}'`)
            try {
              let userid = btcminers[0].user_id
              let gain = (0.141/60) * btclevel
              //console.log("destip", userid)
              console.log(`BTCMINER: '${minerName}' @ID ${location} +${gain} BTC => ${userid}`)
              await db.query(`UPDATE btc SET btc_amount = btc_amount + ${gain} WHERE user_id =  ${userid}`)
            } catch (error) {
              console.log(`Software '${minerName}'deleted because ip change`)
              await db.query(`DELETE FROM gamesoftware WHERE software_id = '${software_id}'`)
            }
            
          }else{
            console.log(`BTCMINER:: '${minerName}' @ ${location} <=> ${owner} (MATCH, NOTHING GIVEN)`)
          }
        }
      }
        
    console.log("BTC LOOP COMPLETE")
    //calculate miners worth

    console.log("Looping BURST miners.")
  
    // find BTC miners

    let gameSoftsburst = await db.query(`SELECT * from gamesoftware WHERE software_type = 'burstminer'`)
      if (!gameSoftsburst[0]){ 
        return console.log("NO MINERS")
      }
        for (var i=0; i<gameSoftsburst.length;i++){
          var burstsoftware_id = gameSoftsburst[i].software_id;
          var burstlocation = gameSoftsburst[i].software_location;
          var burstowner = gameSoftsburst[i].software_creator;
          var burstlevel = gameSoftsburst[i].software_level;
          var burstminerName = gameSoftsburst[i].software_name;
          var burstcreatorip = gameSoftsburst[i].creator_ip;
            //console.log(`Location: ${location} Owner: ${owner}`)
            if(burstowner && burstlocation != burstowner){
              let burstminers = await db.query(`SELECT user_id, vps_hostip FROM user_vps WHERE vps_hostip = '${burstcreatorip}'`)
              try {
                let burstuserid = burstminers[0].user_id
                let burstuserip = burstminers[0].vps_hostip
                //console.log(`ID ${burstuserid} has a miner connecting to ${burstuserip}`)
                let burstgain = (0.0116/60) * burstlevel
                //console.log("destip", userid)
                console.log(`BURSTMINER: '${burstminerName}' @ID ${burstlocation} +${burstgain} BURST => ${burstuserid}`)
                await db.query(`UPDATE burst SET burst_amount = burst_amount + ${burstgain} WHERE user_id =  ${burstuserid}`)
              } catch (error) {
                //console.log(error)
                console.log(`Software '${burstminerName}'deleted because ip change`)
                await db.query(`DELETE FROM gamesoftware WHERE software_id = '${burstsoftware_id}'`)
              }
              
            }else{
              console.log(`BURSTMINER:: '${burstminerName}' @ ${burstlocation} <=> ${burstowner} (MATCH, NOTHING GIVEN)`)
            }
          }

  let gameSoftsklog = await db.query(`SELECT * from gamesoftware WHERE software_type = 'klog'`)
  if (!gameSoftsklog[0]){ 
    return console.log("NO KLOGS")
  }
    for (var i=0; i<gameSoftsklog.length;i++){
      var klogsoftware_id = gameSoftsklog[i].software_id;
      var kloglocation = gameSoftsklog[i].software_location;
      var klogowner = gameSoftsklog[i].software_creator;
      var klogName = gameSoftsklog[i].software_name;
      var klogcreatorip = gameSoftsklog[i].creator_ip;
        //console.log(`Location: ${location} Owner: ${owner}`)
        if(klogowner && kloglocation != klogowner){
          let klogsoft = await db.query(`SELECT vps_hostip FROM user_vps WHERE vps_hostip = '${klogcreatorip}'`)
          try {
            let kloguserip = klogsoft[0].vps_hostip
            console.log(`KLOG: '${klogName}' @IP ${kloguserip}`)
            if(klogsoft[0]){
              //console.log(klogsoft[0])
            }
          } catch (error) {
            //console.log(error)
            console.log(`Software '${klogName}'deleted because ip change`)
            await db.query(`DELETE FROM gamesoftware WHERE software_id = '${klogsoftware_id}'`)
          }
          
        }else{
          //console.log(`KLOG:: '${klogName}' @ ${kloglocation} <=> ${klogowner} (MATCH, ITS SAFE FOR NOW..)`)
        }
      }
        
    console.log("BURST LOOP COMPLETE")

}, 1*60*1000);
