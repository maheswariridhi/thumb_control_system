# api.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from natural_language_interface import ThumbNaturalLanguageInterface

app = Flask(__name__)
CORS(app)  # Allow requests from React frontend

# Initialize NLI with your API key
API_KEY = "ANTHROPIC_API_KEY"  
nli = ThumbNaturalLanguageInterface(API_KEY)

@app.route('/api/process-command', methods=['POST'])
def process_command():
    try:
        data = request.json
        command = data.get('command', '')
        
        print(f"Received command: {command}")
        
        # Process with Claude
        angles = nli.process_command(command)
        
        print(f"Returning angles: {angles}")
        
        return jsonify(angles)
    
    except Exception as e:
        print(f"Error in API: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("Starting Thumb Control API on http://localhost:5000")
    app.run(debug=True, port=5000)