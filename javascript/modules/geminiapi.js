import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

function geminiapi() {
    const apikeyBox = document.getElementById("sspp_gemini_api_key");
    const apikey = apikeyBox.querySelector("textarea, input").value;
    const genai = GoogleGenerativeAI(apikey);
}
