def compute_actuator_forces(joint_angles):
    import math

    # Placeholder constants (replace with real values per actuator)
    STIFFNESS = {
        "CMC_flex": 1.0,
        "CMC_ext": 1.0,
        "CMC_abd": 1.0,
        "CMC_add": 1.0,
        "CMC_opp": 1.0,
        "CMC_rep": 1.0,
        "MCP_flex": 1.0,
        "MCP_ext": 1.0,
        "IP_flex": 1.0,
        "IP_ext": 1.0
    }
    
    DISTANCE = {
        "CMC_flex": 10.0,
        "CMC_ext": 10.0,
        "CMC_abd": 10.0,
        "CMC_add": 10.0,
        "CMC_opp": 10.0,
        "CMC_rep": 10.0,
        "MCP_flex": 10.0,
        "MCP_ext": 10.0,
        "IP_flex": 10.0,
        "IP_ext": 10.0
    }

    forces = {k: 0.0 for k in STIFFNESS.keys()}

    # Direct mappings
    for joint, angle in joint_angles.items():
        if joint in ["CMC_opp"]:
            # Split force diagonally into CMC_flex + CMC_add
            torque = STIFFNESS[joint] * math.radians(angle)
            component_force = torque / DISTANCE[joint] * 0.707  # ≈ sqrt(2)/2
            forces["CMC_flex"] += component_force
            forces["CMC_add"] += component_force

        elif joint in ["CMC_rep"]:
            # Split force diagonally into CMC_ext + CMC_abd
            torque = STIFFNESS[joint] * math.radians(angle)
            component_force = torque / DISTANCE[joint] * 0.707
            forces["CMC_ext"] += component_force
            forces["CMC_abd"] += component_force

        elif angle != 0:
            torque = STIFFNESS[joint] * math.radians(angle)
            force = torque / DISTANCE[joint]
            forces[joint] = force

    return forces
