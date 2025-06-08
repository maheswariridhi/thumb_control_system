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
voltage_mapper = ActuatorVoltageMapper('C:/Users/User/Desktop/year 4_80percentabove/INDIVIDUAL PROJECT/thumb_control_system/matlab/Voltage_Force_LookupTable.csv')

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


@app.route('/api/compute-forces', methods=['POST'])
def compute_forces():
    try:
        data = request.get_json()
        joint_angles = data.get('joint_angles', {})
        forces = compute_actuator_forces(joint_angles)
        return jsonify(forces)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/compute-voltages', methods=['POST'])
def compute_voltages():
    try:
        data = request.get_json()
        joint_angles = data.get('joint_angles', {})
        print("Received joint_angles:", joint_angles)
        forces = compute_actuator_forces(joint_angles)
        print("Computed forces:", forces)
        # Map force processor keys to voltage mapper keys
        force_to_voltage_keys = {
            "CMC_flex": "cmc_flexor",
            "CMC_ext": "cmc_extensor",
            "CMC_abd": "cmc_abductor",
            "CMC_add": "cmc_adductor",
            "MCP_flex": "mcp_flexor",
            "MCP_ext": "mcp_extensor",
            "IP_flex": "ip_flexor",
            "IP_ext": "ip_extensor"
        }
        mapped_forces = {voltage_key: forces.get(force_key, 0.0) for force_key, voltage_key in force_to_voltage_keys.items()}
        print("Mapped forces:", mapped_forces)
        voltages = voltage_mapper.forces_to_voltages(mapped_forces)
        print("Voltages:", voltages)
        return jsonify(voltages)
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("Starting Thumb Control API on http://localhost:5000")
    app.run(debug=True, port=5000)
