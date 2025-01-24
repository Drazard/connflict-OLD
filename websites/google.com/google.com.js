setTimeout(() => {

const googlesearch_form = document.getElementById("googlesearch_form");
googlesearch_form.addEventListener("submit", async function(e) {
    e.preventDefault();
    if (googlesearch.value) {
        let iptrack = {key: "g7q86gfq7g465", event: "requestpage", data: "searchresults"}
        await window.top.postMessage(iptrack, '*')
        googlesearch.value = "";
        } 
  });

}, 500);