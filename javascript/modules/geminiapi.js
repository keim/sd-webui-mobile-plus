import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

export function geminiapi() {
    const apikeyBox = document.getElementById("sspp_gemini_api_key");
    const apikey = apikeyBox.querySelector("textarea, input").value;
    if (!apikey) {
        console.error("Gemini API key is missing.");
        return;
    }
    return new GoogleGenerativeAI(apikey);
}
