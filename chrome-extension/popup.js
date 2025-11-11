

const button_save_api = document.querySelector("#save_api_key");
const save_icon = button_save_api.querySelector("i");
const api_key_input = document.querySelector("#api_key_input");


var api_key = "";
const { GEMINI_API_KEY } = await chrome.storage.sync.get("GEMINI_API_KEY");
if(GEMINI_API_KEY) api_key = GEMINI_API_KEY;
api_key_input.value = api_key;
console.log("api_key = ", api_key);

api_key_input.addEventListener("change", () => {
    api_key = api_key_input.value;
});

const source_folder_select = document.querySelector("#select_source");
const output_folder_select = document.querySelector("#select_output");

async function update_folder_selects() {

    [source_folder_select, output_folder_select].forEach((select) => {
        for(var child of Array.from(select.children)) {
            if(!child.hasAttribute("selected")) {
                child.remove();
            }
        }
    });

    var bookmarks_bar = (await chrome.bookmarks.getTree())[0].children[0];
    var folders = bookmarks_bar.children
                    .filter((child) => child.url === undefined)
                    .map((child) => child.title);

    [source_folder_select, output_folder_select].forEach((select) => {
        folders.forEach((fname) => {
            select.appendChild(new Option(fname));
        });
    });
    
};

await update_folder_selects();

button_save_api.addEventListener("click", async () => {
    button_save_api.classList.add("saved");
    save_icon.classList.replace("fa-save", "fa-check");
    await chrome.storage.sync.set({ "GEMINI_API_KEY": api_key });

    setTimeout(() => {
        button_save_api.classList.remove("saved");
        save_icon.classList.replace("fa-check", "fa-save");
    }, 1500);
});

document.getElementById("update").addEventListener("click", () => {

    var source_folder_name = source_folder_select.value;
    var output_folder_name = output_folder_select.value;

    if(source_folder_name == output_folder_name) {
        
    }

    chrome.runtime.sendMessage({ 
        action: "update", 
        source_folder_name: source_folder_name, 
        target_folder_name: output_folder_name,

    
    });

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

