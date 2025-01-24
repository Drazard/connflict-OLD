// alert(top.location.href)
// var data = { foo: 'bar' }
// var event = new CustomEvent('myCustomEvent', { test: data })
// window.parent.document.dispatchEvent(event);

// var payload = {key: "g7q86gfq7g465", event: "frombrowser", data: "228.41.167.213"}
// window.top.postMessage(payload, '*')
function myfunc(ip){
    var payload = {key: "g7q86gfq7g465", event: "frombrowser", data: ip}
    window.top.postMessage(payload, '*')
}

window.onmessage = (event) => {
    if (event.data === 'GOT_YOU_IFRAME') {
        console.log('Parent received successfully.')
    }
}

// window.parent.postMessage(payload, "*");