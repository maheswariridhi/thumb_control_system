# natural_language_interface.py
import anthropic
import json

class ThumbNaturalLanguageInterface:
    """Converts natural language to robotic thumb joint angles using Claude"""
    
    def __init__(self, api_key):
        self.client = anthropic.Anthropic(api_key=api_key)
        
        self.system_prompt = """You are a robotic thumb controller. Convert natural language to joint angles.

JOINT DEFINITIONS (all angles in degrees):
- CMC_flex: -20 to 90 (base joint flexion/extension)
- CMC_abd: -30 to 30 (base joint abduction/adduction)  
- MCP_flex: -30 to 90 (middle joint flexion/extension)
- MCP_abd: -30 to 30 (middle joint abduction/adduction)
- IP_flex: -20 to 90 (tip joint flexion/extension)
- IP_roll: -20 to 20 (tip rotation)

COMMON POSITIONS:
- Rest: all zeros
- Thumbs up: CMC_flex=0, CMC_abd=30, MCP_flex=0, MCP_abd=0, IP_flex=0, IP_roll=0
- Curl/Fist: CMC_flex=70, CMC_abd=5, MCP_flex=80, MCP_abd=0, IP_flex=85, IP_roll=0
- Pinch: CMC_flex=30, CMC_abd=20, MCP_flex=40, MCP_abd=10, IP_flex=50, IP_roll=0
- Power grip: CMC_flex=60, CMC_abd=10, MCP_flex=70, MCP_abd=0, IP_flex=60, IP_roll=0

RULES:
- When fingers flex together: IP_flex ≈ 0.5 * MCP_flex, MCP_flex ≈ 0.6 * CMC_flex
- Keep movements natural and smooth

Output ONLY valid JSON with all 6 joints."""

    def process_command(self, command):
        """Convert natural language command to joint angles"""
        try:
            response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                system=self.system_prompt,
                messages=[{"role": "user", "content": command}],
                max_tokens=200,
                temperature=0.3
            )
            
            angles = json.loads(response.content[0].text)
            return self._validate_angles(angles)
            
        except Exception as e:
            print(f"Error in NLI: {e}")
            # Return rest position on error
            return {
                "CMC_flex": 0, "CMC_abd": 0,
                "MCP_flex": 0, "MCP_abd": 0,
                "IP_flex": 0, "IP_roll": 0
            }
    
    def _validate_angles(self, angles):
        """Ensure angles are within valid ranges"""
        limits = {
            "CMC_flex": (-20, 90), "CMC_abd": (-30, 30),
            "MCP_flex": (-30, 90), "MCP_abd": (-30, 30),
            "IP_flex": (-20, 90), "IP_roll": (-20, 20)
        }
        
        validated = {}
        for joint, (min_val, max_val) in limits.items():
            if joint in angles:
                validated[joint] = max(min_val, min(max_val, float(angles[joint])))
            else:
                validated[joint] = 0
                
        return validated