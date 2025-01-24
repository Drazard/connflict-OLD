// //Creating a socket conection to the server.
// var chartSocket = io.connect()

// chartSocket.onAny(async (event, data) => {
//     switch (event) {
//         case "chartdata":
//             //console.log("Chart Data received")
//             updateCharts(data)
//             //console.log(data,"chartdata"); // true
//             break;
    
//         default:
//             break;
//     }   
//   });

// async function updateCharts(data){
//     // var allData = data
//     //console.log(allData)
//     var stocklistNames = Object.keys(data)
//     //destroy other charts
//     Chart.helpers.each(Chart.instances, function (instance) {
//         instance.destroy();
//       }); 

//     for (let index = 0; index < stocklistNames.length; index++) {
//         //console.log(stocklistNames[index])

//         var currentStockName = stocklistNames[index]
//         createChart(currentStockName, data[currentStockName].reverse())
//         // for (const name in currentStockName) {
//         //     console.log(name)      
//     }
   
// }

// async function createChart(name, chartData){
//     var arrayLength = await chartData.length
//     var lables = Array.from(Array(arrayLength).keys())
//     var currentChart = document.getElementById(name)
//     new Chart(currentChart, {
//         type: 'line',
//         data: {
//             labels: lables,
//             datasets: [{
//                 label: `${name} ticks`,
//                 data: chartData,
//                 fill:false,
//                 backgroundColor: [
//                     'rgba(255, 99, 132, 0.2)',
//                     'rgba(54, 162, 235, 0.2)',
//                     'rgba(255, 206, 86, 0.2)',
//                     'rgba(75, 192, 192, 0.2)',
//                     'rgba(153, 102, 255, 0.2)',
//                     'rgba(255, 159, 64, 0.2)'
//                 ],
//                 borderColor: [
//                     'rgba(255,99,132,1)',
//                     'rgba(54, 162, 235, 1)',
//                     'rgba(255, 206, 86, 1)',
//                     'rgba(75, 192, 192, 1)',
//                     'rgba(153, 102, 255, 1)',
//                     'rgba(255, 159, 64, 1)'
//                 ],
//                 borderWidth: 1,
//                 pointRadius: 0,
//                 lineTension: 0,
//             }]
//         },
//         options: {
        
//         tooltips: {enabled: false},
//         //hover: {mode: null},
//         animation: false,
//         events: ['mouseover'],
//         }
//     });
//     //currentChart.update()
//     //console.log(chartData)
// }