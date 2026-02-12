import os
import json
from google.oauth2 import service_account
import vertexai

PROJECT_ID = "project-5dbd71f6-d36b-4b33-a37"

def authenticate_vertex_ai():
    credentials_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not credentials_json:
        raise ValueError("GOOGLE_CREDENTIALS_JSON environment variable is not set")

    credentials_info = json.loads(credentials_json)
    credentials = service_account.Credentials.from_service_account_info(
        credentials_info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )

    vertexai.init(
        project=PROJECT_ID,
        credentials=credentials,
    )

    print(f"Vertex AI authenticated successfully with project: {PROJECT_ID}")

if __name__ == "__main__":
    authenticate_vertex_ai()
