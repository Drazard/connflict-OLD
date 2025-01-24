const { runInThisContext } = require('vm');
const func = require('./functions')
console.log("test.js loaded.")

function runTest(){


    setTimeout(() => {
        console.log("TEST FUNCTION RUNNING");
    
        let funcName;
        let funxOutput;
        let array = new Array();
        array = []
    
    
    
        //testing Random Int from 0-100
        console.log("randomInt - Generate a random Int between 0 and arg(100)")
        for(var i=0;i<50;i++){
            array.push(func.randomInt(100))
        }
        console.log(array)
        array = []
    
    
        //testing Random Int from 100-200
        console.log("randomIntB- Generate a random Int between arg(200) and arg(300)")
        
        for(var i=0;i<50;i++){
            array.push(func.randomIntB(200,300))
        }
        console.log(array)
        array = []
    
        //testing Random Float from 0-arg(100)
        console.log("randomIntB- Generate a random Float between 0 and arg(100)")
        
        for(var i=0;i<50;i++){
            array.push(func.randomFloat(100))
        }
        console.log(array)
        array = []
        
        //testing Random Float from arg(200) - arg(300)
        console.log("randomIntB- Generate a random Float between arg(200) and arg(300)")
        
        for(var i=0;i<50;i++){
            array.push(func.randomFloatB(200,300))
        }
        console.log(array)
        array = []
        
    }, 3*1000);


}

//runTest();