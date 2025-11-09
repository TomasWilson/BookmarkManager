
document.getElementById("update").addEventListener("click", () => {

    var source_folder_name = document.getElementById("source_folder").value;
    var target_folder_name = document.getElementById("target_folder").value;
    chrome.runtime.sendMessage({ action: "update", source_folder_name: source_folder_name, target_folder_name: target_folder_name });

});

document.getElementById("api_key_input").addEventListener("change", (event) => {
    console.log("ONCHANGE:", event.target.value);
    chrome.runtime.sendMessage({ action: "set-api-key", api_key: event.target.value });
});

chrome.runtime.sendMessage({ action: "get-progress" }, (response) => {
    console.log("popup.js received response:", response);
    document.getElementById("progress").value = response.value;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    console.log("popup.js onMessage:", msg.action);

    if(msg.action == "set-progress") {
        console.log("popup.js: received set-progress");
        document.getElementById("progress").value = msg.value;
    }

});
