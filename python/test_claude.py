import anthropic
import json
from dotenv import load_dotenv
import os

load_dotenv()  # load .env variables


client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

response = client.messages.create(
    model="claude-3-haiku-20240307",
    system="Convert to JSON: CMC_flex, CMC_abd, MCP_flex, MCP_abd, IP_flex, IP_roll (all in degrees)",
    messages=[{"role": "user", "content": "curl the thumb"}],
    max_tokens=200
)

print(response.content[0].text)