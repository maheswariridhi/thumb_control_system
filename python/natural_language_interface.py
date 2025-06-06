# natural_language_interface.py
import anthropic
import json

class ThumbNaturalLanguageInterface:
    """Converts natural language to robotic thumb joint angles using Claude and remembers pose state."""

    def __init__(self, api_key):
        self.client = anthropic.Anthropic(api_key=api_key)

        self.system_prompt = """You are a precise robotic thumb controller. Convert natural language commands to joint angles for a 6-DOF biomechatronic thumb with antagonistic soft actuators.

IMPORTANT: Always interpret commands and provide angles, even for vague inputs. Users will preview and confirm before execution.

When given a command, ALWAYS use the current pose as the starting point. Only update the relevant joint(s) as specified by the user command, and leave all other joints unchanged. For example, if the current pose is IP_flex: 20 and the user says 'extend ip by 20 degrees', decrease IP_flex by 20 (to a minimum of 0) and/or increase IP_ext as needed, always obeying the constraints. Do not reset or zero out other joints unless explicitly told to do so.

ACTUATOR CONFIGURATION (8 total):
- CMC joint: 4 actuators in cross configuration (flexor/extensor, abductor/adductor)
- MCP joint: 2 actuators (flexor/extensor)
- IP joint: 2 actuators (flexor/extensor)

JOINT DEFINITIONS (all angles in degrees):
- CMC_flex: 0 to 90
- CMC_ext: 0 to 20
- CMC_abd: 0 to 30
- CMC_add: 0 to 30
- CMC_opp: 0 to 45
- CMC_rep: 0 to 45
- MCP_flex: 0 to 90
- MCP_ext: 0 to 25
- IP_flex: 0 to 90
- IP_ext: 0 to 15

IMPORTANT CONSTRAINTS:
- All actuator values must be positive (never negative); use only positive values for each actuator direction.
- For each antagonistic pair (e.g., flex/ext, abd/add), the net joint angle (flex - ext, abd - add, etc.) must always stay within the anatomical range: [-max_extension, max_flexion]. If one actuator is at its maximum, the other must be zero.
- Never set both flexion and extension actuators to their maximum at the same time.
- For each antagonistic pair, only one actuator can be nonzero at a time (e.g., CMC_flex and CMC_ext are mutually exclusive; if one is nonzero, the other must be zero. The same applies to CMC_abd/CMC_add, MCP_flex/MCP_ext, IP_flex/IP_ext, and CMC_opp/CMC_rep).
- IP_ext > 0 is only allowed if IP_flex > 0. If IP_flex = 0, then IP_ext must be 0. (The same logic applies to other antagonistic pairs: extension is only possible if there is some flexion, and adduction is only possible if there is some abduction, etc.)
- CMC_opp and CMC_rep are mutually exclusive - only one can be active at a time. If CMC_opp > 0, then CMC_rep must be 0, and vice versa.
- Rest position has all values at 0

SEGMENT LENGTHS:
- CMC → MCP = 50 mm
- MCP → IP = 30 mm
- IP → tip = 20 mm

INTERPRETATION RULES:
1. ALWAYS provide reasonable angles, even for vague commands
2. If input contains displacement (e.g., "bend 5 mm"), convert to angle using: θ = arcsin(displacement / segment_length)
3. Assume segment length = 30 mm unless specified
4. Clamp all angles to physical joint limits
5. Combine multiple joint axes when needed (e.g., "oppose the thumb" → mix of CMC_flex + CMC_abd + CMC_opp)

COMMON POSITIONS:
- Rest: all values = 0
- Thumbs up: CMC_abd=30
- Opposition grip: CMC_flex=30, CMC_abd=25, CMC_opp=35
- Power grip: CMC_flex=60, CMC_abd=10, CMC_opp=15, MCP_flex=70, IP_flex=60
- Full extension: CMC_ext=20, MCP_ext=25, IP_flex=30, IP_ext=15
- Pinch: CMC_flex=30, CMC_abd=20, CMC_opp=25, MCP_flex=40, IP_flex=50

OUTPUT FORMAT:
Return only this JSON. No text, explanation, or units:
{
  "CMC_flex": 0,
  "CMC_ext": 0,
  "CMC_abd": 0,
  "CMC_add": 0,
  "CMC_opp": 0,
  "CMC_rep": 0,
  "MCP_flex": 0,
  "MCP_ext": 0,
  "IP_flex": 0,
  "IP_ext": 0
}
"""

        self.last_pose = {
            "CMC_flex": 0, "CMC_ext": 0, "CMC_abd": 0, "CMC_add": 0,
            "CMC_opp": 0, "CMC_rep": 0, "MCP_flex": 0, "MCP_ext": 0,
            "IP_flex": 0, "IP_ext": 0
        }

    def process_command(self, command):
        """Convert natural language command to joint angles using Claude with memory"""
        if command.strip().lower() in ["reset", "rest", "go to neutral"]:
            self.last_pose = {k: 0 for k in self.last_pose}
            return self.last_pose

        try:
            prompt = f"""
Current pose:
{json.dumps(self.last_pose)}

User command: "{command}"

Now output the updated pose in JSON only.
"""

            response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                system=self.system_prompt,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.3
            )

            angles = json.loads(response.content[0].text)
            validated = self._validate_angles(angles)
            self.last_pose = validated
            return validated

        except Exception as e:
            print(f"Error in NLI: {e}")
            return self.last_pose

    def _validate_angles(self, angles):
        """Ensure angles are within valid ranges and obey mutual constraints"""
        limits = {
            "CMC_flex": (0, 90), "CMC_ext": (0, 20),
            "CMC_abd": (0, 30), "CMC_add": (0, 30),
            "CMC_opp": (0, 45), "CMC_rep": (0, 45),
            "MCP_flex": (0, 90), "MCP_ext": (0, 25),
            "IP_flex": (0, 90), "IP_ext": (0, 15)
        }

        validated = {}
        for joint, (min_val, max_val) in limits.items():
            val = float(angles.get(joint, 0))
            validated[joint] = max(min_val, min(max_val, val))

        # Enforce mutual exclusivity
        if validated["CMC_opp"] > 0: validated["CMC_rep"] = 0
        if validated["CMC_rep"] > 0: validated["CMC_opp"] = 0
        if validated["CMC_flex"] > 0: validated["CMC_ext"] = 0
        if validated["CMC_ext"] > 0: validated["CMC_flex"] = 0
        if validated["CMC_abd"] > 0: validated["CMC_add"] = 0
        if validated["CMC_add"] > 0: validated["CMC_abd"] = 0
        if validated["MCP_flex"] > 0: validated["MCP_ext"] = 0
        if validated["MCP_ext"] > 0: validated["MCP_flex"] = 0
        if validated["IP_flex"] > 0: validated["IP_ext"] = 0
        if validated["IP_ext"] > 0: validated["IP_flex"] = 0

        return validated
