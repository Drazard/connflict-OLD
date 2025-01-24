
 
 // update miners test
let randomIP = funcs.randomIP()
let newMiner = `<td>${randomIP} </td>
<td>DrazCash_${funcs.randomIntB(1,9)} </td>
<td>Bank: ${funcs.randomIntB(1,9)} </td>
<td> ${funcs.randomIntB(1,24)} hours </td>
<td>$${funcs.randomIntB(1,9)},${funcs.randomIntB(100,999)}/h<td>`
// socket.broadcast.emit('miners', newMiner);
socket.emit('miners', newMiner);
console.log("miner updated")


/// cmd Room stuff

socket.rooms.forEach((i) => {
    socket.leave(i)
});

await socket.join([hostConnectedTo, hostGameIP]);
//console.log(hostName+" joining room "+hostConnectedTo)
//console.log(socket.rooms); // Set { <socket.id> }
//console.log(socket.id)

//broadcast to everyone in the room

//socket.in('193.133.172.152').emit("cmd", "test");

//insert the command we wrote to the users terminal

//socket.broadcast.to(hostGameIP).emit(`::${hostGameIP}> ${msg}`);


setInterval(() => {

}, 10);


await db.query('SELECT * FROM users WHERE user_emailverify = ?', [req.query.id], async (error, results) => {
    let userVerified = results[0].user_activated
    if(!userVerified){
        //SET ACCOUNT AS VERIFIED
        console.log("User now verified")
        db.query('UPDATE users SET user_activated = 1 WHERE user_emailverify = ?', [req.query.id]) 
    }
    
    //SET USER ID AND RANDOM IP FOR TERMINAL
    let id = results[0].user_id 
    let randIP = funcs.randomIP();
    console.log(`Verified user (id ${id}), testing for accounts`)
    //REGISTERING NEW TERMINAL
    let termerr, termsucc = await db.query(`SELECT * FROM user_hardware WHERE user_id = ${id}`)
    if(!termsucc){
        console.log("REGISTERING NEW TERMINAL")
        db.query(`INSERT user_terminal SET ?`, {user_id: id, terminal_ip: randIP, terminal_connectedto: randIP})
    }

    //REGISTERING NEW HDD
    let err, succ = await db.query(`SELECT * FROM user_hardware WHERE user_id = ${id}`)
    if(!succ){
        console.log("REGISTERING NEW HARDWARE")
        db.query(`INSERT user_hardware SET ?`, {user_id: id})
    }
    //REGISTERING NEW BTC
    let btcerr, btcsucc = await db.query(`SELECT * FROM btc WHERE user_id = ${id}`)
    if(!btcsucc){
        console.log("REGISTERING NEW BITCOIN")
        db.query(`INSERT btc SET ?`, {user_id: id})
    }
    //REGISTERING NEW BURST
    let bursterr, burstsucc = await db.query(`SELECT * FROM burst WHERE user_id = ${id}`)
    if(!burstsucc){
        let randIP = funcs.randomIP();
        console.log("REGISTERING NEW BURST")
        db.query(`INSERT burst SET ?`, {user_id: id})
    }
});
