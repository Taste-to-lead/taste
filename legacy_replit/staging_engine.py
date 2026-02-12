import google.generativeai as genai
import os
from prompts import ARCHITECT_PROMPT, STYLES

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

model = genai.GenerativeModel("gemini-1.5-flash")


def analyze_room(image_path, target_vibe):
    with open(image_path, "rb") as f:
        image_data = f.read()

    vibe_description = STYLES[target_vibe]
    formatted_prompt = ARCHITECT_PROMPT.format(style=vibe_description)

    response = model.generate_content([
        {"mime_type": "image/jpeg", "data": image_data},
        formatted_prompt,
    ])

    return response.text


if __name__ == "__main__":
    if not os.environ.get("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY is not set. Please ensure the secret is configured.")
    else:
        image_file = "test_room.jpg"

        if not os.path.exists(image_file):
            print(f"ERROR: '{image_file}' not found. Please add an empty room photo to the project root.")
        else:
            print("Analyzing room with 'Industrialist' vibe...\n")
            result = analyze_room(image_file, "Industrialist")
            print("=== GENERATED STAGING PROMPT ===")
            print(result)
            print("================================\n")

            choice = input("Do you want to generate this image? (yes/no): ")
            if choice.strip().lower() == "yes":
                print("Simulating Image Gen...")
            else:
                print("Aborted to save budget.")
