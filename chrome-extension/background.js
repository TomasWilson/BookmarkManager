

async function extractTextFromURL(url) {
    const tab = await chrome.tabs.create({
        url,
        active: false
    });

    await new Promise((resolve) => {
        function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }
        }
        chrome.tabs.onUpdated.addListener(listener);
    });

    const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
    });

    await chrome.tabs.remove(tab.id);
    return result.result;
}


var api_key;
const TAGS = ["VEGETARIAN", "VEGAN", "FISH", "CHICKEN", "PORK", "BEEF", "SOUP", "SAUCE", "RICE", "POTATOS", "APPETIZER", "PASTA"]
const BASE_PROMPT = `I want to extract tags from the following recipe. 
The possible tags are: ${TAGS.join(", ")}
Please also note that a recipe is considered vegan if it does not contain any ingredients made from
animal products, and a recipe is vegetarian if it does not contain any meat. Pay attention to focus only on the instructions of 
the recipe and the ingredients list. Sometimes, the input text contains suggestions for different recipes, those should not 
influence the output tags. Also, a recipe is considered "SAUCE", if it is not a standalone meal that contains sauce, but a recipe that only 
describes a sauce that may be used by other meals. 

\n\n\n`;

const N_TRIES = 3;

const MODEL = "gemini-2.5-flash";
const MAX_RPM = 10;
const MIN_REQUEST_TIME_MS = (60 / MAX_RPM * 1000) * 1.1; // add 10% as a safety buffer against the true RPM limit

async function extractTagsFromText(website_text) {

    const TARGET_URL = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${api_key}`);
    const BODY = {
        contents: [
            {
                parts: [
                    { text: BASE_PROMPT + website_text }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: {
                type: "object",
                properties: {
                    recipe_name: {
                        type: "string",
                        description: "The name of the recipe. If you dont find any recipe or a name, output an empty string."
                    },
                    tags: {
                        type: "array",
                        items: {
                            type: "string", 
                            description: `Tag name that matches the recipe. One of ${TAGS.join(", ")}`
                        }
                    }
                },
                required: ["recipe_name", "tags"]
            }
        }
    }


    async function get_recipe_info() {

        console.log("background.js: get_tags() for", website_text);
        const res = await fetch(TARGET_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(BODY)
        })

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Request failed: ${res.status} - ${errText}`);
        }
        
        var result_obj = await res.json();
        console.log(result_obj);
        return JSON.parse(result_obj.candidates[0].content.parts[0].text);
    }

    for(var t = 0; t < 3; t++) {
        try {
            return get_recipe_info();
        }
        catch (err) {
            console.log("ERROR EXTRACTING TEXT:", err);
        }
    }

    return "ERROR"; 

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function countUrlNodes(node) {
    if(node.url !== undefined) return 1;
    var s = 0;
    for(const child_node of node.children) {
        s += countUrlNodes(child_node);
    }
    return s;
}


async function copyTransformFolder(
    from_node,
    to_node, 
    transform_url_node_fn = async link_node => link_node,
) {

    for(const child_node of from_node.children) {
        if(child_node.url === undefined) {
            const new_node = await chrome.bookmarks.create({"parentId": to_node.id, "title": child_node.title });
            await copyTransformFolder(child_node, new_node, transform_url_node_fn);
        }
        else {
            const transformed_node = await transform_url_node_fn(child_node);

            await chrome.bookmarks.create({
                "parentId": to_node.id, 
                "title": transformed_node.title, 
                "url": transformed_node.url 
            })
        }
    }

}


var progress_percent = 0;

async function update_all(source_folder_name, target_folder_name) {

    var bookmarks_bar = (await chrome.bookmarks.getTree())[0].children[0];


    var source_folder_node = bookmarks_bar.children.find((child) => {
        return child.title == source_folder_name && child.url === undefined;
    });
    var target_folder_node = bookmarks_bar.children.find((child) => {
        return child.title == target_folder_name && child.url === undefined;
    });
    

    if(target_folder_node !== undefined) {
        await chrome.bookmarks.removeTree(target_folder_node.id);
    }
    target_folder_node = await chrome.bookmarks.create(
        {"parentId": bookmarks_bar.id, "title": target_folder_name, "index": source_folder_node.index + 1},
    )

    const N = countUrlNodes(source_folder_node);

    progress_percent = 0;
    var nodes_processed = 0;

    var last_request_time = Date.now();
    
    async function transform_node_fn(node) {

        var text = await extractTextFromURL(node.url);
        var ai_response = await extractTagsFromText(text);
        
        // if the request didnt take at least MIN_REQUEST_TIME_MS, 
        // we sleep the difference, to make sure we don't exceed the rate limit
        var now = Date.now();
        var delta = MIN_REQUEST_TIME_MS - (now - last_request_time);
        if(delta > 0) {
            await sleep(delta);
        }
        last_request_time = now;
        
        var out_node = structuredClone(node);

        var recipe_name;
        if(ai_response.recipe_name == "") recipe_name = out_node.title;
        else recipe_name = ai_response.recipe_name;

        out_node.title = recipe_name + " " + ai_response.tags.map(tag => `[${tag}]`).join(", ");

        nodes_processed++;
        progress_percent = Math.round(nodes_processed / N * 100);
        chrome.runtime.sendMessage({ action: "set-progress", value: progress_percent });

        return out_node;
    }

    await copyTransformFolder(source_folder_node, target_folder_node, transform_node_fn);

}


// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    console.log("background.js onMessage:", msg.action);
    
    if(msg.action == "set-api-key") {
        console.log("set api key to:", msg.api_key);
        api_key = msg.api_key;
    }
    else if(msg.action == "update") {
        console.log("background.js: UPDATE");
        update_all(msg.source_folder_name, msg.target_folder_name).then(sendResponse);
        return true;        
    }
    else if(msg.action == "get-progress") {
        console.log("RETURNING.", {value: progress_percent});
        sendResponse({ value: progress_percent });
    }


});
