from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

from natural_language_interface import ThumbNaturalLanguageInterface
# from voltage_mapper import ActuatorVoltageMapper

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Read API key from .env
API_KEY = os.getenv("ANTHROPIC_API_KEY")
nli = ThumbNaturalLanguageInterface(API_KEY)

# TODO: Uncomment and provide the correct CSV path when available
# voltage_mapper = ActuatorVoltageMapper('data/force_voltage_curve.csv')

@app.route('/api/process-command', methods=['POST'])
def process_command():
    try:
        data = request.json
        command = data.get('command', '')
        print(f"Received command: {command}")
        angles = nli.process_command(command)
        print(f"Returning angles: {angles}")
        return jsonify(angles)
    except Exception as e:
        print(f"Error in API: {e}")
        return jsonify({"error": str(e)}), 500

# @app.route('/api/compute-voltages', methods=['POST'])
# def compute_voltages():
#     try:
#         data = request.get_json()
#         joint_angles = data.get('joint_angles', {})
#         voltages = voltage_mapper.angles_to_voltages(joint_angles)
#         return jsonify(voltages)
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("Starting Thumb Control API on http://localhost:5000")
    app.run(debug=True, port=5000)
