
// let payload = {key: "g7q86gfq7g465", event: "default", data: "testing!"}
// window.top.postMessage(payload, '*')

setTimeout(() => {
    

    let iptrack = {key: "g7q86gfq7g465", event: "frombrowser", data: "18.5.25.25"}
    window.top.postMessage(iptrack, '*')

    chat_form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (browser_chat_input.value) {
        let payload = {key: "g7q86gfq7g465", event: "chat", data: browser_chat_input.value}
        await window.top.postMessage(payload, '*')
        browser_chat_input.value = '';
        }
    });

}, 500);