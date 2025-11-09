### RecipeManager

This is a small chrome extension I wrote to learn a little bit about JavaScript, Chrome Extensions and the Gemini API. 
The goal of the project is for a LLM to help me organize my recipe bookmarks. In particular, I want to add 
"tags" to my recipes, so that I can search for them more easily. A tag could be something like "VEGETARIAN" or "CHICKEN". 

For this, the code visits the url pointed to by the bookmark, copies all text, feeds it to a LLM (Google Gemini) and 
retrieves a cleaned up name of the recipe along with the tags. The recipes are written to a new bookmark folder. 