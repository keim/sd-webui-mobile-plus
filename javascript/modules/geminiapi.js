import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

export function geminiapi() {
    const apikeyBox = document.getElementById("sspp_gemini_api_key");
    const apikey = apikeyBox.querySelector("textarea, input").value;
    if (!apikey) {
        throw new Error("Gemini API key is not set.");
    }
    return new GoogleGenerativeAI(apikey);
}
