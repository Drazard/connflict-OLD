//Creating a socket conection to the server.
var socket = io.connect()

var financeInfo;
//Retreiving the chat history
// setTimeout(() => {
//     socket.emit('chathistory', "get me chat history plz!");
//     socket.emit('cmdhistory', "get me cmd history plz!");
//     socket.emit('requestpage', "temppage")
// }, 500);

//setting variables

//setting up the client listener logic
socket.onAny(async (event, data) => { //On any event retreive everything

    //console.log(data)
    //Going to try a switch, never used it apparently they are good?
    switch(event){
        case "cls":
            //clear temrinal

              document.getElementById("localterminal-messages").innerHTML = "";

            break;
        case "redirect":
            //redirect logic
            window.location.href = data;
            break;
        
        case "chat":
            //chat logic
            await createMessage("chat-messages", data);
            document.getElementById("chat-messages").scrollTop = 10000;
            break;
        case "terminal":
            //cmd logic
            await createMessage("localterminal-messages", data);
            //console.log(data)
            document.getElementById("localterminal-messages").scrollTop = 10000;
            break;
        
        case "terminalhistory":
            //cmd logic
            document.getElementById("localterminal-messages").innerHTML = data
            document.getElementById("terminaltaskbar").innerHTML = "";
            //await replaceMessage("localterminal-messages", data);
            //console.log(data)
            document.getElementById("localterminal-messages").scrollTop = 10000;
            break;

        case "process":
          //process logic
          const elem = document.getElementById("terminaltaskbar"); 
            elem.innerHTML = data
            //console.log("logging the data for taskbarthing",data)
          break;
        case "logprocess":
          //LOG process logic
          //console.log("logging the data for LOG taskbarthing",data)
            var logselem = document.getElementById("logterminaltaskbar"); 
            logselem.innerHTML = data
            
          break;
        case "terminalupdate":
            //cmd logic
           //("terminal update data",data)
            //console.log("data.time",data.time)
            //console.log("data.id",data.id)
            var steps = 1 / data.time
            //console.log("steps",steps)

            // var elem = document.getElementById(data.id);
            // for(var steps = 1 / data.time;steps<1;steps = steps + steps){
            //     setTimeout( async(steps) => {
            //         console.log(steps)
            //         let curwidth = elem.style.width
            //         console.log("width of elem",curwidth)
            //         elem.style.width = curwidth + steps+"%"
            //     }, 1000*steps+1000);
                
            // }

            function myMove(anim, time) {
                let id = null;
                let steps = time / 20
                const elem = document.getElementById("terminaltaskbar");   
                let pos = "";
                clearInterval(id);
                id = setInterval(frame, steps*1000);
                function frame() {
                  if (pos > 19) {
                    clearInterval(id);
                  } else {
                    pos++; 
                    elem.style.width = pos*5 + "%"; 
                    elem.innerHTML = "&nbsp;" + pos*5 + "%";
                  }
                }
              }

              return myMove(data.id, data.time)
            break;
        case "log":
            //console.log(data);
            await createMessage("logs-messages", data);
            document.getElementById("logs-messages").scrollTop = 10000;
            break;

        case "chartdata":
          //console.log("Chart Data received")
          updateCharts(data)
          //console.log(data,"chartdata"); // true
          break;
          
        case "finances":
          console.log("FINANCE DATA",data)
          financeInfo = data
          //console.log(financeObject.BTC, financeObject.BURST,financeObject.coin1,financeObject.coin2)
          //console.log("Values", data.btcvalues)
          //console.log("lables", data.lables)
          // var ctx = document.getElementById("myChart");
          // var myChart = new Chart(ctx, {
          //     type: 'line',
          //     data: {
          //         labels: data.lables,
          //         datasets: [{
          //             label: 'BTC ticks',
          //             data: data.btcvalues,
          //             fill:false,
          //             backgroundColor: [
          //                 'rgba(255, 99, 132, 0.2)',
          //                 'rgba(54, 162, 235, 0.2)',
          //                 'rgba(255, 206, 86, 0.2)',
          //                 'rgba(75, 192, 192, 0.2)',
          //                 'rgba(153, 102, 255, 0.2)',
          //                 'rgba(255, 159, 64, 0.2)'
          //             ],
          //             borderColor: [
          //                 'rgba(255,99,132,1)',
          //                 'rgba(54, 162, 235, 1)',
          //                 'rgba(255, 206, 86, 1)',
          //                 'rgba(75, 192, 192, 1)',
          //                 'rgba(153, 102, 255, 1)',
          //                 'rgba(255, 159, 64, 1)'
          //             ],
          //             borderWidth: 1,
          //             pointRadius: 0,
          //             lineTension: 0,
          //         }]
          //     },
          //     options: {
                
          //       tooltips: {enabled: false},
          //       //hover: {mode: null},
          //       animation: false,
          //       events: ['mouseover'],
          //         scales: {
          //             yAxes: [{
          //                 ticks: {
          //                     beginAtZero:false
          //                 }
          //             }]
          //         }
          //     }
          // });
          // setTimeout(() => {
          //   myChart.update()
          //   myChart.render()
          // }, 100);  
          
    }
    //console.log(event, data) // log the event
});

async function createMessage  (location, msg) {
    //Creating the message
    let messageBody = document.createElement('li');     //create a new element to house our message
    messageBody.innerHTML = msg;                        //set the innerHTML of our new element with contents of 'msg'  
    let windowBody = document.getElementById(location);   //get the element 'location' (where we want to put our msg content)
    windowBody.appendChild(messageBody);                  //append 'messageBody' (our 'msg' wrapped in the element we created) as a child of 'chatBody' (the location)   

    //scroll the window
    windowBody.scrollIntoView(false);

    //message pruning
    let liList = windowBody.getElementsByTagName("li");   //grab all the elements within the windowBody' as an array
    let largo = liList.length                           //figure out the length (how many elements we have)
    while(largo>49){                                    //while this number is too high (over 49)
        await liList[0].remove()                        //remove the first itsm from the array (which will be the last message)
        largo = await liList.length                     //get the length of the newly edited array
    };
}

async function replaceMessage  (location, msg) {
  //Creating the message
  let messageBody = document.createElement('li');     //create a new element to house our message
  messageBody.innerHTML = msg;                        //set the innerHTML of our new element with contents of 'msg'  
  let windowBody = document.getElementById(location);   //get the element 'location' (where we want to put our msg content)
  windowBody.appendChild(messageBody);                  //append 'messageBody' (our 'msg' wrapped in the element we created) as a child of 'chatBody' (the location)   

  //scroll the window
  windowBody.scrollIntoView(false);

  //message pruning
  let liList = windowBody.getElementsByTagName("li");   //grab all the elements within the windowBody' as an array
  let largo = liList.length                           //figure out the length (how many elements we have)
  while(largo>49){                                    //while this number is too high (over 49)
      await liList[0].remove()                        //remove the first itsm from the array (which will be the last message)
      largo = await liList.length                     //get the length of the newly edited array
  };
}

const newchat = document.getElementById("chat-input");
newchat.addEventListener("keyup", async function(event) {
  if (event.key === "Enter") {
    if (newchat.value) {
        await socket.emit('chat', newchat.value);
        newchat.value = "";
        } 
  }
});

const terminal_local = document.getElementById("localterminal-input");
terminal_local.addEventListener("keyup", async function(event) {
  if (event.key === "Enter") {
    if (terminal_local.value) {
        data = {command: terminal_local.value}
        socket.emit('command', data);
        //add newchat.value to an array in localstorage
        terminal_local.value = "";
        } 
  }
});

// const requestpage = document.getElementById("browser-input");
// requestpage.addEventListener("keyup", function(event) {
//     if (event.key === "Enter") {	
//         socket.emit("requestpage", document.getElementById("browser-input").value)
//         //document.getElementById("browser-input").value = "";
//     }
// });

//Setting focus on login to the local terminal.
document.getElementById("localterminal-input").focus();
//homepage icon to send you to homepage

//Handing in game browser data
window.onmessage = (response) => {
    var resevent = response.data.event
    var resdata = response.data.data
    socket.emit(resevent, resdata)
}

//Browser Script

function openPage(pageName, elmnt, color) {
    // Hide all elements with class="tabcontent" by default */
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Remove the background color of all tablinks/buttons
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].style.backgroundColor = "";
    }
  
    // Show the specific tab content
    //document.getElementById(pageName).innerHTML = "testing";
    document.getElementById(pageName).style.display = "block";
  
    // Add the specific color to the button used to open the tab content
    elmnt.style.backgroundColor = color;
  }
  // Get the element with id="defaultOpen" and click on it
  document.getElementById("defaultOpen").click();

  // setTimeout(() => {
  //   async function func() {
  //     await createMessage("logs-messages", "Logging...");
  //     await socket.emit('connect', "i am connected");
  //   }
  //   func()
  // }, 5000);

// setTimeout(async() => {
//     await socket.emit('loaded', "i am connected");
//     await createMessage("logs-messages", "Logging...");
// }, 5000);




async function updateCharts(data){
  // var allData = data
  //console.log(allData)
  var stocklistNames = Object.keys(data)
  //destroy other charts
  Chart.helpers.each(Chart.instances, function (instance) {
      instance.destroy();
    }); 

  for (let index = 0; index < stocklistNames.length; index++) {
      //console.log(stocklistNames[index])

      var currentStockName = stocklistNames[index]
      createChart(currentStockName, data[currentStockName].reverse())
      // for (const name in currentStockName) {
      //     console.log(name)      
  }
 
}

async function createChart(name, chartData){
  var arrayLength = await chartData.length
  var lables = Array.from(Array(arrayLength).keys())
  var currentChart = document.getElementById(name)
  new Chart(currentChart, {
      type: 'line',
      data: {
          labels: lables,
          datasets: [{
              label: `${name} ticks`,
              data: chartData,
              fill:false,
              backgroundColor: [
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(54, 162, 235, 0.2)',
                  'rgba(255, 206, 86, 0.2)',
                  'rgba(75, 192, 192, 0.2)',
                  'rgba(153, 102, 255, 0.2)',
                  'rgba(255, 159, 64, 0.2)'
              ],
              borderColor: [
                  'rgba(255,99,132,1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(153, 102, 255, 1)',
                  'rgba(255, 159, 64, 1)'
              ],
              borderWidth: 1,
              pointRadius: 0,
              lineTension: 0,
          }]
      },
      options: {
      
      tooltips: {enabled: false},
      //hover: {mode: null},
      animation: false,
      events: ['mouseover'],
      }
  });
  //currentChart.update()
  //console.log(chartData)
}


// setInterval(() => {
//    else if (document.activeElement === document.getElementById("chat-input")){
//     console.log("CHAT FOCUSED")
//   } else{
//     console.log("NEITHER TERM OR CHAT FOCUSED!")
//   }
  
// }, 1000);