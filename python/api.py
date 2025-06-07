from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

from natural_language_interface import ThumbNaturalLanguageInterface
from voltage_mapper import ActuatorVoltageMapper
from backend_force_processor import compute_actuator_forces

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Read API key from .env
API_KEY = os.getenv("ANTHROPIC_API_KEY")
nli = ThumbNaturalLanguageInterface(API_KEY)

# Initialize voltage mapper with the correct CSV path
voltage_mapper = ActuatorVoltageMapper('../matlab/Voltage_Force_LookupTable.csv')

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

@app.route('/api/compute-voltages', methods=['POST'])
def compute_voltages():
    try:
        data = request.get_json()
        joint_angles = data.get('joint_angles', {})
        voltages = voltage_mapper.angles_to_voltages(joint_angles)
        return jsonify(voltages)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compute-forces', methods=['POST'])
def compute_forces():
    try:
        data = request.get_json()
        joint_angles = data.get('joint_angles', {})
        forces = compute_actuator_forces(joint_angles)
        return jsonify(forces)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("Starting Thumb Control API on http://localhost:5000")
    app.run(debug=True, port=5000)
