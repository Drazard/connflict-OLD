//Creating a socket conection to the server.
var socket = io.connect()

// socket.onAny((event, data) => {
//     console.log(event, data)
// });
//calling for updates
socket.emit('chathistory', "get me chat history plz!");
//socket.emit('miners', "Minerlist please!");
// setInterval( async () => {
//     console.log("Checking for miners")
//     socket.emit('getminers', socket.id);
//     console.log("Miners found?")
//   }, 10*1000);

//on redirect
socket.on('gametick', function(tick) {
    //console.log(tick)
    //console.log(tick.time)
    let timeclock = document.getElementById('timeclock'); 
    timeclock.value = tick.time;
});

//on redirect
socket.on('redirect', function(destination) {
    window.location.href = destination;
});

//on chat message run this function.
socket.on('chat', async function (socket) {

    let sendChat = async (chatmsg) => {
        let chatmessage = document.createElement('li');
        chatmessage.innerHTML = chatmsg;
        chat_messages.appendChild(chatmessage);

    }
    await sendChat(socket);
    setTimeout(() => {
        chatWindow = document.getElementById('chat_body'); 
        var xH = chatWindow.scrollHeight; 
        chatWindow.scrollTo(0, xH);
    }, 100);

    

    // //check how many chat messages we have and remove them.
    let liList = document.getElementById("chat_messages").getElementsByTagName("li");
    let largo = liList.length
    //console.log(`There are ${largo} chat messages`)
    while(largo>49){
        await liList[0].remove()
        largo = await liList.length
    };
    // //console.log(liList)
    //console.log(`There are ${largo} chat messages`)
});

//on cmd message run this function.
socket.on('cmd', function (data) {
    if (data == "<ul>cls</ul><br>"){
        return document.getElementById('cmd_messages').innerHTML = "";
    }
    var cmd = document.createElement('li');
    cmd.id = 'chatmessage_'; // make this dynamic?
    cmd.innerHTML = data;
    cmd_messages.appendChild(cmd);
    setTimeout(() => {
        cmdWindow = document.getElementById('cmd_body'); 
        var xH = cmdWindow.scrollHeight; 
        cmdWindow.scrollTo(0, xH);
    }, 50);
    
    let liList = document.getElementById("cmd_messages").getElementsByTagName("li");
    let largo = liList.length
    while(largo>49){
        liList[0].remove()
        largo = liList.length
    };
});
socket.on('key_log', function (data) {
    console.log(data)
    var keylog = document.createElement('li');
    keylog.innerHTML = data;
    keylog_messages.appendChild(keylog);
    setTimeout(() => {
       let thewindow = document.getElementById('keylog_body'); 
        var xH = thewindow.scrollHeight; 
       thewindow.scrollTo(0, xH);
    }, 50);
    
    let liList = document.getElementById("keylog_messages").getElementsByTagName("li");
    let largo = liList.length
    while(largo>49){
        liList[0].remove()
        largo = liList.length
    };
});

socket.on('cmd_remote', function (data) {
    console.log("cmd_remote data", data)
    if (data == "open"){
        document.getElementById("log_container").style.display = "block";
        document.getElementById("keylog_container").style.display = "none";
        //document.getElementById("cmd_container").className = "cmd-container";
        // document.getElementById("log_input").focus();
        // let thewindow = document.getElementById('log_body'); 
        // var xH = thewindow.scrollHeight; 
        // thewindow.scrollTo(0, xH);
    } else if(data == "close"){
        //document.getElementById("cmd_input").focus();
        document.getElementById("log_container").style.display = "none";
        document.getElementById("keylog_container").style.display = "block";
        //document.getElementById("cmd_container").className = "cmd-container-full";
        // document.getElementById("log_messages").innerHTML = ""
    } else{
        var log = document.createElement('li');
        log.innerHTML = data;
        log_messages.appendChild(log);
        setTimeout(() => {
        let thewindow = document.getElementById('log_body'); 
            var xH = thewindow.scrollHeight; 
        thewindow.scrollTo(0, xH);
        }, 50);
        
        let liList = document.getElementById("log_messages").getElementsByTagName("li");
        let largo = liList.length
        while(largo>49){
            liList[0].remove()
            largo = liList.length
        };
    }
    
});

//Event listener to submit to the chat box.
cht_btn.addEventListener('click', async function(e) {
    if(document.getElementById("chat_container").style.display === "none"){
        document.getElementById("chat_container").style.display = "block";
    }else{
        document.getElementById("chat_container").style.display = "none";
    }
});

//Event listener to submit to the chat box.
chat_form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (chat_input.value) {
    await socket.emit('chat', chat_input.value);
    chat_input.value = '';
    setTimeout(() => {
        let thewindow = document.getElementById('chat_body'); 
        var xH = thewindow.scrollHeight; 
        thewindow.scrollTo(0, xH);
    }, 50);
    //document.getElementsByClassName("chat-body").scrollTop -=100;
    }
});

//Event listener to submit to the cmd box.
cmd_form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (cmd_input.value) {
    socket.emit('cmd', cmd_input.value);
    cmd_input.value = '';
    setTimeout(() => {
        let thewindow = document.getElementById('cmd_body'); 
        var xH = thewindow.scrollHeight; 
        thewindow.scrollTo(0, xH);
    }, 50);
    //document.getElementsByClassName("chat-body").scrollTop -=100;
    }
});
keylog_form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (cmd_input.value) {
    socket.emit('cmd', "Keylog terminal doesnt do anyhting yet");
    cmd_input.value = '';
    setTimeout(() => {
        let thewindow = document.getElementById('cmd_body'); 
        var xH = thewindow.scrollHeight; 
        thewindow.scrollTo(0, xH);
    }, 50);
    //document.getElementsByClassName("chat-body").scrollTop -=100;
    }
});
log_form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (log_input.value) {
    socket.emit('cmd', log_input.value);
    log_input.value = '';
    setTimeout(() => {
        let thewindow = document.getElementById('log_body'); 
        var xH = thewindow.scrollHeight; 
        thewindow.scrollTo(0, xH);
    }, 50);
    //document.getElementsByClassName("chat-body").scrollTop -=100;
    }
});

cht_btn.addEventListener('click', function(e) {
    e.preventDefault();
    if (cmd_input.value) {
    socket.emit('cmd', log_input.value);
    cmd_input.value = '';
    setTimeout(() => {
        cmdWindow = document.getElementById('log_body'); 
        var xH = cmdWindow.scrollHeight; 
        cmdWindow.scrollTo(0, xH);
    }, 50);
    //document.getElementsByClassName("chat-body").scrollTop -=100;
    }
});
//Setting the chat/cmd boxes display 
document.getElementById("chat_input").focus();
chatWindow = document.getElementById('chat_body'); 
var xH = chatWindow.scrollHeight; 
chatWindow.scrollTo(0, xH);

//event listener to focus chat/cmd
chat_body.addEventListener('click', function(e) {
    document.getElementById("chat_input").focus();
});
cmd_body.addEventListener('click', function(e) {
    document.getElementById("cmd_input").focus();
});
log_body.addEventListener('click', function(e) {
    document.getElementById("log_input").focus();
});
keylog_body.addEventListener('click', function(e) {
    document.getElementById("keylog_input").focus();
});

document.getElementById("net_btn").addEventListener('click', function(e) {
    alert("pix is a gayboi")
});



setTimeout(() => {
    socket.emit('warning', "get me chat history plz!");
}, 500);